"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAccountModal } from "./AccountModalContext";
import { db } from "@/lib/db";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  ceiling_impact_cents?: number;
  closed_invoice_cents?: number;
  closed_invoice_month?: string;
  open_invoice_cents?: number;
  open_invoice_month?: string;
  closing_day?: number;
  due_day?: number;
  color_hex?: string;
}

interface FinancialDataContextType {
  categories: Category[];
  accounts: Account[];
  loading: boolean;
  refreshData: () => Promise<void>;
  lastFetched: number | null;
  monthlyIncomeCents: number;
  setMonthlyIncomeCents: (val: number) => void;
  fixedExpensesCents: number;
  setFixedExpensesCents: (val: number) => void;
  
  // Modo Crise Avançado
  extraIncomeCents: number;
  currentMonthExpensesCents: number;
  accumulatedBalanceCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  toggleTransactionPaid: (transactionId: string, currentStatus: boolean) => Promise<void>;
}

const FinancialDataContext = createContext<FinancialDataContextType | undefined>(undefined);

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos de cache

export function FinancialDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  
  // Modo Crise: Variáveis Base
  const [monthlyIncomeCents, setMonthlyIncomeCentsState] = useState(0);
  const [fixedExpensesCents, setFixedExpensesCentsState] = useState(0);
  const [extraIncomeCents, setExtraIncomeCents] = useState(0);
  const [currentMonthExpensesCents, setCurrentMonthExpensesCents] = useState(0);
  const [accumulatedBalanceCents, setAccumulatedBalanceCents] = useState(0);
  const [recurringIncomeCents, setRecurringIncomeCents] = useState(0);
  const [recurringExpensesCents, setRecurringExpensesCents] = useState(0);

  const { familyGroupId } = useAccountModal();

  // Persistência local e remota (Supabase)
  const setMonthlyIncomeCents = useCallback((val: number) => {
    setMonthlyIncomeCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_monthly_income", val.toString());
    }
    if (familyGroupId) {
      const supabase = createClient();
      supabase.from("family_groups").update({ monthly_income_cents: val }).eq("id", familyGroupId).then();
    }
  }, [familyGroupId]);

  const setFixedExpensesCents = useCallback((val: number) => {
    setFixedExpensesCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_fixed_expenses", val.toString());
    }
    if (familyGroupId) {
      const supabase = createClient();
      supabase.from("family_groups").update({ fixed_expenses_cents: val }).eq("id", familyGroupId).then();
    }
  }, [familyGroupId]);

  const refreshData = useCallback(async () => {
    if (!familyGroupId) return;

    setLoading(true);
    console.log("LOCAL-FIRST: BUSCANDO ATUALIZAÇÕES DO SUPABASE...");
    const supabase = createClient();
    
    // 1. Buscar Configurações do Grupo Familiar (Modo Crise)
    const { data: familyGroup } = await supabase
      .from("family_groups")
      .select("monthly_income_cents, fixed_expenses_cents, accumulated_balance_cents")
      .eq("id", familyGroupId)
      .single();

    // 2. Buscar Fluxos Recorrentes para somar ao Modo Crise
    const { data: recurringTxs } = await supabase
      .from("recurring_transactions")
      .select("amount_cents, transaction_type")
      .eq("family_group_id", familyGroupId)
      .eq("status", "active");

    const recIncome = recurringTxs
      ?.filter(r => r.transaction_type === "INCOME")
      .reduce((sum, r) => sum + r.amount_cents, 0) || 0;

    const recExpense = recurringTxs
      ?.filter(r => r.transaction_type === "EXPENSE")
      .reduce((sum, r) => sum + r.amount_cents, 0) || 0;

    setRecurringIncomeCents(recIncome);
    setRecurringExpensesCents(recExpense);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_recurring_income", recIncome.toString());
      localStorage.setItem("vesper_recurring_expense", recExpense.toString());
    }
      
    if (familyGroup) {
      if (familyGroup.monthly_income_cents !== null) {
        setMonthlyIncomeCentsState(familyGroup.monthly_income_cents);
        localStorage.setItem("vesper_monthly_income", familyGroup.monthly_income_cents.toString());
      }
      if (familyGroup.fixed_expenses_cents !== null) {
        setFixedExpensesCentsState(familyGroup.fixed_expenses_cents);
        localStorage.setItem("vesper_fixed_expenses", familyGroup.fixed_expenses_cents.toString());
      }
      if (familyGroup.accumulated_balance_cents !== null) {
        setAccumulatedBalanceCents(familyGroup.accumulated_balance_cents);
        localStorage.setItem("vesper_accumulated_balance", familyGroup.accumulated_balance_cents.toString());
      }
    }

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
      .select("id, name, type, balance_cents, credit_limit_cents, closing_day, due_day, color_hex")
      .eq("family_group_id", familyGroupId);

    if (catData) {
      setCategories(catData);
      // Atualizar Banco Local
      await db.categories.bulkPut(catData.map(c => ({ ...c, family_group_id: familyGroupId })));
    }
    
    // Buscar todas as transações do Mês Atual (para extraIncome e currentMonthExpenses)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString();
    
    if (accData && accData.length > 0) {
      const accountIds = accData.map(a => a.id);
      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("amount_cents, transaction_type, account_id, is_legacy_debt")
        .in("account_id", accountIds)
        .gte("date", monthStart)
        .lte("date", monthEnd);
        
      if (monthTxs) {
        // Filtrar as transações que NÃO são de Cartão de Crédito
        const nonCreditCardAccIds = accData.filter(a => a.type !== "CREDIT_CARD").map(a => a.id);
        
        const extraInc = monthTxs
          .filter(tx => tx.transaction_type === "INCOME")
          .reduce((sum, tx) => sum + tx.amount_cents, 0);
          
        const monthExp = monthTxs
          .filter(tx => tx.transaction_type === "EXPENSE" && nonCreditCardAccIds.includes(tx.account_id) && !tx.is_legacy_debt)
          .reduce((sum, tx) => sum + tx.amount_cents, 0);
          
        setExtraIncomeCents(extraInc);
        setCurrentMonthExpensesCents(monthExp);
      }
    } else {
      setExtraIncomeCents(0);
      setCurrentMonthExpensesCents(0);
    }
    
    if (accData) {
      // Calcular Fatura Atual e Impacto no Teto para cada cartão
      const creditCardIds = accData.filter(a => a.type === "CREDIT_CARD").map(a => a.id);
      
      let allInvoices: any[] = [];
      let allUnpaidTxs: any[] = [];

      if (creditCardIds.length > 0) {
        // Busca as faturas reais no banco
        const { data: invoices } = await supabase
          .from("credit_card_invoices")
          .select("*")
          .in("account_id", creditCardIds);
        if (invoices) allInvoices = invoices;

        // Busca apenas transações não pagas para compor o limite utilizado
        const { data: txs } = await supabase
          .from("transactions")
          .select("amount_cents, is_legacy_debt, is_paid, transaction_type, account_id, date, invoice_id")
          .in("account_id", creditCardIds)
          .eq("is_paid", false);
        if (txs) allUnpaidTxs = txs;
      }

      const accountsWithInvoice = await Promise.all(accData.map(async (acc) => {
        if (acc.type === "CREDIT_CARD") {
          const now = new Date();
          const cardClosingDay = acc.closing_day || 31;
          const todayDay = now.getDate();

          let openY = now.getFullYear();
          let openM = now.getMonth();
          let closedY = now.getFullYear();
          let closedM = now.getMonth();

          if (todayDay >= cardClosingDay) {
            closedM = openM; closedY = openY;
            openM++;
            if (openM > 11) { openM = 0; openY++; }
          } else {
            openM = closedM; openY = closedY;
            closedM--;
            if (closedM < 0) { closedM = 11; closedY--; }
          }
          
          // Mês de referência no formato YYYY-MM
          const openRef = `${openY}-${String(openM + 1).padStart(2, '0')}`;
          const closedRef = `${closedY}-${String(closedM + 1).padStart(2, '0')}`;

          const openMonthLabel = format(new Date(openY, openM, 1), "MMM", { locale: ptBR });
          const closedMonthLabel = format(new Date(closedY, closedM, 1), "MMM", { locale: ptBR });

          const cardInvoices = allInvoices.filter(i => i.account_id === acc.id);
          const openInvoiceRecord = cardInvoices.find(i => i.reference_month === openRef);
          const closedInvoiceRecord = cardInvoices.find(i => i.reference_month === closedRef);

          let openInvoiceAmount = openInvoiceRecord ? Number(openInvoiceRecord.amount_cents) : 0;
          let closedInvoiceAmount = closedInvoiceRecord ? Number(closedInvoiceRecord.amount_cents) : 0;

          // Calcular Teto de Gastos e Limite Total a partir das transactions ativas e faturas em si
          let ceilingImpact = 0;
          let totalSpentOnCard = 0;

          const cardTxs = allUnpaidTxs.filter(tx => tx.account_id === acc.id);
          cardTxs.forEach(tx => {
            const isIncome = tx.transaction_type === "INCOME";
            totalSpentOnCard += isIncome ? -tx.amount_cents : tx.amount_cents;

            // Se pertencer à fatura fechada recém ou aberta (simplificado)
            if (tx.invoice_id === closedInvoiceRecord?.id) {
               if (!tx.is_legacy_debt && !isIncome) {
                 ceilingImpact += tx.amount_cents;
               }
            }
          });

          return { 
            ...acc, 
            current_invoice_cents: closedInvoiceAmount > 0 ? closedInvoiceAmount : openInvoiceAmount,
            closed_invoice_cents: closedInvoiceAmount,
            closed_invoice_month: closedMonthLabel,
            open_invoice_cents: openInvoiceAmount,
            open_invoice_month: openMonthLabel,
            ceiling_impact_cents: ceilingImpact,
            balance_cents: -totalSpentOnCard
          };
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

  const toggleTransactionPaid = async (transactionId: string, currentStatus: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ is_paid: !currentStatus })
      .eq("id", transactionId);
    
    if (!error) {
      await refreshData();
    }
  };

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
        setLoading(false);
      }
      
      // Carregar Configurações do Modo Crise do LocalStorage
      if (typeof window !== "undefined") {
        const storedIncome = localStorage.getItem("vesper_monthly_income");
        if (storedIncome) setMonthlyIncomeCentsState(parseInt(storedIncome, 10));
        
        const storedExpenses = localStorage.getItem("vesper_fixed_expenses");
        if (storedExpenses) setFixedExpensesCentsState(parseInt(storedExpenses, 10));
        
        const storedAccumulated = localStorage.getItem("vesper_accumulated_balance");
        if (storedAccumulated) setAccumulatedBalanceCents(parseInt(storedAccumulated, 10));

        const storedRecIncome = localStorage.getItem("vesper_recurring_income");
        if (storedRecIncome) setRecurringIncomeCents(parseInt(storedRecIncome, 10));

        const storedRecExpense = localStorage.getItem("vesper_recurring_expense");
        if (storedRecExpense) setRecurringExpensesCents(parseInt(storedRecExpense, 10));
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
    <FinancialDataContext.Provider value={{ 
      categories, accounts, loading, refreshData, lastFetched,
      monthlyIncomeCents, setMonthlyIncomeCents,
      fixedExpensesCents, setFixedExpensesCents,
      extraIncomeCents, currentMonthExpensesCents, accumulatedBalanceCents,
      recurringIncomeCents, recurringExpensesCents,
      toggleTransactionPaid
    }}>
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
