import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export function useAccountDetails(accountId: string) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDetails() {
    if (!accountId) return;
    try {
      setLoading(true);
      
      const { data: txs, error: txsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .limit(20);

      if (txsError) throw txsError;
      setTransactions(txs || []);

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

  async function payInvoice(creditCardAccount: any, paymentAccountId: string, amountCents: number) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cDay = creditCardAccount.closing_day || 31;
      const now = new Date();
      let closedY = now.getFullYear();
      let closedM = now.getMonth();
      if (now.getDate() < cDay) {
        closedM--;
        if (closedM < 0) { closedM = 11; closedY--; }
      }
      const closedMonthStr = `${closedY}-${String(closedM + 1).padStart(2, '0')}-01`;

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, date')
        .eq('account_id', creditCardAccount.id)
        .eq('is_paid', false);

      const toPayIds = (txs || []).filter(tx => {
        const d = new Date(tx.date);
        let m = d.getUTCMonth();
        let y = d.getUTCFullYear();
        if (d.getUTCDate() >= cDay) {
          m++;
          if (m > 11) { m = 0; y++; }
        }
        return `${y}-${String(m + 1).padStart(2, '0')}-01` === closedMonthStr;
      }).map(tx => tx.id);

      if (toPayIds.length > 0) {
        await supabase.from('transactions').update({ is_paid: true }).in('id', toPayIds);
        await supabase.from('credit_card_invoices')
          .update({ status: 'PAID' })
          .eq('account_id', creditCardAccount.id)
          .eq('reference_month', closedMonthStr.substring(0, 7));
      }

      await supabase.from('transactions').insert([{
        user_id: user.id,
        account_id: paymentAccountId,
        amount_cents: amountCents,
        transaction_type: 'EXPENSE',
        date: new Date().toISOString(),
        description: `Pgto Fatura — ${creditCardAccount.name}`,
        is_paid: true,
        source: 'MANUAL'
      }]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchDetails();
    } catch (error) {
      console.error('Error paying invoice:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  useEffect(() => {
    fetchDetails();
  }, [accountId]);

  return { transactions, invoices, loading, payInvoice, refresh: fetchDetails };
}
