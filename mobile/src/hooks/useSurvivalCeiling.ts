import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from './useProfile';
import { useAccounts } from './useAccounts';

export function useSurvivalCeiling() {
  const [ceiling, setCeiling] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();
  const { accounts } = useAccounts();

  async function calculateCeiling() {
    if (!profile || accounts.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      // 1. Buscar transações do mês para Extra Income e Current Month Expenses
      const { data: monthTxs } = await supabase
        .from('transactions')
        .select('amount_cents, transaction_type, account_id, date, is_legacy_debt')
        .eq('user_id', user.id)
        .gte('date', monthStart);

      let extraIncomeCents = 0;
      let currentMonthExpensesCents = 0;
      const nonCreditCardAccIds = accounts.filter(a => a.type !== 'CREDIT_CARD').map(a => a.id);

      if (monthTxs) {
        extraIncomeCents = monthTxs
          .filter(tx => tx.transaction_type === 'INCOME')
          .reduce((sum, tx) => sum + tx.amount_cents, 0);
          
        currentMonthExpensesCents = monthTxs
          .filter(tx => tx.transaction_type === 'EXPENSE' && nonCreditCardAccIds.includes(tx.account_id) && !tx.is_legacy_debt)
          .reduce((sum, tx) => sum + tx.amount_cents, 0);
      }

      // 2. Calcular Faturas de Cartão (Simulado para o mês atual)
      let totalCreditCardInvoices = 0;
      for (const acc of accounts) {
        if (acc.type === 'CREDIT_CARD') {
          // Simplificação: soma todas as despesas não pagas do cartão
          const { data: cardTxs } = await supabase
            .from('transactions')
            .select('amount_cents')
            .eq('account_id', acc.id)
            .eq('is_paid', false);
          
          const cardTotal = cardTxs?.reduce((sum, tx) => sum + tx.amount_cents, 0) || 0;
          totalCreditCardInvoices += cardTotal;
        }
      }

      // 3. Matemática Vesper
      const survivalCeilingCents = Math.max(0, 
        (profile.monthly_income_cents || 0) + 
        (profile.accumulated_balance_cents || 0) + 
        extraIncomeCents - 
        (profile.fixed_expenses_cents || 0) - 
        totalCreditCardInvoices - 
        currentMonthExpensesCents
      );

      setCeiling(survivalCeilingCents);
      setBreakdown({
        monthlyIncomeCents: profile.monthly_income_cents,
        accumulatedBalanceCents: profile.accumulated_balance_cents,
        extraIncomeCents,
        fixedExpensesCents: profile.fixed_expenses_cents,
        currentMonthExpensesCents,
        totalCreditCardInvoices
      });
    } catch (error) {
      console.error('Error calculating survival ceiling:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    calculateCeiling();
  }, [profile, accounts.length]);

  return { ceiling, breakdown, loading, refresh: calculateCeiling };
}
