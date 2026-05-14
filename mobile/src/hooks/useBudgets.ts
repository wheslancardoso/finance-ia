import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export interface Budget {
  id: string;
  category_id: string;
  amount_cents: number;
  spent_cents: number;
  category_name?: string;
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchBudgets() {
    try {
      setLoading(true);
      // Buscar orçamentos
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budgets')
        .select(`
          *,
          categories (
            name
          )
        `);

      if (budgetsError) throw budgetsError;

      // Buscar transações do mês atual para calcular o gasto real
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount_cents, category_id')
        .eq('transaction_type', 'EXPENSE')
        .gte('date', firstDay);

      if (transactionsError) throw transactionsError;

      // Mapear gastos por categoria
      const spentByCategory: Record<string, number> = {};
      transactionsData?.forEach(tx => {
        if (tx.category_id) {
          spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] || 0) + tx.amount_cents;
        }
      });

      const formattedBudgets = budgetsData?.map(b => ({
        ...b,
        category_name: b.categories?.name || 'Sem Categoria',
        spent_cents: spentByCategory[b.category_id] || 0
      })) || [];

      setBudgets(formattedBudgets);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBudgets();
  }, []);

  return { budgets, loading, refresh: fetchBudgets };
}
