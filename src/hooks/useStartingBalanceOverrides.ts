import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import { useFinancialData } from "@/context/FinancialDataContext";

export function useStartingBalanceOverrides() {
  const { userId } = useFinancialData();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  
  const loadOverrides = useCallback(async () => {
    if (!userId) return;
    const list = await db.monthly_balance_overrides
      .where("user_id").equals(userId)
      .toArray();
    
    const obj = list.reduce((acc, curr) => {
      acc[curr.month_key] = curr.balance_cents;
      return acc;
    }, {} as Record<string, number>);
    
    setOverrides(obj);
  }, [userId]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  const saveOverride = useCallback(async (monthKey: string, balanceCents: number) => {
    if (!userId) return;
    
    // Procura registro existente
    const existing = await db.monthly_balance_overrides
      .where({ user_id: userId, month_key: monthKey })
      .first();

    if (existing) {
      await db.monthly_balance_overrides.update(existing.id, {
        balance_cents: balanceCents,
        updated_at: new Date().toISOString()
      });
    } else {
      await db.monthly_balance_overrides.add({
        id: crypto.randomUUID(),
        user_id: userId,
        month_key: monthKey,
        balance_cents: balanceCents,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    setOverrides(prev => ({ ...prev, [monthKey]: balanceCents }));

    // Tenta Sincronizar com API do Supabase
    try {
      await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_key: monthKey, balance_cents: balanceCents })
      });
    } catch (e) {
      console.warn("API Sync for overrides failed, saved locally", e);
    }
  }, [userId]);

  const removeOverride = useCallback(async (monthKey: string) => {
    if (!userId) return;
    
    const existing = await db.monthly_balance_overrides
      .where({ user_id: userId, month_key: monthKey })
      .first();

    if (existing) {
      await db.monthly_balance_overrides.delete(existing.id);
      
      setOverrides(prev => {
        const next = { ...prev };
        delete next[monthKey];
        return next;
      });

      try {
        await fetch(`/api/overrides?month_key=${monthKey}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn("API Sync for overrides failed, deleted locally", e);
      }
    }
  }, [userId]);

  return {
    overrides,
    saveOverride,
    removeOverride
  };
}
