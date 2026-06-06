
import { useMemo, useCallback } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { financialService } from "@/services/financialService";
import { 
  calculateNetLiquidity, 
  calculateMonthlyOutlook, 
  calculateTotalConsolidatedDebt,
  calculateAccumulatedBalance,
  calculateRealCycleLiquidity,
  calculateLoanInstallment,
  type MonthlyOutlook,
  calculateDebtExitProjection,
  type DebtExitProjection,
  calculateWeeklySurvival,
  type WeeklySurvival,
  calculateGoalProjections,
  type GoalProjection,
  simulateDetailedImpact,
  type SimulationDetailedResult,
  calculateAdvancedProjection,
  type Simulation
} from "@/domain/financial/financial-logic";

export type { SimulationDetailedResult, MonthlyOutlook, DebtExitProjection, GoalProjection };

export interface FinancialAnalysis {
  netLiquidityCents: number;
  totalConsolidatedDebtCents: number;
  accumulatedBalanceCents: number;
  startingBalanceCents: number;
  checkingBalanceCents: number;
  creditCardUsedCents: number;
  monthlyOutlook: MonthlyOutlook;
  healthScore: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  isSurvivalMode: boolean;
  isCrisisMode: boolean;
  debtExit: DebtExitProjection;
  weeklySurvival: WeeklySurvival;
  goalProjections: GoalProjection[];
  simulateDetailedImpact: (
    amountCents: number, 
    installments: number, 
    type?: "EXPENSE" | "INCOME",
    loanInstallmentCents?: number,
    loanInstallmentsCount?: number
  ) => SimulationDetailedResult;
  analyzeSimulationIA: (simulation: any) => Promise<string>;
  solveFinancialDilemma: (dilemmaText: string) => Promise<{ advice: string; simulations: any[] }>;
  optimizeSweepIA: () => Promise<{ advice: string; suggested_simulation: any }>;
  consultJarvisIA: (simulation?: any) => Promise<{ advice: string; suggested_loan_amount_cents: number; loan_verdict: string; postponement_tips: string[] }>;
}

/**
 * Hook de "Ponte de Dados": Consolida a inteligência financeira do sistema.
 * Use este hook em qualquer página ou componente para obter diagnósticos consistentes.
 */
export function useFinancialAnalysis(monthOffset: number = 0, activeSimulations: Simulation[] = []): FinancialAnalysis {
  const { 
    accounts, 
    scheduledIncomeCents, 
    scheduledExpensesCents, 
    budgets,
    goals,
    recurringIncomeCents,
    recurringExpensesCents,
    healthScore,
    monthTransactions,
    futureTransactions,
    recurringTransactions,
    survivalReserveCents,
    weeklyLimitOverrideCents
  } = useFinancialData();

  const netLiquidity = useMemo(() => calculateNetLiquidity(accounts), [accounts]);
  const consolidatedDebt = useMemo(() => calculateTotalConsolidatedDebt(accounts), [accounts]);
  const currentAssets = useMemo(() => calculateAccumulatedBalance(accounts), [accounts]);

  // Liquidez de Ciclo Real: Saldo - Dívidas - Despesas Pendentes de Maio
  const realCycleLiquidity = useMemo(() => 
    calculateRealCycleLiquidity({
      accounts,
      currentMonthTransactions: monthTransactions
    }), [accounts, monthTransactions]);

  const monthlyOutlook = useMemo(() => {
    // Se já há renda confirmada no mês (is_paid: true), não projetar renda agendada para evitar double-count
    const confirmedIncomeThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const incomeForOutlook = confirmedIncomeThisMonth > 0 ? 0 : scheduledIncomeCents;

    const baseOutlook = calculateMonthlyOutlook({
      accounts,
      scheduledIncomeCents: incomeForOutlook,
      scheduledExpensesCents: scheduledExpensesCents,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset,
      activeSimulations,
      futureTransactions,
      allTransactions: monthTransactions,
      recurringTransactions,
      goals,
      survivalReserveCents
    });

    // Projeção Avançada: Usa a liquidez calculada pelo motor central para manter 100% de consistência
    const projectedNetLiquidity = monthOffset === 0
      ? realCycleLiquidity  // Mês atual = estado real (respiro)
      : baseOutlook.projectedNetLiquidity;

    return {
      ...baseOutlook,
      // O saldo final para cálculo de teto (ceiling) deve ser o projetado (baseOutlook) no mês atual
      // e o acumulado (projectedNetLiquidity) nos meses futuros.
      balanceAtMonthEnd: (monthOffset === 0 ? baseOutlook.balanceAtMonthEnd : baseOutlook.totalAssets) || 0,
      projectedNetLiquidity: projectedNetLiquidity || 0
    };
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, monthOffset, futureTransactions, goals, activeSimulations, monthTransactions, survivalReserveCents]);

  // Se houver simulações ativas no mês atual, ajustamos o saldo real e a dívida real simulada
  const simulatedAssetsAdjustment = useMemo(() => {
    if (activeSimulations.length === 0) return 0;

    const simulatedIncome = activeSimulations
      .filter(s => s.type === "INCOME")
      .reduce((sum, s) => {
        const startOffset = s.startMonthOffset ?? 0;
        if (monthOffset !== startOffset) return sum; // Só afeta ativos no mês de início
        if (s.isLoan || (s.interestRate && s.interestRate > 0)) {
          return sum + s.amount_cents; // Injeção total do capital no mês de contração
        }
        const monthly = s.installments > 1 ? Math.round(s.amount_cents / s.installments) : s.amount_cents;
        return sum + monthly;
      }, 0);

    const simulatedDebitExpense = activeSimulations
      .filter(s => s.type === "EXPENSE" && s.installments === 1)
      .reduce((sum, s) => {
        const startOffset = s.startMonthOffset ?? 0;
        if (monthOffset !== startOffset) return sum; // Só afeta ativos no mês de início
        return sum + s.amount_cents;
      }, 0);

    return simulatedIncome - simulatedDebitExpense;
  }, [activeSimulations, monthOffset]);

  const simulatedDebtAdjustment = useMemo(() => {
    if (activeSimulations.length === 0) return 0;

    // 1. Receitas simuladas acumuladas que amortizam a dívida
    const simulatedIncome = activeSimulations
      .filter(s => s.type === "INCOME")
      .reduce((sum, s) => {
        const startOffset = s.startMonthOffset ?? 0;
        if (s.installments > 1) {
          const monthly = Math.round(s.amount_cents / s.installments);
          const activeMonths = Math.min(s.installments, Math.max(0, monthOffset - startOffset + 1));
          return sum + (monthly * activeMonths);
        }
        if (monthOffset >= startOffset) {
          return sum + s.amount_cents;
        }
        return sum;
      }, 0);

    // 2. Despesas simuladas parceladas remanescentes no cartão
    const simulatedCreditExpense = activeSimulations
      .filter(s => s.type === "EXPENSE" && s.installments > 1)
      .reduce((sum, s) => {
        const startOffset = s.startMonthOffset ?? 0;
        const monthly = Math.round(s.amount_cents / s.installments);
        const remainingInstallments = Math.max(0, s.installments - Math.max(0, monthOffset - startOffset));
        return sum + (monthly * remainingInstallments);
      }, 0);

    return simulatedCreditExpense - simulatedIncome;
  }, [activeSimulations, monthOffset]);

  const activeDebt = useMemo(() => {
    const baseDebt = monthOffset === 0 ? consolidatedDebt : (monthlyOutlook.totalDebt ?? consolidatedDebt);
    if (activeSimulations.length > 0) {
      return Math.max(0, baseDebt + simulatedDebtAdjustment);
    }
    return baseDebt;
  }, [monthOffset, consolidatedDebt, monthlyOutlook.totalDebt, activeSimulations, simulatedDebtAdjustment]);

  const activeAssets = useMemo(() => {
    const baseAssets = monthOffset === 0 ? currentAssets : (monthlyOutlook.totalAssets ?? currentAssets);
    const hasSimulationsInOffset = activeSimulations.some(s => (s.startMonthOffset ?? 0) === monthOffset);
    if (monthOffset === 0 && hasSimulationsInOffset) {
      return baseAssets + simulatedAssetsAdjustment;
    }
    return baseAssets;
  }, [monthOffset, currentAssets, monthlyOutlook.totalAssets, activeSimulations, simulatedAssetsAdjustment]);

  const simulatedNetImpact = useMemo(() => {
    if (activeSimulations.length === 0) return 0;
    
    const simulatedIncome = activeSimulations
      .filter(s => s.type === "INCOME")
      .reduce((sum, s) => {
        const startOffset = s.startMonthOffset ?? 0;
        if (monthOffset !== startOffset) return sum; // Só afeta se for o mês da simulação
        if (s.isLoan || (s.interestRate && s.interestRate > 0)) {
          return sum + s.amount_cents; // Injeção total do capital no Mês de início
        }
        const monthly = s.installments > 1 ? Math.round(s.amount_cents / s.installments) : s.amount_cents;
        return sum + monthly;
      }, 0);

    const simulatedExpense = activeSimulations.reduce((sum, s) => {
      const startOffset = s.startMonthOffset ?? 0;
      if (monthOffset < startOffset || monthOffset >= startOffset + s.installments) return sum;
      
      // Caso especial: Simulação de Empréstimo
      if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        const rate = (s.interestRate && s.interestRate > 0) ? s.interestRate : 9.53;
        return sum + calculateLoanInstallment(s.amount_cents, rate, s.installments);
      }
      
      if (s.type === "INCOME") return sum;
      
      if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
        return sum + s.customInstallmentCents;
      }
      const monthly = s.installments > 1 ? Math.round(s.amount_cents / s.installments) : s.amount_cents;
      return sum + monthly;
    }, 0);

    return simulatedIncome - simulatedExpense;
  }, [activeSimulations, monthOffset]);

  // Sobrescrita para usar a liquidez projetada no retorno
  const activeNetLiquidity = useMemo(() => {
    const baseLiquidity = monthOffset === 0 ? realCycleLiquidity : (monthlyOutlook.projectedNetLiquidity ?? netLiquidity);
    if (monthOffset === 0 && activeSimulations.length > 0) {
      return baseLiquidity + simulatedNetImpact;
    }
    return baseLiquidity;
  }, [monthOffset, realCycleLiquidity, monthlyOutlook.projectedNetLiquidity, netLiquidity, activeSimulations, simulatedNetImpact]);

  const debtExit = useMemo(() => {
    return calculateDebtExitProjection({
      netLiquidityCents: netLiquidity,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets
    });
  }, [netLiquidity, recurringIncomeCents, recurringExpensesCents, budgets]);

  const goalProjections = useMemo(() => {
    return calculateGoalProjections({
      debtExit,
      goals
    });
  }, [debtExit, goals]);
  
  // Saldo consolidado apenas das contas correntes (verificável no app do banco)
  const checkingBalance = useMemo(() => {
    return accounts
      .filter(a => a.type !== "CREDIT_CARD")
      .reduce((sum, a) => sum + (Number(a.balance_cents) || 0), 0);
  }, [accounts]);

  // Total gasto nos cartões de crédito — projetado para meses futuros
  const creditCardUsed = useMemo(() => {
    if (monthOffset > 0) {
      // Em meses futuros, usar a dívida projetada pelo motor de projeção
      return monthlyOutlook.totalDebt ?? 0;
    }
    // Mês atual: somatório real dos saldos negativos dos cartões
    return accounts
      .filter(a => a.type === "CREDIT_CARD")
      .reduce((sum, a) => {
        const balance = Number(a.balance_cents) || 0;
        return sum + (balance < 0 ? Math.abs(balance) : 0);
      }, 0);
  }, [accounts, monthOffset, monthlyOutlook.totalDebt]);

  const startingBalanceCents = useMemo(() => {
    if (monthOffset === 0) {
      const creditCardAccountIds = new Set(
        accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id)
      );

      const paidIncomeThisMonth = (monthTransactions || [])
        .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const paidExpenseThisMonth = (monthTransactions || [])
        .filter(t => t.transaction_type === "EXPENSE" && t.is_paid === true && !creditCardAccountIds.has(t.account_id))
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const paidTransferThisMonth = (monthTransactions || [])
        .filter(t => t.transaction_type === "TRANSFER" && t.is_paid === true)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      return currentAssets - paidIncomeThisMonth + paidExpenseThisMonth + paidTransferThisMonth;
    }
    
    const prevOutlook = calculateMonthlyOutlook({
      accounts,
      scheduledIncomeCents: scheduledIncomeCents,
      scheduledExpensesCents: scheduledExpensesCents,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset: monthOffset - 1,
      activeSimulations,
      futureTransactions,
      allTransactions: monthTransactions,
      recurringTransactions,
      goals,
      survivalReserveCents
    });
    return prevOutlook.totalAssets || 0;
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, monthOffset, activeSimulations, futureTransactions, monthTransactions, recurringTransactions, goals, survivalReserveCents, currentAssets]);

  const isSurvivalMode = useMemo(() => (monthlyOutlook.balanceAtMonthEnd || 0) < 0 || activeNetLiquidity < 0, [monthlyOutlook.balanceAtMonthEnd, activeNetLiquidity]);
  const isCrisisMode = useMemo(() => activeNetLiquidity < 0 && (monthlyOutlook.balanceAtMonthEnd || 0) < 0, [activeNetLiquidity, monthlyOutlook.balanceAtMonthEnd]);

  const weeklySurvival = useMemo(() => {
    // Margem livre real = Renda recorrente - Despesas fixas recorrentes
    const regularIncome = recurringIncomeCents > 0 ? recurringIncomeCents : 0;
    const regularExpenses = recurringExpensesCents > 0 ? recurringExpensesCents : 0;
    let freeMarginMonthly = Math.max(0, regularIncome - regularExpenses);

    // Ajustar margem livre mensal e saldo de contas com base no impacto de simulações ativas
    let effectiveCheckingBalance = checkingBalance;
    if (activeSimulations.length > 0) {
      const monthlySimulatedExpense = simulatedNetImpact < 0 ? Math.abs(simulatedNetImpact) : 0;
      freeMarginMonthly = Math.max(0, freeMarginMonthly - monthlySimulatedExpense);
      effectiveCheckingBalance = Math.max(0, effectiveCheckingBalance - monthlySimulatedExpense);
    }

    // Para meses futuros, usar o saldo projetado em vez do saldo atual
    if (monthOffset > 0) {
      effectiveCheckingBalance = monthlyOutlook.totalAssets ?? 0;
    }

    // Semanas no mês — para meses futuros, usar o mês inteiro (4-5 semanas)
    const now = new Date();
    let weeksInPeriod: number;
    if (monthOffset > 0) {
      // Mês futuro: distribuir pelo mês inteiro
      const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
      const daysInMonth = targetDate.getDate();
      weeksInPeriod = Math.max(1, Math.ceil(daysInMonth / 7));
    } else {
      // Mês atual: semanas restantes
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.max(1, lastDayOfMonth - now.getDate() + 1);
      weeksInPeriod = Math.max(1, Math.ceil(daysRemaining / 7));
    }

    let weeklyLimitCents = 0;

    if (weeklyLimitOverrideCents > 0) {
      // Se houver um limite semanal personalizado definido pelo usuário nas configurações
      weeklyLimitCents = weeklyLimitOverrideCents;
    } else {
      // Oráculo Dinâmico Automático
      // 1. Fator Metas: Deduzir aportes necessários das metas ativas para protegê-las
      const activeGoalsContribution = (goals || [])
        .filter(g => g.status === "active" || g.status === undefined)
        .reduce((sum, g) => sum + (g.monthly_contribution_cents || 0), 0);
      
      const netFreeMarginMonthly = Math.max(0, freeMarginMonthly - activeGoalsContribution);

      // Calcular limite base
      let baseLimitCents = 0;
      if (netFreeMarginMonthly > 0) {
        baseLimitCents = Math.round(netFreeMarginMonthly / weeksInPeriod);
      } else if (effectiveCheckingBalance > 0) {
        baseLimitCents = Math.round(effectiveCheckingBalance / weeksInPeriod);
      }

      // 2. Redutor de Abundância Progressiva: Acima de R$ 300,00, apenas 30% do excedente entra no teto
      if (baseLimitCents > 30000) {
        weeklyLimitCents = 30000 + Math.round((baseLimitCents - 30000) * 0.30);
      } else {
        weeklyLimitCents = baseLimitCents;
      }

      // 3. Corte Emergencial de Crise: Se em crise ou sobrevivência, cortar 50%
      if (isCrisisMode || isSurvivalMode) {
        weeklyLimitCents = Math.round(weeklyLimitCents * 0.5);
        // Piso de subsistência rígido na crise
        if (weeklyLimitCents < 8000) {
          weeklyLimitCents = 5000; // R$ 50,00
        }
      }
    }

    // Piso absoluto geral de sobrevivência
    weeklyLimitCents = Math.max(5000, weeklyLimitCents);

    // Calcular consumo semanal baseado em transações reais de despesas variáveis
    const result = calculateWeeklySurvival({
      monthlySurplusCents: 0,
      currentMonthTransactions: monthOffset === 0 ? monthTransactions : []
    });

    return {
      ...result,
      weeklyLimitCents,
      remainingCents: weeklyLimitCents - result.weeklySpentCents,
      status: (weeklyLimitCents > 0 && result.weeklySpentCents / weeklyLimitCents > 0.9) || (weeklyLimitCents - result.weeklySpentCents < 0)
        ? "CRITICAL" as const
        : (weeklyLimitCents > 0 && result.weeklySpentCents / weeklyLimitCents > 0.6)
          ? "WARNING" as const
          : "NORMAL" as const
    };
  }, [accounts, checkingBalance, recurringIncomeCents, recurringExpensesCents, monthTransactions, monthOffset, activeSimulations, simulatedNetImpact, monthlyOutlook.totalAssets, weeklyLimitOverrideCents, goals, isCrisisMode, isSurvivalMode]);

  const simulateDetailedImpactFn = useCallback((
    amountCents: number, 
    installments: number, 
    type?: "EXPENSE" | "INCOME",
    loanInstallmentCents?: number,
    loanInstallmentsCount?: number
  ) => 
    simulateDetailedImpact({
      amountCents,
      installments,
      netLiquidityCents: netLiquidity,
      monthlySurplus: debtExit.monthlySurplus,
      currentExitDate: debtExit.exitDate,
      currentBalanceCents: currentAssets,
      type,
      loanInstallmentCents,
      loanInstallmentsCount
    }), [netLiquidity, debtExit.monthlySurplus, debtExit.exitDate, currentAssets]);

  const analyzeSimulationIA = useCallback(async (simulation: any) => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.analyzeSimulationIA(simulation, summary);
    if (error || !data) return "Falha ao consultar a análise do oráculo de IA.";
    return data;
  }, [activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  const solveFinancialDilemma = useCallback(async (dilemmaText: string) => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.solveFinancialDilemma(dilemmaText, summary);
    if (error || !data) return { advice: "Falha ao obter sugestões do copiloto de IA.", simulations: [] };
    return data;
  }, [activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  const optimizeSweepIA = useCallback(async () => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.optimizeSweep(goals, budgets, summary);
    if (error || !data) {
      return {
        advice: "Falha ao obter recomendações de amortização acelerada por IA.",
        suggested_simulation: null
      };
    }
    return data;
  }, [goals, budgets, activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  const consultJarvisIA = useCallback(async (simulation?: any) => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.consultJarvisIA({
      goals,
      budgets,
      accounts,
      transactions: monthTransactions,
      recurring_transactions: recurringTransactions,
      summary,
      simulation
    });

    if (error || !data) {
      return {
        advice: "Falha ao consultar Gabinete de Crise Vesper Jarvis.",
        suggested_loan_amount_cents: 0,
        loan_verdict: "Copiloto indisponível.",
        postponement_tips: []
      };
    }
    return data;
  }, [goals, budgets, accounts, monthTransactions, recurringTransactions, activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  return useMemo(() => ({
    netLiquidityCents: activeNetLiquidity,
    totalConsolidatedDebtCents: activeDebt,
    accumulatedBalanceCents: activeAssets,
    startingBalanceCents: startingBalanceCents,
    checkingBalanceCents: checkingBalance,
    creditCardUsedCents: creditCardUsed,
    monthlyOutlook: {
      ...monthlyOutlook,
      balanceAtMonthEnd: monthlyOutlook.balanceAtMonthEnd || 0,
      projectedNetLiquidity: monthlyOutlook.projectedNetLiquidity || 0
    },
    healthScore,
    recurringIncomeCents,
    recurringExpensesCents,
    isSurvivalMode,
    isCrisisMode,
    debtExit,
    weeklySurvival,
    goalProjections,
    simulateDetailedImpact: simulateDetailedImpactFn,
    analyzeSimulationIA,
    solveFinancialDilemma,
    optimizeSweepIA,
    consultJarvisIA
  }), [activeNetLiquidity, activeDebt, activeAssets, checkingBalance, creditCardUsed, monthlyOutlook, healthScore, recurringIncomeCents, recurringExpensesCents, debtExit, weeklySurvival, goalProjections, simulateDetailedImpactFn, analyzeSimulationIA, solveFinancialDilemma, optimizeSweepIA, consultJarvisIA]);
}
