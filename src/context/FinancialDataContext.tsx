"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAccountModal } from "./AccountModalContext";
import { db } from "@/lib/db";
import { addMonths, format } from "date-fns";

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
  current_invoice_cents?: number;
  closing_day?: number;
  due_day?: number;
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
    console.log("LOCAL-FIRST: BUSCANDO ATUALIZAÇÕES DO SUPABASE...");
    const supabase = createClient();

    // Buscar Categorias (Incluindo Globais)
    let { data: catData } = await supabase
      .from("categories")
      .select("id, name, type")
      .or(`family_group_id.eq.${familyGroupId},family_group_id.is.null`);

    // Se não houver categorias, vamos semear as padrões automaticamente
    if (catData && catData.length === 0) {
      console.log("LOCAL-FIRST: SEMEANDO CATEGORIAS PADRÃO...");
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
      .select("id, name, type, balance_cents, credit_limit_cents, closing_day, due_day")
      .eq("family_group_id", familyGroupId);

    if (catData) {
      setCategories(catData);
      // Atualizar Banco Local
      await db.categories.bulkPut(catData.map(c => ({ ...c, family_group_id: familyGroupId })));
    }
    
    if (accData) {
      // Calcular Fatura Atual para cada cartão
      const accountsWithInvoice = await Promise.all(accData.map(async (acc) => {
        if (acc.type === "CREDIT_CARD") {
          // Determinar qual é a fatura "aberta" no momento (UTC)
          const now = new Date();
          let invY = now.getUTCFullYear();
          let invM = now.getUTCMonth();
          
          if (now.getUTCDate() > (acc.closing_day || 1)) {
            invM++;
            if (invM > 11) { invM = 0; invY++; }
          }
          const invoiceStr = `${invY}-${String(invM + 1).padStart(2, '0')}-01`;

          const { data: txs } = await supabase
            .from("transactions")
            .select("amount_cents, date")
            .eq("account_id", acc.id);
          
          const total = txs?.reduce((sum, tx) => {
            const txDate = new Date(tx.date);
            let tY = txDate.getUTCFullYear();
            let tM = txDate.getUTCMonth();
            
            if (txDate.getUTCDate() > (acc.closing_day || 1)) {
              tM++;
              if (tM > 11) { tM = 0; tY++; }
            }
            
            const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}-01`;
            return txInvoiceStr === invoiceStr ? sum + tx.amount_cents : sum;
          }, 0) || 0;
          
          return { ...acc, current_invoice_cents: total };
        }
        return acc;
      }));

      setAccounts(accountsWithInvoice as Account[]);
      // Atualizar Banco Local
      await db.accounts.bulkPut(accountsWithInvoice.map(a => ({ ...a, family_group_id: familyGroupId })));
    }
    
    setLastFetched(Date.now());
    setLoading(false);
  }, [familyGroupId]);

  // Carregar dados locais IMEDIATAMENTE
  useEffect(() => {
    async function loadLocalData() {
      if (!familyGroupId) return;
      
      const localAccounts = await db.accounts.where('family_group_id').equals(familyGroupId).toArray();
      const localCategories = await db.categories.where('family_group_id').equals(familyGroupId).toArray();

      if (localAccounts.length > 0 || localCategories.length > 0) {
        console.log("LOCAL-FIRST: DADOS CARREGADOS DO BANCO LOCAL");
        setAccounts(localAccounts as Account[]);
        setCategories(localCategories as Category[]);
      }
    }

    loadLocalData();
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
