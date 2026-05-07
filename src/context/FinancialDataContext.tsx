"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAccountModal } from "./AccountModalContext";

interface Category {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
  credit_limit_cents?: number;
}

interface FinancialDataContextType {
  categories: Category[];
  accounts: Account[];
  loading: boolean;
  refreshData: () => Promise<void>;
  lastFetched: number | null;
}

const FinancialDataContext = createContext<FinancialDataContextType | undefined>(undefined);

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos de cache

export function FinancialDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const { familyGroupId } = useAccountModal();

  const refreshData = useCallback(async () => {
    if (!familyGroupId) return;

    setLoading(true);
    console.log("CACHE - BUSCANDO DADOS DO BANCO...");
    const supabase = createClient();

    // Buscar Categorias (Incluindo Globais)
    let { data: catData } = await supabase
      .from("categories")
      .select("id, name, type")
      .or(`family_group_id.eq.${familyGroupId},family_group_id.is.null`);

    // Se não houver categorias, vamos semear as padrões automaticamente
    if (catData && catData.length === 0) {
      console.log("CACHE - SEMEANDO CATEGORIAS PADRÃO...");
      const defaultCategories = [
        { name: "Salário", type: "INCOME", color_hex: "#10B981" },
        { name: "Investimentos", type: "INCOME", color_hex: "#3B82F6" },
        { name: "Alimentação", type: "EXPENSE", color_hex: "#EF4444" },
        { name: "Lazer", type: "EXPENSE", color_hex: "#F59E0B" },
        { name: "Saúde", type: "EXPENSE", color_hex: "#EC4899" },
        { name: "Transporte", type: "EXPENSE", color_hex: "#6366F1" },
        { name: "Moradia", type: "EXPENSE", color_hex: "#8B5CF6" },
        { name: "Outros", type: "EXPENSE", color_hex: "#9CA3AF" },
      ];

      const { data: seeded } = await supabase
        .from("categories")
        .insert(defaultCategories.map(c => ({ ...c, family_group_id: familyGroupId })))
        .select();
      
      if (seeded) catData = seeded;
    }

    // Buscar Contas
    const { data: accData } = await supabase
      .from("accounts")
      .select("id, name, type, balance_cents, credit_limit_cents")
      .eq("family_group_id", familyGroupId);

    if (catData) {
      setCategories(catData);
    }
    
    if (accData) {
      setAccounts(accData);
    }
    
    setLastFetched(Date.now());
    setLoading(false);
  }, [familyGroupId]);

  // Carregar dados inicialmente se o cache expirar
  useEffect(() => {
    if (familyGroupId) {
      const now = Date.now();
      const isExpired = !lastFetched || (now - lastFetched > CACHE_DURATION);
      
      if (isExpired) {
        refreshData();
      }
    }
  }, [familyGroupId, lastFetched, refreshData]);

  return (
    <FinancialDataContext.Provider value={{ categories, accounts, loading, refreshData, lastFetched }}>
      {children}
    </FinancialDataContext.Provider>
  );
}

export function useFinancialData() {
  const context = useContext(FinancialDataContext);
  if (context === undefined) {
    throw new Error("useFinancialData must be used within a FinancialDataProvider");
  }
  return context;
}
