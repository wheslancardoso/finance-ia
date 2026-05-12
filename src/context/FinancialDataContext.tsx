"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { financialService } from "@/services/financialService";
import { db, type Account, type Category, type Goal, type RecurringTransaction, type Budget, type FinancialHealthScore, type Transaction } from "@/lib/db";
import { useAccountModal } from "./AccountModalContext";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateTotalConsolidatedDebt, calculateNetLiquidity } from "@/lib/financial-logic";

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
  upsertGoal: (data: Partial<Goal> & { status?: string }) => Promise<any>;
  updateGoalBalance: (id: string, amount: number) => Promise<void>;
  simulatePurchaseImpact: (amount: number) => Promise<SimulationResult>;
  getGoalRecommendations: () => Promise<GoalRecommendationsResponse>;
  getIncomeMix: () => IncomeMixItem[];
  getNetWorthHistory: () => NetWorthHistoryItem[];
  createTransfer: (fromId: string, toId: string, amountCents: number) => Promise<void>;
  primaryIncomeCents: number;
  userId: string | null;
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
  const [primaryIncomeCents, setPrimaryIncomeCents] = useState(0);

  const { userId } = useAccountModal();

  const totalConsolidatedDebtCents = useMemo(() => {
    return calculateTotalConsolidatedDebt(accounts);
  }, [accounts]);

  const netLiquidityCents = useMemo(() => {
    return calculateNetLiquidity(accounts);
  }, [accounts]);

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

  const _applyState = (data: any) => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();
    const endOfMonthDate = new Date(todayYear, todayMonth + 1, 0);
    const endOfMonthDay = endOfMonthDate.getDate();

    // Calcular agendados para este mês
    const schedInc = (data.recurring_transactions || [])
      .filter((r: any) => {
        if (r.transaction_type !== "INCOME" || r.status !== 'active') return false;
        const datePart = typeof r.next_date === 'string' ? r.next_date.split('T')[0] : '';
        const [y, m, d] = datePart.split('-').map(Number);
        return y === todayYear && (m - 1) === todayMonth && d >= todayDay && d <= endOfMonthDay;
      })
      .reduce((sum: number, r: any) => sum + (Number(r.amount_cents) || 0), 0);

    const schedExp = (data.recurring_transactions || [])
      .filter((r: any) => {
        if (r.transaction_type !== "EXPENSE" || r.status !== 'active') return false;
        const datePart = typeof r.next_date === 'string' ? r.next_date.split('T')[0] : '';
        const [y, m, d] = datePart.split('-').map(Number);
        return y === todayYear && (m - 1) === todayMonth && d >= todayDay && d <= endOfMonthDay;
      })
      .reduce((sum: number, r: any) => sum + (Number(r.amount_cents) || 0), 0);

    const recInc = (data.recurring_transactions || [])
      .filter((r: any) => r.transaction_type === "INCOME" && r.status === 'active')
      .reduce((sum: number, r: any) => sum + (Number(r.amount_cents) || 0), 0);

    const recExp = (data.recurring_transactions || [])
      .filter((r: any) => r.transaction_type === "EXPENSE" && r.status === 'active')
      .reduce((sum: number, r: any) => sum + (Number(r.amount_cents) || 0), 0);

    const primaryInc = (data.recurring_transactions || [])
      .filter((r: any) => r.transaction_type === "INCOME" && r.status === 'active' && r.is_primary_income)
      .reduce((sum: number, r: any) => sum + (Number(r.amount_cents) || 0), 0);

    const cardImpact = calculateTotalConsolidatedDebt(data.accounts || []);

    setAccounts(data.accounts || []);
    setCategories(data.categories || []);
    setGoals(data.goals || []);
    setRecurringTransactions(data.recurring_transactions || []);
    setBudgets(data.budgets || []);
    setRecentTransactions([...(data.transactions || [])]);
    setMonthTransactions([...(data.transactions || [])]);
    setScheduledIncomeCents(schedInc);
    setScheduledExpensesCents(schedExp);
    setRecurringIncomeCents(recInc);
    setRecurringExpensesCents(recExp);
    setPrimaryIncomeCents(primaryInc);
    setCardDebtImpactCents(cardImpact);
    
    if (data.user_profile) {
      setMonthlyIncomeCentsState(data.user_profile.monthly_income_cents || 0);
      setFixedExpensesCentsState(data.user_profile.fixed_expenses_cents || 0);
      setHealthScore(data.user_profile.financial_health_score || 0);
      setAccumulatedBalanceCents(data.user_profile.accumulated_balance_cents || 0);
    }
  };

  const refreshData = useCallback(async (force = false) => {
    // 🧪 BYPASS PARA TESTES E2E: Apenas no carregamento inicial para evitar problemas de hidratação.
    // Chamadas subsequentes devem ir para o mock de rede (Playwright) para refletir mudanças.
    if (typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__ && isInitialLoading) {
      const mock = (window as any).__E2E_MOCK_STATE__;
      setLoading(true);
      _applyState(mock);
      setIsInitialLoading(false);
      setLoading(false);
      return;
    }

    if (!userId) {
      setLoading(false);
      // Limpar estados ao deslogar
      setAccounts([]);
      setCategories([]);
      setGoals([]);
      setRecurringTransactions([]);
      setBudgets([]);
      setRecentTransactions([]);
      setMonthTransactions([]);
      setAccumulatedBalanceCents(0);
      setHealthScore(0);
      return;
    }

    try {
      setLoading(true);
      if (isInitialLoading) setIsInitialLoading(false);
      
      const { data, error } = await financialService.getFinancialState(userId);

      if (error) throw error;

      if (!data) {
        setLoading(false);
        return;
      }

      const state = data as FinancialStateResponse;

      // 1. Aplicar estado centralizado (calcula agendados, recorrentes, etc)
      _applyState(state);

      // 2. Métricas adicionais que dependem do state mas não estão no _applyState (ex: stats mensais)
      setExtraIncomeCents(Number(state.month_stats?.income || 0));
      setCurrentMonthExpensesCents(Number(state.month_stats?.debit_expense || 0));

      // 3. Sincronizar Cache de Longo Prazo (localStorage)
      if (typeof window !== "undefined" && state.user_profile) {
        localStorage.setItem("vesper_monthly_income", (state.user_profile.monthly_income_cents || 0).toString());
        localStorage.setItem("vesper_fixed_expenses", (state.user_profile.fixed_expenses_cents || 0).toString());
        localStorage.setItem("vesper_accumulated_balance", (state.user_profile.accumulated_balance_cents || 0).toString());
        localStorage.setItem("vesper_health_score", (state.user_profile.financial_health_score || 0).toString());
      }

      // 5. Sincronizar com Banco de Dados Local (Dexie)
      // Aguardamos a sincronização para garantir que navegações subsequentes encontrem os dados
      await Promise.all([
        db.categories.where('user_id').equals(userId).delete().then(() => 
          db.categories.bulkPut(state.categories.map(c => ({ ...c, user_id: userId })))
        ),
        db.accounts.where('user_id').equals(userId).delete().then(() => 
          db.accounts.bulkPut(state.accounts.map(a => ({ ...a, user_id: userId })))
        ),
        state.goals ? db.goals.where('user_id').equals(userId).delete().then(() => 
          db.goals.bulkPut(state.goals.map(g => ({ ...g, user_id: userId })))
        ) : Promise.resolve(),
        state.recurring_transactions ? db.recurring_transactions.where('user_id').equals(userId).delete().then(() => 
          db.recurring_transactions.bulkPut(state.recurring_transactions.map(r => ({ ...r, user_id: userId })))
        ) : Promise.resolve(),
        state.budgets ? db.budgets.where('user_id').equals(userId).delete().then(() => 
          db.budgets.bulkPut(state.budgets.map(b => ({ ...b, user_id: userId })))
        ) : Promise.resolve(),
        db.transactions.where('user_id').equals(userId).delete().then(() => {
          const allTx = [...(state.recent_transactions || []), ...(state.month_transactions || [])];
          const uniqueTx = Array.from(new Map(allTx.map(t => [t.id, t])).values());
          return db.transactions.bulkPut(uniqueTx.map(t => ({ ...t, user_id: userId })));
        })
      ]).catch(err => console.error("⚠️ Falha na sincronização Dexie:", err));

      setLastFetched(Date.now());
    } catch (error: any) {
      console.error("❌ ERRO AO BUSCAR ESTADO FINANCEIRO, TENTANDO DEXIE:", error);
      
      // Fallback: Busca o estado completo do Dexie
      const { data: localState } = await financialService.getFinancialState(userId);
      
      if (localState) {
        setAccounts(localState.accounts || []);
        setGoals(localState.goals || []);
        setRecurringTransactions(localState.recurring_transactions || []);
        setBudgets(localState.budgets || []);
        setRecentTransactions(localState.recent_transactions || []);
        setMonthTransactions(localState.month_transactions || []);
        
        if (localState.month_stats) {
          setExtraIncomeCents(localState.month_stats.income || 0);
          setCurrentMonthExpensesCents(localState.month_stats.debit_expense || 0);
        }
        
        // Sincronizar acumulado e score via localStorage como fallback
        if (typeof window !== "undefined") {
          const storedBalance = localStorage.getItem("vesper_accumulated_balance");
          const storedScore = localStorage.getItem("vesper_health_score");
          if (storedBalance) setAccumulatedBalanceCents(parseInt(storedBalance));
          if (storedScore) setHealthScore(parseInt(storedScore));
        }
      }
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
    await refreshData();
  };

  const upsertTransaction = async (data: any) => {
    if (!userId) return;
    const res = await financialService.upsertTransaction({
      ...data,
      user_id: userId
    });
    refreshData(); // Background refresh
    return res;
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await financialService.deleteTransaction(id);
    await refreshData();
  };

  const deleteTransactionSeries = async (description: string, total: number, accId: string) => {
    const { error } = await financialService.deleteTransactionSeries(description, total, accId);
    await refreshData();
  };

  const updateTransactionSeries = async (description: string, total: number, accId: string, updates: any) => {
    const { error } = await financialService.updateTransactionSeries(description, total, accId, updates);
    await refreshData();
  };

  const createInstallmentSeries = async (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
  }) => {
    if (!userId) {
      console.warn("⚠️ [Context:FinancialData] Tentativa de criar série de parcelas sem userId identificado.");
      return;
    }
    const { error } = await financialService.createInstallmentSeries({
      ...data,
      user_id: userId
    });
    await refreshData();
  };

  const upsertAccount = async (data: Partial<Account>) => {
    if (!userId) {
      console.warn("⚠️ [Context:FinancialData] Tentativa de upsertAccount sem userId identificado.");
      return;
    }
    const { error } = await financialService.upsertAccount({
      ...data,
      user_id: userId
    });
    refreshData(); // Background refresh
  };

  const deleteAccount = async (id: string) => {
    const { error } = await financialService.deleteAccount(id);
    await refreshData();
  };

  const upsertGoal = async (data: Partial<Goal> & { status?: string }) => {
    if (!userId) {
      console.warn("⚠️ [Context:FinancialData] Tentativa de upsertGoal sem userId identificado.");
      return;
    }
    const res = await financialService.upsertGoal({
      ...data,
      user_id: userId
    });
    refreshData(); // Background refresh
    return res;
  };

  const updateGoalBalance = async (id: string, amount: number) => {
    const { error } = await financialService.updateGoalBalance(id, amount);
    await refreshData();
  };

  const toggleTransactionPaid = async (transactionId: string, currentStatus: boolean) => {
    const { error } = await financialService.toggleTransactionPaid(transactionId, currentStatus);
    await refreshData();
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
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;
    
    if (userId || isE2E) {
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
      toggleTransactionPaid,
      primaryIncomeCents,
      userId
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
