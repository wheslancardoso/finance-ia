"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { financialService } from "@/services/financialService";
import { db, type Account, type Category, type Goal, type RecurringTransaction, type Budget, type FinancialHealthScore, type Transaction } from "@/lib/db";
import { useAccountModal } from "./AccountModalContext";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  calculateTotalConsolidatedDebt, 
  calculateNetLiquidity,
  calculateScheduledIncome,
  calculateScheduledExpenses,
  calculateRecurringIncome,
  calculateRecurringExpenses,
  calculatePrimaryIncome
} from "@/domain/financial/financial-logic";

interface FinancialStateResponse {
  user_profile: {
    monthly_income_cents: number;
    fixed_expenses_cents: number;
    accumulated_balance_cents: number;
    financial_health_score: number;
    gamification_enabled?: boolean;
  };
  categories: Category[];
  accounts: Account[];
  goals: Goal[];
  recurring_transactions: RecurringTransaction[];
  budgets: Budget[];
  recent_transactions: Transaction[];
  month_transactions: Transaction[];
  future_transactions: Transaction[];
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
  survivalReserveCents: number;
  setSurvivalReserveCents: (val: number) => void;
  weeklyLimitOverrideCents: number;
  setWeeklyLimitOverrideCents: (val: number) => void;
  
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
  futureTransactions: Transaction[];
  allTransactions: Transaction[];
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
    starting_installment?: number;
    is_third_party?: boolean;
    third_party_name?: string | null;
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
  skipRecurringOccurrence: (recurringId: string, monthKey: string) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  payRecurringOccurrence: (recurringId: string) => Promise<void>;
  primaryIncomeCents: number;
  userId: string | null;
  isGamificationEnabled: boolean;
  setGamificationEnabled: (val: boolean) => void;
}

export const FinancialDataContext = createContext<FinancialDataContextType | undefined>(undefined);

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos de cache

export function FinancialDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  
  const [monthlyIncomeCents, setMonthlyIncomeCentsState] = useState(0);
  const [fixedExpensesCents, setFixedExpensesCentsState] = useState(0);
  const [survivalReserveCents, setSurvivalReserveCentsState] = useState(0);
  const [weeklyLimitOverrideCents, setWeeklyLimitOverrideCentsState] = useState(0);
  const [extraIncomeCents, setExtraIncomeCents] = useState(0);
  const [currentMonthExpensesCents, setCurrentMonthExpensesCents] = useState(0);
  const [accumulatedBalanceCents, setAccumulatedBalanceCents] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [futureTransactions, setFutureTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [healthScore, setHealthScore] = useState<number>(0);

  const { userId: rawUserId } = useAccountModal();
  const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;
  const userId = rawUserId || (isE2E ? "e2e-user" : null);

  const totalConsolidatedDebtCents = useMemo(() => {
    return calculateTotalConsolidatedDebt(accounts);
  }, [accounts]);

  const netLiquidityCents = useMemo(() => {
    return calculateNetLiquidity(accounts);
  }, [accounts]);

  const scheduledIncomeCents = useMemo(() => {
    return calculateScheduledIncome(recurringTransactions);
  }, [recurringTransactions]);

  const scheduledExpensesCents = useMemo(() => {
    return calculateScheduledExpenses(recurringTransactions);
  }, [recurringTransactions]);

  const recurringIncomeCents = useMemo(() => {
    return calculateRecurringIncome(recurringTransactions);
  }, [recurringTransactions]);

  const recurringExpensesCents = useMemo(() => {
    return calculateRecurringExpenses(recurringTransactions);
  }, [recurringTransactions]);

  const primaryIncomeCents = useMemo(() => {
    return calculatePrimaryIncome(recurringTransactions);
  }, [recurringTransactions]);

  const cardDebtImpactCents = useMemo(() => {
    return calculateTotalConsolidatedDebt(accounts);
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

  const setSurvivalReserveCents = useCallback((val: number) => {
    setSurvivalReserveCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_survival_reserve", val.toString());
    }
  }, []);

  const setWeeklyLimitOverrideCents = useCallback((val: number) => {
    setWeeklyLimitOverrideCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_weekly_limit_override", val.toString());
    }
  }, []);

  const [isGamificationEnabled, setIsGamificationEnabledState] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vesper_gamification_enabled");
      if (saved !== null) {
        setIsGamificationEnabledState(saved === "true");
      }
    }
  }, []);

  const setGamificationEnabled = useCallback((val: boolean) => {
    setIsGamificationEnabledState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_gamification_enabled", val ? "true" : "false");
    }
    if (userId) {
      financialService.upsertUserProfile({
        id: userId,
        gamification_enabled: val
      });
    }
  }, [userId]);


  const _applyState = (data: any) => {
    const recurring = data.recurring_transactions || [];
    const accounts = data.accounts || [];

    setAccounts(accounts);
    setCategories(data.categories || []);
    setGoals(data.goals || []);
    setRecurringTransactions(recurring);
    setBudgets(data.budgets || []);
    setRecentTransactions([...(data.recent_transactions || data.transactions || [])]);
    setMonthTransactions([...(data.month_transactions || data.transactions || [])]);
    setFutureTransactions([...(data.future_transactions || [])]);
    
    const allTx = [
      ...(data.recent_transactions || data.transactions || []),
      ...(data.month_transactions || []),
      ...(data.future_transactions || [])
    ];
    const uniqueTx = Array.from(new Map(allTx.map(t => [t.id, t])).values());
    setAllTransactions(uniqueTx);
    
    if (data.user_profile) {
      setMonthlyIncomeCentsState(data.user_profile.monthly_income_cents || 0);
      setFixedExpensesCentsState(data.user_profile.fixed_expenses_cents || 0);
      setHealthScore(data.user_profile.financial_health_score || 0);
      setAccumulatedBalanceCents(data.user_profile.accumulated_balance_cents || 0);
      if (data.user_profile.gamification_enabled !== undefined) {
        setIsGamificationEnabledState(data.user_profile.gamification_enabled);
        if (typeof window !== "undefined") {
          localStorage.setItem("vesper_gamification_enabled", data.user_profile.gamification_enabled ? "true" : "false");
        }
      }
    }
  };

  const refreshData = useCallback(async (force = false) => {
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;

    if (!userId && !isE2E) {
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
      
      const { data, error } = await financialService.getFinancialState(userId!);

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
        db.categories.where('user_id').equals(userId!).delete().then(() => 
          db.categories.bulkPut(state.categories.map(c => ({ ...c, user_id: userId! })))
        ),
        db.accounts.where('user_id').equals(userId!).delete().then(() => 
          db.accounts.bulkPut(state.accounts.map(a => ({ ...a, user_id: userId! })))
        ),
        state.goals ? db.goals.where('user_id').equals(userId!).delete().then(() => 
          db.goals.bulkPut(state.goals.map(g => ({ ...g, user_id: userId! })))
        ) : Promise.resolve(),
        state.recurring_transactions ? db.recurring_transactions.where('user_id').equals(userId!).delete().then(() => 
          db.recurring_transactions.bulkPut(state.recurring_transactions.map(r => ({ ...r, user_id: userId! })))
        ) : Promise.resolve(),
        state.budgets ? db.budgets.where('user_id').equals(userId!).delete().then(() => 
          db.budgets.bulkPut(state.budgets.map(b => ({ ...b, user_id: userId! })))
        ) : Promise.resolve(),
        // Transações: preservar pendentes de sincronização offline antes de apagar
        (async () => {
          const pendingTx = await db.transactions
            .where('user_id').equals(userId!)
            .filter(t => (t as any).sync_status === 'pending')
            .toArray();

          await db.transactions.where('user_id').equals(userId!).delete();

          const allTx = [
            ...(state.recent_transactions || []), 
            ...(state.month_transactions || []),
            ...(state.future_transactions || [])
          ];
          const uniqueTx = Array.from(new Map(allTx.map(t => [t.id, t])).values());
          await db.transactions.bulkPut(uniqueTx.map(t => ({ ...t, user_id: userId! })));

          // Re-inserir transações pendentes de sincronização que foram salvas offline
          if (pendingTx.length > 0) {
            await db.transactions.bulkPut(pendingTx);
            console.log(`🔄 ${pendingTx.length} transação(ões) offline preservada(s) durante sync.`);
          }
        })()
      ]).catch(err => console.error("⚠️ Falha na sincronização Dexie:", err));

      setLastFetched(Date.now());
    } catch (error: any) {
      console.error("❌ ERRO AO BUSCAR ESTADO FINANCEIRO, TENTANDO DEXIE:", error);
      
      // Fallback: Busca o estado completo do Dexie
      const { data: localState } = await financialService.getFinancialState(userId!);
      
      if (localState) {
        setAccounts(localState.accounts || []);
        setGoals(localState.goals || []);
        setRecurringTransactions(localState.recurring_transactions || []);
        setBudgets(localState.budgets || []);
        setRecentTransactions(localState.recent_transactions || []);
        setMonthTransactions(localState.month_transactions || []);
        setFutureTransactions(localState.future_transactions || []);
        
        const allTx = [
          ...(localState.recent_transactions || []),
          ...(localState.month_transactions || []),
          ...(localState.future_transactions || [])
        ];
        const uniqueTx = Array.from(new Map(allTx.map(t => [t.id, t])).values());
        setAllTransactions(uniqueTx);
        
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

  const upsertTransaction = useCallback(async (data: Partial<Transaction>) => {
    if (!userId) return;
    setLoading(true);
    const res = await financialService.upsertTransaction({ ...data, user_id: userId });
    await refreshData();
    setLoading(false);
    return res;
  }, [userId, refreshData]);

  const skipRecurringOccurrence = useCallback(async (recurringId: string, monthKey: string) => {
    setLoading(true);
    await financialService.skipRecurringOccurrence(recurringId, monthKey);
    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const deleteRecurringTransaction = useCallback(async (id: string) => {
    setLoading(true);
    await financialService.deleteRecurringTransaction(id);
    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const payRecurringOccurrence = useCallback(async (recurringId: string) => {
    setLoading(true);
    await financialService.payRecurringOccurrence(recurringId);
    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await financialService.deleteTransaction(id);
    await refreshData();
  }, [refreshData]);

  const deleteTransactionSeries = useCallback(async (description: string, total: number, accId: string) => {
    const { error } = await financialService.deleteTransactionSeries(description, total, accId);
    await refreshData();
  }, [refreshData]);

  const updateTransactionSeries = useCallback(async (description: string, total: number, accId: string, updates: any) => {
    const { error } = await financialService.updateTransactionSeries(description, total, accId, updates);
    await refreshData();
  }, [refreshData]);

  const createInstallmentSeries = useCallback(async (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
    starting_installment?: number;
    is_third_party?: boolean;
    third_party_name?: string | null;
  }) => {
    if (!userId) return;
    await financialService.createInstallmentSeries({
      ...data,
      user_id: userId
    });
    await refreshData();
  }, [userId, refreshData]);

  const upsertAccount = useCallback(async (data: Partial<Account>) => {
    if (!userId) return;
    await financialService.upsertAccount({
      ...data,
      user_id: userId
    });
    await refreshData();
  }, [userId, refreshData]);

  const deleteAccount = useCallback(async (id: string) => {
    await financialService.deleteAccount(id);
    await refreshData();
  }, [refreshData]);

  const upsertGoal = useCallback(async (data: Partial<Goal> & { status?: string }) => {
    if (!userId) return;
    const res = await financialService.upsertGoal({
      ...data,
      user_id: userId
    });
    await refreshData();
    return res;
  }, [userId, refreshData]);

  const updateGoalBalance = useCallback(async (id: string, amount: number) => {
    await financialService.updateGoalBalance(id, amount);
    await refreshData();
  }, [refreshData]);

  const toggleTransactionPaid = useCallback(async (transactionId: string, currentStatus: boolean) => {
    await financialService.toggleTransactionPaid(transactionId, currentStatus);
    await refreshData();
  }, [refreshData]);

  // 1. Carregar preferências do LocalStorage (Apenas uma vez no mount)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedIncome = localStorage.getItem("vesper_monthly_income");
        if (storedIncome) setMonthlyIncomeCentsState(parseInt(storedIncome, 10));
        
        const storedExpenses = localStorage.getItem("vesper_fixed_expenses");
        if (storedExpenses) setFixedExpensesCentsState(parseInt(storedExpenses, 10));
        
        const storedAccumulated = localStorage.getItem("vesper_accumulated_balance");
        if (storedAccumulated) setAccumulatedBalanceCents(parseInt(storedAccumulated, 10));

        const storedReserve = localStorage.getItem("vesper_survival_reserve");
        if (storedReserve) setSurvivalReserveCentsState(parseInt(storedReserve, 10));

        const storedWeeklyLimit = localStorage.getItem("vesper_weekly_limit_override");
        if (storedWeeklyLimit) setWeeklyLimitOverrideCentsState(parseInt(storedWeeklyLimit, 10));
      } catch (err) {
        console.error("ERRO AO CARREGAR LOCALSTORAGE:", err);
      }
    }
  }, []);

  // 2. Carregar dados locais do IndexedDB (Quando o usuário muda)
  useEffect(() => {
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;
    
    const loadLocalData = async () => {
      if (!userId || isE2E) {
        setLoading(false);
        setIsInitialLoading(false);
        return;
      }

      // Evitar recarregar se já carregamos para este usuário nesta instância
      if (loadedUserIdRef.current === userId) {
        return;
      }
      
      try {
        const localAccounts = await db.accounts.where('user_id').equals(userId).toArray();
        const localCategories = await db.categories.where('user_id').equals(userId).toArray();
        const localGoals = await db.goals.where('user_id').equals(userId).toArray();
        const localRecurring = await db.recurring_transactions.where('user_id').equals(userId).toArray();
        const localBudgets = await db.budgets.where('user_id').equals(userId).toArray();

        // Só atualizamos se houver dados para evitar loops se o estado inicial for igual
        if (localAccounts.length > 0) setAccounts(localAccounts as Account[]);
        if (localCategories.length > 0) setCategories(localCategories as Category[]);
        if (localGoals.length > 0) setGoals(localGoals as Goal[]);
        if (localRecurring.length > 0) setRecurringTransactions(localRecurring as RecurringTransaction[]);
        if (localBudgets.length > 0) setBudgets(localBudgets as Budget[]);
        
        loadedUserIdRef.current = userId;
      } catch (err) {
        console.error("ERRO AO CARREGAR DADOS LOCAIS (DEXIE):", err);
      } finally {
        setLoading(false);
        setIsInitialLoading(false);
      }
    };

    loadLocalData();
  }, [userId]);

  useEffect(() => {
    const handleOnline = async () => {
      console.log("🌐 Conexão restaurada! Sincronizando transações offline...");
      try {
        const pendingTx = await db.transactions
          .filter(t => (t as any).sync_status === 'pending')
          .toArray();

        if (pendingTx.length > 0) {
          console.log(`Encontradas ${pendingTx.length} transações pendentes de sincronização.`);
          for (const tx of pendingTx) {
            const payload = { ...tx };
            delete (payload as any).sync_status;
            
            const response = await fetch("/api/transactions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });
            
            if (response.ok) {
              const saved = await response.json();
              await db.transactions.put({ ...tx, ...saved, sync_status: undefined });
              console.log(`✅ Transação offline ${tx.id} sincronizada com sucesso!`);
            }
          }
          refreshData();
        }
      } catch (err) {
        console.error("Erro ao sincronizar transações offline:", err);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener('online', handleOnline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [refreshData]);

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

  const contextValue = useMemo(() => ({ 
    categories, accounts, loading, refreshData, lastFetched,
    monthlyIncomeCents, setMonthlyIncomeCents,
    fixedExpensesCents, setFixedExpensesCents,
    survivalReserveCents, setSurvivalReserveCents,
    weeklyLimitOverrideCents, setWeeklyLimitOverrideCents,
    extraIncomeCents, currentMonthExpensesCents, accumulatedBalanceCents,
    recurringIncomeCents, recurringExpensesCents,
    goals,
    recurringTransactions,
    budgets,
    recentTransactions,
    monthTransactions,
    futureTransactions,
    allTransactions,
    transactions: monthTransactions,
    getIncomeMix,
    getNetWorthHistory,
    createTransfer,
    skipRecurringOccurrence,
    deleteRecurringTransaction,
    payRecurringOccurrence,
    upsertTransaction,
    primaryIncomeCents,
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
    userId,
    isGamificationEnabled,
    setGamificationEnabled
  }), [
    categories, accounts, loading, refreshData, lastFetched,
    monthlyIncomeCents, setMonthlyIncomeCents,
    fixedExpensesCents, setFixedExpensesCents,
    survivalReserveCents, setSurvivalReserveCents,
    weeklyLimitOverrideCents, setWeeklyLimitOverrideCents,
    extraIncomeCents, currentMonthExpensesCents, accumulatedBalanceCents,
    recurringIncomeCents, recurringExpensesCents,
    goals,
    recurringTransactions,
    budgets,
    recentTransactions,
    monthTransactions,
    futureTransactions,
    allTransactions,
    getIncomeMix,
    getNetWorthHistory,
    createTransfer,
    skipRecurringOccurrence,
    deleteRecurringTransaction,
    payRecurringOccurrence,
    upsertTransaction,
    primaryIncomeCents,
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
    userId,
    isGamificationEnabled,
    setGamificationEnabled
  ]);

  return (
    <FinancialDataContext.Provider value={contextValue}>
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
