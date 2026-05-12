
import { useMemo } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { 
  calculateNetLiquidity, 
  calculateMonthlyOutlook, 
  calculateTotalConsolidatedDebt,
  calculateAccumulatedBalance,
  type MonthlyOutlook,
  calculateDebtExitProjection,
  type DebtExitProjection,
  calculateWeeklySurvival,
  type WeeklySurvival,
  calculateGoalProjections,
  type GoalProjection,
  simulateDetailedImpact,
  type SimulationDetailedResult
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
  simulateDetailedImpact: (amountCents: number, installments: number) => SimulationDetailedResult;
}

/**
 * Hook de "Ponte de Dados": Consolida a inteligência financeira do sistema.
 * Use este hook em qualquer página ou componente para obter diagnósticos consistentes.
 */
export function useFinancialAnalysis(): FinancialAnalysis {
  const { 
    accounts, 
    scheduledIncomeCents, 
    scheduledExpensesCents, 
    budgets,
    goals,
    recurringIncomeCents,
    recurringExpensesCents,
    healthScore,
    monthTransactions
  } = useFinancialData();

  const netLiquidity = useMemo(() => calculateNetLiquidity(accounts), [accounts]);
  const consolidatedDebt = useMemo(() => calculateTotalConsolidatedDebt(accounts), [accounts]);
  const currentAssets = useMemo(() => calculateAccumulatedBalance(accounts), [accounts]);

  const monthlyOutlook = useMemo(() => {
    return calculateMonthlyOutlook({
      accounts,
      scheduledIncomeCents,
      scheduledExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity
    });
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, budgets, netLiquidity]);

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
    // O teto semanal deve ser baseado na sobra (balanceAtMonthEnd) e não na renda total,
    // para garantir que o usuário não gaste o dinheiro que deveria ir para as dívidas.
    return calculateWeeklySurvival({
      monthlySurplusCents: Math.max(0, monthlyOutlook.balanceAtMonthEnd),
      currentMonthTransactions: monthTransactions
    });
  }, [monthlyOutlook.balanceAtMonthEnd, monthTransactions]);

  return {
    netLiquidityCents: netLiquidity,
    totalConsolidatedDebtCents: consolidatedDebt,
    accumulatedBalanceCents: currentAssets,
    monthlyOutlook,
    healthScore,
    isSurvivalMode: monthlyOutlook.balanceAtMonthEnd < 0,
    isCrisisMode: netLiquidity < 0 && monthlyOutlook.balanceAtMonthEnd < 0,
    debtExit,
    weeklySurvival,
    goalProjections,
    simulateDetailedImpact: (amountCents: number, installments: number) => 
      simulateDetailedImpact({
        amountCents,
        installments,
        netLiquidityCents: netLiquidity,
        monthlySurplus: debtExit.monthlySurplus,
        currentExitDate: debtExit.exitDate,
        currentBalanceCents: currentAssets
      })
  };
}
