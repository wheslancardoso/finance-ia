import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export function useTransactions() {
  const [loading, setLoading] = useState(false);

  const createTransaction = async (data: any) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').insert([data]);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating transaction:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createTransfer = async (data: {
    from_account_id: string;
    to_account_id: string;
    amount_cents: number;
    description?: string;
    date: string;
  }) => {
    setLoading(true);
    try {
      // No Supabase, idealmente usaríamos uma RPC para transação atômica
      // Mas para simplificar agora, faremos duas operações de saldo + uma transação
      
      // 1. Diminuir saldo origem
      const { data: fromAcc } = await supabase.from('accounts').select('balance_cents').eq('id', data.from_account_id).single();
      await supabase.from('accounts').update({ 
        balance_cents: (fromAcc?.balance_cents || 0) - data.amount_cents 
      }).eq('id', data.from_account_id);

      // 2. Aumentar saldo destino
      const { data: toAcc } = await supabase.from('accounts').select('balance_cents').eq('id', data.to_account_id).single();
      await supabase.from('accounts').update({ 
        balance_cents: (toAcc?.balance_cents || 0) + data.amount_cents 
      }).eq('id', data.to_account_id);

      // 3. Registrar a transação de transferência
      const { error } = await supabase.from('transactions').insert([{
        description: data.description || 'Transferência entre contas',
        amount_cents: data.amount_cents,
        transaction_type: 'TRANSFER',
        account_id: data.from_account_id,
        date: data.date,
        is_paid: true
      }]);

      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating transfer:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { createTransaction, createTransfer, loading };
}
