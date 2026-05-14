import { useState, useEffect } from 'react';
import { startOfMonth, addMonths, isSameMonth } from 'date-fns';
import { supabase } from '../lib/supabase';

export interface ProjectedTransaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: 'INCOME' | 'EXPENSE';
  date: string;
  category?: string;
  isRecurring?: boolean;
  accountName?: string;
  accountType?: string;
}

export function useProjectionTimeline(targetDate: Date, activeSimulations: any[] = []) {
  const [transactions, setTransactions] = useState<ProjectedTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchProjections() {
    try {
      setLoading(true);
      const targetMonth = startOfMonth(targetDate);
      const isFuture = targetMonth > startOfMonth(new Date());

      if (!isFuture) {
        setTransactions([]);
        return;
      }

      const [
        { data: recurring },
        { data: futureTxs }
      ] = await Promise.all([
        supabase.from('recurring_transactions').select('*').eq('status', 'active'),
        supabase.from('transactions').select('*, accounts(name, type)').gt('date', new Date().toISOString())
      ]);

      // 1. Transações futuras agendadas (parcelas de cartão)
      const filteredFuture = (futureTxs || [])
        .filter(t => isSameMonth(new Date(t.date), targetMonth))
        .map(t => ({
          id: t.id,
          description: t.description,
          amount_cents: t.amount_cents,
          transaction_type: t.transaction_type,
          date: t.date,
          category: t.category_id,
          accountName: t.accounts?.name,
          accountType: t.accounts?.type
        }));

      // 2. Transações virtuais baseadas em recorrentes
      const virtualRecurring = (recurring || []).map(r => ({
        id: `virtual-${r.id}`,
        description: r.description,
        amount_cents: r.amount_cents,
        transaction_type: r.transaction_type,
        date: targetMonth.toISOString(),
        category: r.category_id,
        isRecurring: true
      }));

      // 3. Simulações ativas
      const simulations = activeSimulations.flatMap((sim, simIdx) => {
        const installments = sim.installments || 1;
        const monthlyAmount = Math.round(sim.amount_cents / installments);
        const results = [];

        for (let i = 0; i < installments; i++) {
          const simDate = addMonths(new Date(), i);
          if (isSameMonth(simDate, targetDate)) {
            results.push({
              id: `sim-tx-${simIdx}-${i}`,
              description: `Simulado: ${sim.description || 'Compra'} (${i + 1}/${installments})`,
              amount_cents: monthlyAmount,
              transaction_type: 'EXPENSE' as const,
              date: simDate.toISOString(),
              category: "Simulação"
            });
          }
        }
        return results;
      });

      setTransactions([...filteredFuture, ...virtualRecurring, ...simulations]);
    } catch (error) {
      console.error('Error fetching projection timeline:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjections();
  }, [targetDate.toISOString(), activeSimulations.length]);

  return { transactions, loading, refresh: fetchProjections };
}
