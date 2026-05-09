"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { financialService } from "@/services/financialService";
import { db, type Account, type Category, type Goal, type RecurringTransaction, type Budget, type FinancialHealthScore } from "@/lib/db";
import { useAccountModal } from "./AccountModalContext";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface IncomeMixItem {
  name: string;
  value: number;
}

export interface NetWorthHistoryItem {
  month: string;
  amount: number;
}

interface GoalRecommendation {
  goal_id: string;
  goal_name: string;
  recommended_amount_cents: number;
  is_full_target: boolean;
}

interface GoalRecommendationsResponse {
  surplus_cents: number;
  remaining_surplus_cents: number;
  recommendations: GoalRecommendation[];
}

interface SimulationResult {
  current_surplus_cents: number;
  simulated_surplus_cents: number;
  status: "SAFE" | "WARNING" | "DANGER";
  message: string;
  impact_percentage: number;
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
  
  extraIncomeCents: number;
  currentMonthExpensesCents: number;
  accumulatedBalanceCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  goals: Goal[];
  recurringTransactions: RecurringTransaction[];
  budgets: Budget[];
  recentTransactions: any[];
  monthTransactions: any[];
  healthScore: FinancialHealthScore | null;
  toggleTransactionPaid: (id: string, status: boolean) => Promise<void>;
  upsertTransaction: (data: any) => Promise<any>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactionSeries: (description: string, total: number, accId: string) => Promise<void>;
  updateTransactionSeries: (description: string, total: number, accId: string, updates: any) => Promise<void>;
  createInstallmentSeries: (data: any) => Promise<void>;
  upsertAccount: (data: any) => Promise<void>;
  upsertGoal: (data: any) => Promise<void>;
  updateGoalBalance: (id: string, amount: number) => Promise<void>;
  simulatePurchaseImpact: (amount: number, installments: number) => Promise<SimulationResult>;
  getGoalRecommendations: () => Promise<GoalRecommendationsResponse>;
  getIncomeMix: () => IncomeMixItem[];
  getNetWorthHistory: () => NetWorthHistoryItem[];
  createTransfer: (fromId: string, toId: string, amountCents: number) => Promise<void>;
}

const FinancialDataContext = createContext<FinancialDataContextType | undefined>(undefined);

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos de cache

export function FinancialDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false); // Começa como false para evitar travamentos se o ID não for resolvido
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Controle interno para o primeiro load
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  
  // Modo Crise: Variáveis Base
  const [monthlyIncomeCents, setMonthlyIncomeCentsState] = useState(0);
  const [fixedExpensesCents, setFixedExpensesCentsState] = useState(0);
  const [extraIncomeCents, setExtraIncomeCents] = useState(0);
  const [currentMonthExpensesCents, setCurrentMonthExpensesCents] = useState(0);
  const [accumulatedBalanceCents, setAccumulatedBalanceCents] = useState(0);
  const [recurringIncomeCents, setRecurringIncomeCents] = useState(0);
  const [recurringExpensesCents, setRecurringExpensesCents] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<any[]>([]);
  const [healthScore, setHealthScore] = useState(0);

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
    if (!familyGroupId) {
      setLoading(false);
      return;
    }

    try {
      if (loading && !isInitialLoading) return; // Evitar chamadas duplicadas
    
    setLoading(true);
    if (isInitialLoading) setIsInitialLoading(false);
      console.log("DATABASE-DRIVEN: BUSCANDO ESTADO GLOBAL VIA RPC...");
      const supabase = createClient();
      
      // 1. Chamar a Função RPC Mestra V5 (Elite Edition)
      console.log("DEBUG-RPC: Chamando get_financial_state_v5 com ID:", familyGroupId);
      
      const { data, error } = await supabase.rpc('get_financial_state_v5', { 
        p_family_group_id: familyGroupId 
      });

      if (error) {
        throw error;
      }

    const state = data as FinancialStateResponse;

    // 2. Atualizar Configurações do Grupo Familiar (Modo Crise)
    if (state.family_group) {
      const { monthly_income_cents, fixed_expenses_cents, accumulated_balance_cents, financial_health_score } = state.family_group;
      
      setMonthlyIncomeCentsState(monthly_income_cents || 0);
      setFixedExpensesCentsState(fixed_expenses_cents || 0);
      setAccumulatedBalanceCents(accumulated_balance_cents || 0);
      setHealthScore(financial_health_score || 0);

      if (typeof window !== "undefined") {
        localStorage.setItem("vesper_monthly_income", (monthly_income_cents || 0).toString());
        localStorage.setItem("vesper_fixed_expenses", (fixed_expenses_cents || 0).toString());
        localStorage.setItem("vesper_accumulated_balance", (accumulated_balance_cents || 0).toString());
        localStorage.setItem("vesper_health_score", (financial_health_score || 0).toString());
      }
    }

    // 3. Processar Fluxos Recorrentes
    const recIncome = state.recurring_transactions
      ?.filter(r => r.transaction_type === "INCOME" && r.status === 'active')
      .reduce((sum, r) => sum + r.amount_cents, 0) || 0;

    const recExpense = state.recurring_transactions
      ?.filter(r => r.transaction_type === "EXPENSE" && r.status === 'active')
      .reduce((sum, r) => sum + r.amount_cents, 0) || 0;

    setRecurringIncomeCents(recIncome);
    setRecurringExpensesCents(recExpense);

    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_recurring_income", recIncome.toString());
      localStorage.setItem("vesper_recurring_expense", recExpense.toString());
    }

    // 4. Atualizar Categorias
    setCategories(state.categories);
    await db.categories.bulkPut(state.categories.map(c => ({ ...c, family_group_id: familyGroupId })));

    // 5. Calcular Métricas do Mês via RPC Stats (Extra Income e Gastos do Mês)
    if (state.month_stats) {
      const extraInc = Number(state.month_stats.income || 0);
      const monthExp = Number(state.month_stats.debit_expense || 0);
        
      setExtraIncomeCents(extraInc);
      setCurrentMonthExpensesCents(monthExp);
    }

    // 6. Sincronizar Entidades com State e Dexie
    setAccounts(state.accounts);
    await db.accounts.bulkPut(state.accounts.map(a => ({ ...a, family_group_id: familyGroupId })));
    
    // 7. Sincronizar Outras Entidades com State e Dexie
    setGoals(state.goals || []);
    setRecurringTransactions(state.recurring_transactions || []);
    setBudgets(state.budgets || []);
    setRecentTransactions(state.recent_transactions || []);
    setMonthTransactions(state.month_transactions || []);

    if (state.goals) await db.goals.bulkPut(state.goals.map(g => ({ ...g, family_group_id: familyGroupId })));
    if (state.recurring_transactions) await db.recurring_transactions.bulkPut(state.recurring_transactions.map(r => ({ ...r, family_group_id: familyGroupId })));
    if (state.budgets) await db.budgets.bulkPut(state.budgets.map(b => ({ ...b, family_group_id: familyGroupId })));

      setLastFetched(Date.now());
    } catch (error: any) {
      console.error("❌ ERRO AO BUSCAR ESTADO FINANCEIRO:", JSON.stringify(error, null, 2));
      console.error("Contexto do Erro:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        familyGroupId
      });
    } finally {
      setLoading(false);
    }
  }, [familyGroupId]);

  const createInstallmentSeries = async (data: any) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('create_installment_series', {
      p_family_group_id: familyGroupId,
      p_description: data.description,
      p_amount_total_cents: data.amount_total_cents,
      p_installments: data.installments,
      p_account_id: data.account_id,
      p_category_id: data.category_id,
      p_start_date: data.date || new Date().toISOString()
    });
    
    if (!error) await refreshData();
    else console.error("Erro ao criar parcelamento:", error);
  };

  const simulatePurchaseImpact = async (amountCents: number): Promise<SimulationResult> => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fn_simulate_spending', {
      p_family_group_id: familyGroupId,
      p_amount_cents: amountCents
    });
    if (error) {
      console.error("❌ Erro na simulação (fn_simulate_spending):", JSON.stringify(error, null, 2));
      console.error("Contexto do Erro:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        familyGroupId,
        amountCents
      });
      return {
        current_surplus_cents: 0,
        simulated_surplus_cents: 0,
        status: "DANGER",
        message: "Erro ao conectar com o simulador.",
        impact_percentage: 0
      };
    }
    return data;
  };

  const getGoalRecommendations = async (): Promise<GoalRecommendationsResponse> => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fn_get_goal_recommendations', {
      p_family_group_id: familyGroupId
    });
    if (error) {
      console.error("❌ Erro ao buscar recomendações (fn_get_goal_recommendations):", JSON.stringify(error, null, 2));
      console.error("Contexto do Erro:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        familyGroupId
      });
      return {
        surplus_cents: 0,
        remaining_surplus_cents: 0,
        recommendations: []
      };
    }
    return data;
  };

  const getIncomeMix = useCallback((): IncomeMixItem[] => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const incomeTransactions = monthTransactions.filter(tx => 
      tx.transaction_type === "INCOME" && 
      new Date(tx.date) >= thirtyDaysAgo
    );

    const mixMap: Record<string, number> = {};
    
    incomeTransactions.forEach(tx => {
      const catName = tx.category?.name || "Outros";
      mixMap[catName] = (mixMap[catName] || 0) + (tx.amount_cents / 100);
    });

    return Object.entries(mixMap).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    }));
  }, [monthTransactions]);

  const getNetWorthHistory = useCallback((): NetWorthHistoryItem[] => {
    const history: NetWorthHistoryItem[] = [];
    const now = new Date();
    
    // 1. Saldo atual total
    let currentTotalCents = accounts.reduce((sum, acc) => sum + (acc.balance_cents || 0), 0);
    
    // 2. Iterar 6 meses para trás
    for (let i = 0; i < 6; i++) {
      const targetMonth = addMonths(now, -i);
      const monthStr = format(targetMonth, "MMM", { locale: ptBR });
      
      // Adicionar ponto atual
      history.unshift({
        month: monthStr,
        amount: Math.round(currentTotalCents / 100)
      });

      // 3. Subtrair o resultado líquido do mês atual para "voltar no tempo"
      const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

      const mTransactions = monthTransactions.filter(tx => {
        const d = new Date(tx.date);
        return d >= monthStart && d <= monthEnd;
      });

      const netChangeCents = mTransactions.reduce((net, tx) => {
        if (tx.transaction_type === "INCOME") return net + tx.amount_cents;
        if (tx.transaction_type === "EXPENSE") return net - tx.amount_cents;
        return net;
      }, 0);

      currentTotalCents -= netChangeCents;
    }

    return history;
  }, [accounts, monthTransactions]);

  const createTransfer = async (fromId: string, toId: string, amountCents: number) => {
    if (!familyGroupId) return;
    const { error } = await financialService.createTransfer({
      family_group_id: familyGroupId,
      from_account_id: fromId,
      to_account_id: toId,
      amount_cents: amountCents
    });
    if (!error) await refreshData();
    return { error };
  };

  const upsertTransaction = async (data: any) => {
    const res = await financialService.upsertTransaction({
      ...data,
      family_group_id: familyGroupId!
    });
    if (!res.error) await refreshData();
    return res;
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await financialService.deleteTransaction(id);
    if (!error) await refreshData();
  };

  const deleteTransactionSeries = async (description: string, total: number, accId: string) => {
    const { error } = await financialService.deleteTransactionSeries(description, total, accId);
    if (!error) await refreshData();
  };

  const updateTransactionSeries = async (description: string, total: number, accId: string, updates: any) => {
    const { error } = await financialService.updateTransactionSeries(description, total, accId, updates);
    if (!error) await refreshData();
  };

  const createInstallmentSeries = async (data: any) => {
    const { error } = await financialService.createInstallmentSeries({
      ...data,
      family_group_id: familyGroupId!
    });
    if (!error) await refreshData();
  };

  const upsertAccount = async (data: any) => {
    const { error } = await financialService.upsertAccount({
      ...data,
      family_group_id: familyGroupId!
    });
    if (!error) await refreshData();
  };

  const upsertGoal = async (data: any) => {
    const { error } = await financialService.upsertGoal({
      ...data,
      family_group_id: familyGroupId!
    });
    if (!error) await refreshData();
  };

  const updateGoalBalance = async (id: string, amount: number) => {
    const { error } = await financialService.updateGoalBalance(id, amount);
    if (!error) await refreshData();
  };

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

  useEffect(() => {
    const loadLocalData = async () => {
      if (!familyGroupId) {
        setLoading(false);
        setIsInitialLoading(false);
        return;
      }
      
      try {
        const localAccounts = await db.accounts.where('family_group_id').equals(familyGroupId).toArray();
        const localCategories = await db.categories.where('family_group_id').equals(familyGroupId).toArray();
        const localGoals = await db.goals.where('family_group_id').equals(familyGroupId).toArray();
        const localRecurring = await db.recurring_transactions.where('family_group_id').equals(familyGroupId).toArray();
        const localBudgets = await db.budgets.where('family_group_id').equals(familyGroupId).toArray();

        if (localAccounts.length > 0 || localCategories.length > 0) {
          console.log("LOCAL-FIRST: DADOS CARREGADOS DO BANCO LOCAL");
          setAccounts(localAccounts as Account[]);
          setCategories(localCategories as Category[]);
          setGoals(localGoals as Goal[]);
          setRecurringTransactions(localRecurring as RecurringTransaction[]);
          setBudgets(localBudgets as Budget[]);
        }
      } catch (err) {
        console.error("ERRO AO CARREGAR DADOS LOCAIS (DEXIE):", err);
      } finally {
        setLoading(false);
        setIsInitialLoading(false);
      }
    };

    // Carregar Configurações do Modo Crise do LocalStorage
    if (typeof window !== "undefined") {
      try {
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
      } catch (err) {
        console.error("ERRO AO CARREGAR LOCALSTORAGE:", err);
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
      goals,
      recurringTransactions,
      budgets,
      recentTransactions,
      monthTransactions,
      getIncomeMix,
      getNetWorthHistory,
      createTransfer,
      upsertTransaction,
      deleteTransaction,
      deleteTransactionSeries,
      updateTransactionSeries,
      upsertAccount,
      upsertGoal,
      updateGoalBalance
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
