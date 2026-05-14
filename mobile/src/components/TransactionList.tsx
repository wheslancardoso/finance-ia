import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import TransactionItem from './TransactionItem';
import { TransactionSkeleton } from './Skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionListProps {
  limit?: number;
}

import * as Haptics from 'expo-haptics';

export default function TransactionList({ limit = 20 }: TransactionListProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name), accounts(name)')
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  async function togglePaid(id: string, currentStatus: boolean) {
    try {
      // Feedback imediato ao toque
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from('transactions')
        .update({ is_paid: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setTransactions(prev => prev.map(tx => 
        tx.id === id ? { ...tx, is_paid: !currentStatus } : tx
      ));
      
      // Feedback de sucesso se estiver marcando como pago
      if (!currentStatus) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error toggling paid status:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  if (loading && !refreshing) {
    return (
      <View className="py-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <TransactionSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between mb-4 px-1">
        <Text className="text-white/60 text-xs font-bold uppercase tracking-[2px]">
          Transações Recentes
        </Text>
        <Text className="text-emerald-400 text-xs font-bold">Ver todas</Text>
      </View>

      {transactions.length === 0 ? (
        <View className="py-20 items-center bg-white/[0.02] rounded-[40px] border border-white/5 border-dashed">
          <Text className="text-white/20 font-medium">Nenhuma transação encontrada</Text>
        </View>
      ) : (
        <View>
          {transactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              description={tx.description}
              amount={tx.amount}
              date={format(new Date(tx.date), 'dd/MM/yy', { locale: ptBR })}
              category={tx.categories?.name || 'Sem Categoria'}
              account={tx.accounts?.name || 'Conta Geral'}
              isPaid={tx.is_paid}
              onTogglePaid={() => togglePaid(tx.id, tx.is_paid)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
