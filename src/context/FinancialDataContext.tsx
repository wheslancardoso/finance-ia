"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { financialService } from "@/services/financialService";
import { db, type Account, type Category, type Goal, type RecurringTransaction, type Budget, type FinancialHealthScore, type Transaction } from "@/lib/db";
import { useAccountModal } from "./AccountModalContext";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialStateResponse {
  user_profile: {
    monthly_income_cents: number;
    fixed_expenses_cents: number;
    accumulated_balance_cents: number;
    financial_health_score: number;
  };
  categories: Category[];
  accounts: Account[];
  goals: Goal[];
  recurring_transactions: RecurringTransaction[];
  budgets: Budget[];
  recent_transactions: Transaction[];
  month_transactions: Transaction[];
  month_stats: {
    income: number;
    debit_expense: number;
    credit_expense: number;
    investments: number;
  };
}

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
  advice: string;
}

interface GoalRecommendationsResponse {
  surplus_cents: number;
  real_surplus_cents: number;
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
  recentTransactions: Transaction[];
  monthTransactions: Transaction[];
  transactions: Transaction[];
  healthScore: number;
  scheduledIncomeCents: number;
  scheduledExpensesCents: number;
  cardDebtImpactCents: number;
  totalConsolidatedDebtCents: number;
  netLiquidityCents: number;
  toggleTransactionPaid: (id: string, status: boolean) => Promise<void>;
  upsertTransaction: (data: Partial<Transaction>) => Promise<any>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactionSeries: (description: string, total: number, accId: string) => Promise<void>;
  updateTransactionSeries: (description: string, total: number, accId: string, updates: Partial<Transaction>) => Promise<void>;
  createInstallmentSeries: (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
  }) => Promise<void>;
  upsertAccount: (data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  upsertGoal: (data: Partial<Goal> & { status?: string }) => Promise<void>;
  updateGoalBalance: (id: string, amount: number) => Promise<void>;
  simulatePurchaseImpact: (amount: number) => Promise<SimulationResult>;
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
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  
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
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [healthScore, setHealthScore] = useState<number>(0);
  const [scheduledIncomeCents, setScheduledIncomeCents] = useState(0);
  const [scheduledExpensesCents, setScheduledExpensesCents] = useState(0);
  const [cardDebtImpactCents, setCardDebtImpactCents] = useState(0);

  const { userId } = useAccountModal();

  const totalConsolidatedDebtCents = useMemo(() => {
    return accounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((sum, a) => sum + (a.closed_invoice_cents || 0) + (a.open_invoice_cents || 0), 0);
  }, [accounts]);

  const netLiquidityCents = useMemo(() => {
    return accumulatedBalanceCents - totalConsolidatedDebtCents;
  }, [accumulatedBalanceCents, totalConsolidatedDebtCents]);

  const setMonthlyIncomeCents = useCallback((val: number) => {
    setMonthlyIncomeCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_monthly_income", val.toString());
    }
  }, []);

  const setFixedExpensesCents = useCallback((val: number) => {
    setFixedExpensesCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_fixed_expenses", val.toString());
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      if (loading && !isInitialLoading) return;
    
      setLoading(true);
      if (isInitialLoading) setIsInitialLoading(false);
      
      console.log("🔄 [Context:FinancialData] Iniciando sincronização para o usuário:", userId);
      const { data, error } = await financialService.getFinancialState(userId);

      if (error) throw error;

      const state = data as FinancialStateResponse;
      console.log("📦 [Context:FinancialData] Estado recebido do backend:", {
        accounts: state.accounts?.length,
        recurring: state.recurring_transactions?.length,
        goals: state.goals?.length
      });

      if (state.user_profile) {
        const { monthly_income_cents, fixed_expenses_cents, accumulated_balance_cents, financial_health_score } = state.user_profile;
        
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

      const recIncome = state.recurring_transactions
        ?.filter((r: RecurringTransaction) => r.transaction_type === "INCOME" && r.status === 'active')
        .reduce((sum: number, r: RecurringTransaction) => sum + r.amount_cents, 0) || 0;

      const recExpense = state.recurring_transactions
        ?.filter((r: RecurringTransaction) => r.transaction_type === "EXPENSE" && r.status === 'active')
        .reduce((sum: number, r: RecurringTransaction) => sum + r.amount_cents, 0) || 0;

      setRecurringIncomeCents(recIncome);
      setRecurringExpensesCents(recExpense);

      if (typeof window !== "undefined") {
        localStorage.setItem("vesper_recurring_income", recIncome.toString());
        localStorage.setItem("vesper_recurring_expense", recExpense.toString());
      }

      setCategories(state.categories);
      await db.categories.where('user_id').equals(userId).delete();
      await db.categories.bulkPut(state.categories.map((c: Category) => ({ ...c, user_id: userId })));

      if (state.month_stats) {
        const extraInc = Number(state.month_stats.income || 0);
        const monthExp = Number(state.month_stats.debit_expense || 0);
          
        setExtraIncomeCents(extraInc);
        setCurrentMonthExpensesCents(monthExp);
      }

      setAccounts(state.accounts);
      await db.accounts.where('user_id').equals(userId).delete();
      await db.accounts.bulkPut(state.accounts.map((a: Account) => ({ ...a, user_id: userId })));
      
      setGoals(state.goals || []);
      setRecurringTransactions(state.recurring_transactions || []);
      setBudgets(state.budgets || []);
      setRecentTransactions(state.recent_transactions || []);
      setMonthTransactions(state.month_transactions || []);

      if (state.goals) {
        await db.goals.where('user_id').equals(userId).delete();
        await db.goals.bulkPut(state.goals.map((g: Goal) => ({ ...g, user_id: userId })));
      }
      if (state.recurring_transactions) {
        await db.recurring_transactions.where('user_id').equals(userId).delete();
        await db.recurring_transactions.bulkPut(state.recurring_transactions.map((r: RecurringTransaction) => ({ ...r, user_id: userId })));
      }
      if (state.budgets) {
        await db.budgets.where('user_id').equals(userId).delete();
        await db.budgets.bulkPut(state.budgets.map((b: Budget) => ({ ...b, user_id: userId })));
      }
      
      // Cálculos de Agendados e Cartão para o mês atual
      const now = new Date();
      const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const schedInc = (state.recurring_transactions || [])
        .filter(r => r.transaction_type === "INCOME" && r.status === 'active' && new Date(r.next_date) <= endOfThisMonth && new Date(r.next_date) >= now)
        .reduce((sum, r) => sum + r.amount_cents, 0);

      const schedExp = (state.recurring_transactions || [])
        .filter(r => r.transaction_type === "EXPENSE" && r.status === 'active' && new Date(r.next_date) <= endOfThisMonth && new Date(r.next_date) >= now)
        .reduce((sum, r) => sum + r.amount_cents, 0);

      const cardImpact = (state.accounts || [])
        .filter(a => a.type === "CREDIT_CARD")
        .reduce((sum, a) => sum + (a.closed_invoice_cents || 0) + (a.open_invoice_cents || 0), 0);

      setScheduledIncomeCents(schedInc);
      setScheduledExpensesCents(schedExp);
      setCardDebtImpactCents(cardImpact);

      if (state.recent_transactions || state.month_transactions) {
        await db.transactions.where('user_id').equals(userId).delete();
        if (state.recent_transactions) {
          await db.transactions.bulkPut(state.recent_transactions.map((t: any) => ({ ...t, user_id: userId })));
        }
        if (state.month_transactions) {
          await db.transactions.bulkPut(state.month_transactions.map((t: any) => ({ ...t, user_id: userId })));
        }
      }

      setLastFetched(Date.now());
    } catch (error: any) {
      console.error("❌ ERRO AO BUSCAR ESTADO FINANCEIRO:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const simulatePurchaseImpact = async (amountCents: number): Promise<SimulationResult> => {
    if (!userId) return {
      current_surplus_cents: 0,
      simulated_surplus_cents: 0,
      status: "DANGER",
      message: "Usuário não identificado.",
      impact_percentage: 0
    };
    const { data, error } = await financialService.simulatePurchaseImpact(userId, amountCents);
    if (error || !data) return {
      current_surplus_cents: 0,
      simulated_surplus_cents: 0,
      status: "DANGER",
      message: "Erro ao conectar com o simulador.",
      impact_percentage: 0
    };
    return data as SimulationResult;
  };

  const getGoalRecommendations = async (): Promise<GoalRecommendationsResponse> => {
    if (!userId) return { surplus_cents: 0, real_surplus_cents: 0, recommendations: [] };
    const { data, error } = await financialService.getGoalRecommendations(userId);
    if (error || !data) return { surplus_cents: 0, real_surplus_cents: 0, recommendations: [] };
    return data as GoalRecommendationsResponse;
  };

  const getIncomeMix = useCallback((): IncomeMixItem[] => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const incomeTransactions = monthTransactions.filter(tx => 
      tx.transaction_type === "INCOME" && 
      new Date(tx.date) >= thirtyDaysAgo
    );

    const mixMap: Record<string, number> = {};
    
    incomeTransactions.forEach((tx: Transaction) => {
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
    
    let currentTotalCents = accounts.reduce((sum: number, acc: Account) => sum + (acc.balance_cents || 0), 0);
    
    for (let i = 0; i < 6; i++) {
      const targetMonth = addMonths(now, -i);
      const monthStr = format(targetMonth, "MMM", { locale: ptBR });
      
      history.unshift({
        month: monthStr,
        amount: Math.round(currentTotalCents / 100)
      });

      const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

      const mTransactions = monthTransactions.filter((tx: any) => {
        const d = new Date(tx.date);
        return d >= monthStart && d <= monthEnd;
      });

      const netChangeCents = mTransactions.reduce((net: number, tx: any) => {
        if (tx.transaction_type === "INCOME") return net + tx.amount_cents;
        if (tx.transaction_type === "EXPENSE") return net - tx.amount_cents;
        return net;
      }, 0);

      currentTotalCents -= netChangeCents;
    }

    return history;
  }, [accounts, monthTransactions]);

  const createTransfer = async (fromId: string, toId: string, amountCents: number) => {
    if (!userId) return;
    const { error } = await financialService.createTransfer({
      user_id: userId,
      from_account_id: fromId,
      to_account_id: toId,
      amount_cents: amountCents
    });
    if (!error) await refreshData();
  };

  const upsertTransaction = async (data: any) => {
    if (!userId) return;
    const res = await financialService.upsertTransaction({
      ...data,
      user_id: userId
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

  const createInstallmentSeries = async (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
  }) => {
    if (!userId) return;
    const { error } = await financialService.createInstallmentSeries({
      ...data,
      user_id: userId
    });
    if (!error) await refreshData();
  };

  const upsertAccount = async (data: Partial<Account>) => {
    if (!userId) return;
    const { error } = await financialService.upsertAccount({
      ...data,
      user_id: userId
    });
    if (!error) await refreshData();
  };

  const deleteAccount = async (id: string) => {
    const { error } = await financialService.deleteAccount(id);
    if (!error) await refreshData();
  };

  const upsertGoal = async (data: Partial<Goal> & { status?: string }) => {
    if (!userId) return;
    const { error } = await financialService.upsertGoal({
      ...data,
      user_id: userId
    });
    if (!error) await refreshData();
  };

  const updateGoalBalance = async (id: string, amount: number) => {
    const { error } = await financialService.updateGoalBalance(id, amount);
    if (!error) await refreshData();
  };

  const toggleTransactionPaid = async (transactionId: string, currentStatus: boolean) => {
    const { error } = await financialService.toggleTransactionPaid(transactionId, currentStatus);
    if (!error) {
      await refreshData();
    }
  };

  useEffect(() => {
    const loadLocalData = async () => {
      if (!userId) {
        setLoading(false);
        setIsInitialLoading(false);
        return;
      }
      
      try {
        const localAccounts = await db.accounts.where('user_id').equals(userId).toArray();
        const localCategories = await db.categories.where('user_id').equals(userId).toArray();
        const localGoals = await db.goals.where('user_id').equals(userId).toArray();
        const localRecurring = await db.recurring_transactions.where('user_id').equals(userId).toArray();
        const localBudgets = await db.budgets.where('user_id').equals(userId).toArray();

        if (localAccounts.length > 0 || localCategories.length > 0) {
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
  }, [userId]);

  useEffect(() => {
    if (userId) {
      const now = Date.now();
      const isExpired = !lastFetched || (now - lastFetched > CACHE_DURATION);
      
      if (isExpired) {
        refreshData();
      }
    }
  }, [userId, lastFetched, refreshData]);

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
      transactions: monthTransactions,
      getIncomeMix,
      getNetWorthHistory,
      createTransfer,
      upsertTransaction,
      deleteTransaction,
      deleteTransactionSeries,
      updateTransactionSeries,
      upsertAccount,
      deleteAccount,
      upsertGoal,
      updateGoalBalance,
      healthScore,
      scheduledIncomeCents,
      scheduledExpensesCents,
      cardDebtImpactCents,
      totalConsolidatedDebtCents,
      netLiquidityCents,
      createInstallmentSeries,
      simulatePurchaseImpact,
      getGoalRecommendations,
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
