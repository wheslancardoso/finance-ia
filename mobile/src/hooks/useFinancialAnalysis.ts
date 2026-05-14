import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  calculateNetLiquidity,
  calculateMonthlyOutlook,
  calculateTotalConsolidatedDebt,
  calculateAccumulatedBalance,
  calculateRealCycleLiquidity,
  calculateDebtExitProjection,
  calculateWeeklySurvival,
  calculateGoalProjections,
  calculateAdvancedProjection
} from '../../../src/domain/financial/financial-logic';

export function useFinancialAnalysis(monthOffset: number = 0, activeSimulations: any[] = []) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAllData() {
    try {
      setLoading(true);
      const [
        { data: accounts },
        { data: recurring },
        { data: transactions },
        { data: budgets },
        { data: goals },
        { data: profile }
      ] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('recurring_transactions').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('budgets').select('*'),
        supabase.from('goals').select('*'),
        supabase.from('profiles').select('financial_health_score').single()
      ]);

      const safeAccounts = accounts || [];
      const safeRecurring = recurring || [];
      const safeTransactions = transactions || [];
      const safeBudgets = budgets || [];
      const safeGoals = goals || [];

      // Filtrar transações do mês atual para o ciclo de liquidez
      const now = new Date();
      const currentMonthTransactions = safeTransactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      // Transações futuras (parcelamentos)
      const futureTransactions = safeTransactions.filter(t => new Date(t.date) > now);

      const netLiquidity = calculateNetLiquidity(safeAccounts);
      const consolidatedDebt = calculateTotalConsolidatedDebt(safeAccounts);
      const currentAssets = calculateAccumulatedBalance(safeAccounts);

      const realCycleLiquidity = calculateRealCycleLiquidity({
        accounts: safeAccounts,
        currentMonthTransactions
      });

      // Recorrentes em formato esperado pela lógica
      const recurringIncomeCents = safeRecurring
        .filter(r => r.transaction_type === 'INCOME' && r.status === 'active')
        .reduce((sum, r) => sum + (r.amount_cents || 0), 0);

      const recurringExpensesCents = safeRecurring
        .filter(r => r.transaction_type === 'EXPENSE' && r.status === 'active')
        .reduce((sum, r) => sum + (r.amount_cents || 0), 0);

      const monthlyOutlook = calculateMonthlyOutlook({
        accounts: safeAccounts,
        scheduledIncomeCents: recurringIncomeCents, // Simplificação para mobile inicial
        scheduledExpensesCents: recurringExpensesCents,
        recurringIncomeCents,
        recurringExpensesCents,
        budgets: safeBudgets,
        netLiquidityCents: netLiquidity,
        monthOffset,
        activeSimulations,
        futureTransactions,
        allTransactions: currentMonthTransactions,
        recurringTransactions: safeRecurring,
        goals: safeGoals
      });

      const projectedNetLiquidity = monthOffset === 0
        ? realCycleLiquidity
        : calculateAdvancedProjection({
          currentNetLiquidity: netLiquidity,
          recurringTransactions: safeRecurring,
          futureTransactions,
          goals: safeGoals,
          budgets: safeBudgets,
          monthOffset,
          activeSimulations,
          scheduledIncomeCents: recurringIncomeCents,
          scheduledExpensesCents: recurringExpensesCents
        });

      const activeNetLiquidity = monthOffset === 0 ? realCycleLiquidity : projectedNetLiquidity;

      const debtExit = calculateDebtExitProjection({
        netLiquidityCents: netLiquidity,
        recurringIncomeCents,
        recurringExpensesCents,
        budgets: safeBudgets
      });

      const goalProjections = calculateGoalProjections({
        debtExit,
        goals: safeGoals
      });

      const weeklySurvival = calculateWeeklySurvival({
        monthlySurplusCents: Math.max(0, monthlyOutlook.balanceAtMonthEnd),
        currentMonthTransactions
      });

      setData({
        netLiquidityCents: activeNetLiquidity,
        totalConsolidatedDebtCents: monthOffset === 0 ? consolidatedDebt : monthlyOutlook.totalDebt,
        accumulatedBalanceCents: monthOffset === 0 ? currentAssets : monthlyOutlook.totalAssets,
        monthlyOutlook: {
          ...monthlyOutlook,
          balanceAtMonthEnd: monthOffset === 0 ? monthlyOutlook.balanceAtMonthEnd : projectedNetLiquidity,
          projectedNetLiquidity
        },
        debtExit,
        weeklySurvival,
        goalProjections,
        healthScore: profile?.financial_health_score || 0,
        // Mantendo compatibilidade com o que o useFinancialSummary retornava
        incomeCents: recurringIncomeCents,
        expenseCents: recurringExpensesCents
      });

    } catch (error) {
      console.error('Error in useFinancialAnalysis:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllData();
  }, [monthOffset, activeSimulations.length]);

  return {
    analysis: data,
    loading,
    refresh: fetchAllData
  };
}
