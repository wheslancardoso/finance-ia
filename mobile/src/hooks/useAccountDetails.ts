import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction } from '../hooks/useTransactions'; // I should define Transaction type somewhere shared

export function useAccountDetails(accountId: string) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDetails() {
    try {
      setLoading(true);
      
      // 1. Transações recentes da conta
      const { data: txs, error: txsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .limit(20);

      if (txsError) throw txsError;
      setTransactions(txs || []);

      // 2. Faturas se for cartão (tentativa)
      const { data: invs, error: invsError } = await supabase
        .from('credit_card_invoices')
        .select('*')
        .eq('account_id', accountId)
        .order('reference_month', { ascending: false });

      if (!invsError) {
        setInvoices(invs || []);
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accountId) fetchDetails();
  }, [accountId]);

  return { transactions, invoices, loading, refresh: fetchDetails };
}
