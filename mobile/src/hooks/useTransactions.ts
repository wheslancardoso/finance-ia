import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export interface Transaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  account_id: string;
  category_id?: string;
  date: string;
  is_paid: boolean;
}

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

  const createInstallmentSeries = async (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string;
    date: string;
  }) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const amountPerInstallment = Math.round(data.amount_total_cents / data.installments);
      const transactions = [];
      const startDate = new Date(data.date);

      for (let i = 0; i < data.installments; i++) {
        const txDate = new Date(startDate);
        txDate.setMonth(txDate.getMonth() + i);
        
        transactions.push({
          user_id: user.id,
          description: `${data.description} (${i + 1}/${data.installments})`,
          amount_cents: amountPerInstallment,
          transaction_type: 'EXPENSE',
          account_id: data.account_id,
          category_id: data.category_id,
          date: txDate.toISOString(),
          is_paid: i === 0, // Apenas a primeira parcela é marcada como paga geralmente
          installment_current: i + 1,
          installment_total: data.installments,
          source: 'MANUAL'
        });
      }

      const { error } = await supabase.from('transactions').insert(transactions);
      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating installments:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTransaction = async (id: string) => {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = async (id: string, data: any) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').update(data).eq('id', id);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating transaction:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { 
    createTransaction, 
    createTransfer, 
    createInstallmentSeries, 
    updateTransaction,
    deleteTransaction, 
    loading 
  };
}
