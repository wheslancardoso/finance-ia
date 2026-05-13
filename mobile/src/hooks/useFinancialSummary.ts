import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  calculateAccumulatedBalance, 
  calculateTotalConsolidatedDebt, 
  calculateNetLiquidity,
  calculateMonthlyOutlook,
  calculateScheduledIncome,
  calculateScheduledExpenses,
  calculateRecurringIncome,
  calculateRecurringExpenses
} from '../../../src/domain/financial/financial-logic';

export function useFinancialSummary() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const [
        { data: accounts },
        { data: recurring },
        { data: transactions },
        { data: budgets }
      ] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('recurring_transactions').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('budgets').select('*')
      ]);

      const netLiquidityCents = calculateNetLiquidity(accounts || []);
      const accumulatedBalanceCents = calculateAccumulatedBalance(accounts || []);
      const totalDebtCents = calculateTotalConsolidatedDebt(accounts || []);
      
      const scheduledIncomeCents = calculateScheduledIncome(recurring || []);
      const scheduledExpensesCents = calculateScheduledExpenses(recurring || []);
      const recurringIncomeCents = calculateRecurringIncome(recurring || []);
      const recurringExpensesCents = calculateRecurringExpenses(recurring || []);

      const outlook = calculateMonthlyOutlook({
        accounts: accounts || [],
        scheduledIncomeCents,
        scheduledExpensesCents,
        recurringIncomeCents,
        recurringExpensesCents,
        budgets: budgets || [],
        netLiquidityCents,
        allTransactions: transactions || []
      });

      setSummary({
        netLiquidityCents,
        accumulatedBalanceCents,
        totalDebtCents,
        outlook,
        incomeCents: recurringIncomeCents,
        expenseCents: recurringExpensesCents
      });
    } catch (error) {
      console.error('Error fetching financial summary:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return { summary, loading, refresh: fetchData };
}
