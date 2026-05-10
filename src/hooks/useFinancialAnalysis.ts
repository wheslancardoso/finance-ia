
import { useMemo } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { 
  calculateNetLiquidity, 
  calculateMonthlyOutlook, 
  calculateTotalConsolidatedDebt,
  calculateAccumulatedBalance,
  MonthlyOutlook,
  calculateDebtExitProjection,
  calculateGoalProjections,
  DebtExitProjection,
  GoalProjection,
  simulateDetailedImpact,
} from "@/lib/financial-logic";

export type { SimulationDetailedResult } from "@/lib/financial-logic";

export interface FinancialAnalysis {
  netLiquidityCents: number;
  totalConsolidatedDebtCents: number;
  accumulatedBalanceCents: number;
  monthlyOutlook: MonthlyOutlook;
  healthScore: number;
  isSurvivalMode: boolean;
  debtExit: DebtExitProjection;
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
    healthScore
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

  return {
    netLiquidityCents: netLiquidity,
    totalConsolidatedDebtCents: consolidatedDebt,
    accumulatedBalanceCents: currentAssets,
    monthlyOutlook,
    healthScore,
    isSurvivalMode: netLiquidity < 0,
    debtExit,
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
