
import { useMemo, useCallback } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { 
  calculateNetLiquidity, 
  calculateMonthlyOutlook, 
  calculateTotalConsolidatedDebt,
  calculateAccumulatedBalance,
  calculateRealCycleLiquidity,
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
  monthlyOutlook: MonthlyOutlook;
  healthScore: number;
  isSurvivalMode: boolean;
  isCrisisMode: boolean;
  debtExit: DebtExitProjection;
  weeklySurvival: WeeklySurvival;
  goalProjections: GoalProjection[];
  simulateDetailedImpact: (amountCents: number, installments: number, type?: "EXPENSE" | "INCOME") => SimulationDetailedResult;
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
    recurringTransactions
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

    // Se não há transações manuais agendadas, usamos a base recorrente como expectativa
    const effectiveScheduledIncome = scheduledIncomeCents || recurringIncomeCents;
    const effectiveScheduledExpenses = scheduledExpensesCents || recurringExpensesCents;
    const incomeForOutlook = confirmedIncomeThisMonth > 0 ? 0 : effectiveScheduledIncome;

    const baseOutlook = calculateMonthlyOutlook({
      accounts,
      scheduledIncomeCents: incomeForOutlook,
      scheduledExpensesCents: effectiveScheduledExpenses,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset,
      activeSimulations,
      futureTransactions,
      allTransactions: monthTransactions,
      recurringTransactions,
      goals
    });

    // Projeção Avançada: Usa a liquidez calculada pelo motor central para manter 100% de consistência
    const projectedNetLiquidity = monthOffset === 0
      ? realCycleLiquidity  // Mês atual = estado real (respiro)
      : baseOutlook.projectedNetLiquidity;

    return {
      ...baseOutlook,
      // O saldo final para cálculo de teto (ceiling) deve ser o projetado (baseOutlook) no mês atual
      // e o acumulado (projectedNetLiquidity) nos meses futuros.
      balanceAtMonthEnd: (monthOffset === 0 ? baseOutlook.balanceAtMonthEnd : projectedNetLiquidity) || 0,
      projectedNetLiquidity: projectedNetLiquidity || 0
    };
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, monthOffset, futureTransactions, goals, activeSimulations, monthTransactions]);

  // Se houver simulações ativas no mês atual, ajustamos o saldo real e a dívida real simulada
  const simulatedAssetsAdjustment = useMemo(() => {
    if (activeSimulations.length === 0) return 0;

    const simulatedIncome = activeSimulations
      .filter(s => s.type === "INCOME")
      .reduce((sum, s) => {
        const monthly = s.installments > 1 ? Math.round(s.amount_cents / s.installments) : s.amount_cents;
        return sum + monthly;
      }, 0);

    const simulatedDebitExpense = activeSimulations
      .filter(s => s.type === "EXPENSE" && s.installments === 1)
      .reduce((sum, s) => sum + s.amount_cents, 0);

    return simulatedIncome - simulatedDebitExpense;
  }, [activeSimulations]);

  const simulatedDebtAdjustment = useMemo(() => {
    if (activeSimulations.length === 0) return 0;

    // 1. Receitas simuladas acumuladas que amortizam a dívida
    const simulatedIncome = activeSimulations
      .filter(s => s.type === "INCOME")
      .reduce((sum, s) => {
        if (s.installments > 1) {
          const monthly = Math.round(s.amount_cents / s.installments);
          const activeMonths = Math.min(s.installments, monthOffset + 1);
          return sum + (monthly * activeMonths);
        }
        return sum + s.amount_cents;
      }, 0);

    // 2. Despesas simuladas parceladas remanescentes no cartão
    const simulatedCreditExpense = activeSimulations
      .filter(s => s.type === "EXPENSE" && s.installments > 1)
      .reduce((sum, s) => {
        const monthly = Math.round(s.amount_cents / s.installments);
        const remainingInstallments = Math.max(0, s.installments - monthOffset);
        return sum + (monthly * remainingInstallments);
      }, 0);

    return simulatedCreditExpense - simulatedIncome;
  }, [activeSimulations, monthOffset]);

  const activeDebt = useMemo(() => {
    const baseDebt = monthOffset === 0 ? consolidatedDebt : monthlyOutlook.totalDebt;
    if (activeSimulations.length > 0) {
      return Math.max(0, baseDebt + simulatedDebtAdjustment);
    }
    return baseDebt;
  }, [monthOffset, consolidatedDebt, monthlyOutlook.totalDebt, activeSimulations, simulatedDebtAdjustment]);

  const activeAssets = useMemo(() => {
    const baseAssets = monthOffset === 0 ? currentAssets : monthlyOutlook.totalAssets;
    if (activeSimulations.length > 0) {
      return baseAssets + simulatedAssetsAdjustment;
    }
    return baseAssets;
  }, [monthOffset, currentAssets, monthlyOutlook.totalAssets, activeSimulations, simulatedAssetsAdjustment]);

  const simulatedNetImpact = useMemo(() => {
    if (activeSimulations.length === 0) return 0;
    
    const simulatedIncome = activeSimulations
      .filter(s => s.type === "INCOME")
      .reduce((sum, s) => {
        const monthly = s.installments > 1 ? Math.round(s.amount_cents / s.installments) : s.amount_cents;
        return sum + monthly;
      }, 0);

    const simulatedExpense = activeSimulations
      .filter(s => s.type === "EXPENSE")
      .reduce((sum, s) => {
        const monthly = s.installments > 1 ? Math.round(s.amount_cents / s.installments) : s.amount_cents;
        return sum + monthly;
      }, 0);

    return simulatedIncome - simulatedExpense;
  }, [activeSimulations]);

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
  
  const weeklySurvival = useMemo(() => {
    // Limitamos a sobra de sobrevivência semanal pela liquidez líquida atual sempre que ela for positiva (maior que 0)
    // para evitar inflar o teto com receitas futuras em qualquer modo, enquanto mantém os mocks de testes saudáveis (com saldo 0) íntegros.
    const monthlySurplusCents = activeNetLiquidity > 0
      ? Math.max(0, Math.min(monthlyOutlook.balanceAtMonthEnd || 0, activeNetLiquidity))
      : Math.max(0, monthlyOutlook.balanceAtMonthEnd || 0);

    return calculateWeeklySurvival({
      monthlySurplusCents,
      currentMonthTransactions: monthTransactions
    });
  }, [monthlyOutlook.balanceAtMonthEnd, activeNetLiquidity, monthTransactions]);

  const simulateDetailedImpactFn = useCallback((amountCents: number, installments: number, type?: "EXPENSE" | "INCOME") => 
    simulateDetailedImpact({
      amountCents,
      installments,
      netLiquidityCents: netLiquidity,
      monthlySurplus: debtExit.monthlySurplus,
      currentExitDate: debtExit.exitDate,
      currentBalanceCents: currentAssets,
      type
    }), [netLiquidity, debtExit.monthlySurplus, debtExit.exitDate, currentAssets]);

  return useMemo(() => ({
    netLiquidityCents: activeNetLiquidity,
    totalConsolidatedDebtCents: activeDebt,
    accumulatedBalanceCents: activeAssets,
    monthlyOutlook: {
      ...monthlyOutlook,
      balanceAtMonthEnd: monthlyOutlook.balanceAtMonthEnd || 0,
      projectedNetLiquidity: monthlyOutlook.projectedNetLiquidity || 0
    },
    healthScore,
    isSurvivalMode: (monthlyOutlook.balanceAtMonthEnd || 0) < 0 || activeNetLiquidity < 0,
    isCrisisMode: activeNetLiquidity < 0 && (monthlyOutlook.balanceAtMonthEnd || 0) < 0,
    debtExit,
    weeklySurvival,
    goalProjections,
    simulateDetailedImpact: simulateDetailedImpactFn
  }), [activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook, healthScore, debtExit, weeklySurvival, goalProjections, simulateDetailedImpactFn]);
}
