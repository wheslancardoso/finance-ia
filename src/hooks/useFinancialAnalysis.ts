
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
export function useFinancialAnalysis(monthOffset: number = 0): FinancialAnalysis {
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
    const baseOutlook = calculateMonthlyOutlook({
      accounts,
      scheduledIncomeCents,
      scheduledExpensesCents,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset
    });

    // Projeção de Patrimônio Líquido: Liquidez Atual + (Sobra Mensal * offset)
    const budgetTotal = budgets.reduce((sum, b) => sum + (b.amount_cents || 0), 0);
    const monthlySurplus = (recurringIncomeCents || 0) - (recurringExpensesCents || 0) - budgetTotal;
    
    // Para o mês atual (0), usamos a liquidez real. Para o futuro, projetamos a acumulação.
    const projectedNetLiquidity = monthOffset === 0 
      ? netLiquidity 
      : netLiquidity + (monthlySurplus * monthOffset);

    return {
      ...baseOutlook,
      projectedNetLiquidity
    };
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, monthOffset]);

  // Sobrescrita para usar a liquidez projetada no retorno
  const activeNetLiquidity = monthlyOutlook.projectedNetLiquidity ?? netLiquidity;

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
    return calculateWeeklySurvival({
      monthlySurplusCents: Math.max(0, monthlyOutlook.balanceAtMonthEnd),
      currentMonthTransactions: monthTransactions
    });
  }, [monthlyOutlook.balanceAtMonthEnd, monthTransactions]);

  return {
    netLiquidityCents: activeNetLiquidity,
    totalConsolidatedDebtCents: consolidatedDebt,
    accumulatedBalanceCents: currentAssets,
    monthlyOutlook,
    healthScore,
    isSurvivalMode: monthlyOutlook.balanceAtMonthEnd < 0 || activeNetLiquidity < 0,
    isCrisisMode: activeNetLiquidity < 0 && monthlyOutlook.balanceAtMonthEnd < 0,
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
