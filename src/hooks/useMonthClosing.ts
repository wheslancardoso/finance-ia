import { useState, useEffect, useCallback } from "react";
import { format, addMonths, startOfMonth } from "date-fns";

export interface MonthClosing {
  id: string;
  user_id: string;
  reference_month: string;
  total_balance_cents: number;
  account_balances: Array<{
    account_id: string;
    name: string;
    balance_cents: number;
  }>;
  total_income_cents: number;
  total_expenses_cents: number;
  total_credit_debt_cents: number;
  sealed_at: string;
  seal_method: "auto" | "manual" | "reconciliation";
}

interface MonthClosingResult {
  closing: MonthClosing | null;
  source: "sealed" | "auto-sealed" | "manual" | null;
  isLoading: boolean;
  error: string | null;
  isAutoSealed: boolean;
  refetch: () => void;
}

/**
 * Hook que busca o month_closing para um mês específico.
 * 
 * - Para monthOffset === 0: retorna null (usar dados live).
 * - Para monthOffset < 0: busca da API /api/month-closing.
 * - Para monthOffset > 0: retorna null (usar projeção).
 * 
 * Cacheia resultados na sessão para evitar re-fetches.
 */
const closingCache = new Map<string, { closing: MonthClosing; source: string }>();

export function useMonthClosing(monthOffset: number): MonthClosingResult {
  const [closing, setClosing] = useState<MonthClosing | null>(null);
  const [source, setSource] = useState<MonthClosingResult["source"]>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = format(startOfMonth(addMonths(new Date(), monthOffset)), "yyyy-MM");
  const shouldFetch = monthOffset < 0;

  const fetchClosing = useCallback(async () => {
    if (!shouldFetch) {
      setClosing(null);
      setSource(null);
      return;
    }

    // Verificar cache da sessão
    const cached = closingCache.get(monthKey);
    if (cached) {
      setClosing(cached.closing);
      setSource(cached.source as MonthClosingResult["source"]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/month-closing?month=${monthKey}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setClosing(data.closing);
      setSource(data.source);

      // Cachear para a sessão
      closingCache.set(monthKey, { closing: data.closing, source: data.source });
    } catch (err: any) {
      console.error(`Falha ao buscar month_closing para ${monthKey}:`, err);
      setError(err.message);
      setClosing(null);
    } finally {
      setIsLoading(false);
    }
  }, [monthKey, shouldFetch]);

  useEffect(() => {
    fetchClosing();
  }, [fetchClosing]);

  const refetch = useCallback(() => {
    closingCache.delete(monthKey);
    fetchClosing();
  }, [monthKey, fetchClosing]);

  return {
    closing,
    source,
    isLoading,
    error,
    isAutoSealed: source === "auto-sealed",
    refetch
  };
}

/**
 * Invalida o cache de um mês específico.
 * Útil após reconciliação ou correção manual.
 */
export function invalidateMonthClosingCache(monthKey?: string) {
  if (monthKey) {
    closingCache.delete(monthKey);
  } else {
    closingCache.clear();
  }
}
