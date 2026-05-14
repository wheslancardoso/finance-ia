import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TextInput, ScrollView, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import TransactionItem from './TransactionItem';
import { TransactionSkeleton } from './Skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, LayoutGrid } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTransactions } from '../hooks/useTransactions';

interface TransactionListProps {
  limit?: number;
  onEdit?: (transaction: any) => void;
}

export default function TransactionList({ limit = 20, onEdit }: TransactionListProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const { deleteTransaction } = useTransactions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

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

  async function fetchAccounts() {
    try {
      const { data, error } = await supabase.from('accounts').select('*').order('name');
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesAccount = !selectedAccountId || tx.account_id === selectedAccountId;
      const matchesSearch = !searchQuery || 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesAccount && matchesSearch;
    });
  }, [transactions, selectedAccountId, searchQuery]);

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

  async function handleDelete(id: string) {
    try {
      await deleteTransaction(id);
      setTransactions(prev => prev.filter(tx => tx.id !== id));
    } catch (err) {
      // Erro tratado no hook
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
      {/* Search Bar */}
      <View className="flex-row items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-4">
        <Search size={16} color="rgba(255,255,255,0.4)" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar transações..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          className="flex-1 ml-3 text-white text-sm"
        />
      </View>

      {/* Account Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6">
        <Pressable
          onPress={() => setSelectedAccountId(null)}
          className={`px-5 py-2 rounded-xl border flex-row items-center mr-2 ${
            !selectedAccountId ? 'bg-violet-600 border-violet-500' : 'bg-white/5 border-white/10'
          }`}
        >
          <LayoutGrid size={12} color={!selectedAccountId ? '#fff' : 'rgba(255,255,255,0.4)'} />
          <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${
            !selectedAccountId ? 'text-white' : 'text-white/40'
          }`}>Tudo</Text>
        </Pressable>
        {accounts.map((acc) => (
          <Pressable
            key={acc.id}
            onPress={() => setSelectedAccountId(acc.id)}
            className={`px-5 py-2 rounded-xl border mr-2 ${
              selectedAccountId === acc.id ? 'bg-white/10 border-white/30' : 'bg-white/5 border-white/10'
            }`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-widest ${
              selectedAccountId === acc.id ? 'text-white' : 'text-white/40'
            }`}>{acc.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="flex-row items-center justify-between mb-4 px-1">
        <Text className="text-white/60 text-xs font-bold uppercase tracking-[2px]">
          {searchQuery || selectedAccountId ? 'Resultados' : 'Transações Recentes'}
        </Text>
        <Text className="text-emerald-400 text-xs font-bold">
          {filteredTransactions.length} total
        </Text>
      </View>

      {filteredTransactions.length === 0 ? (
        <View className="py-20 items-center bg-white/[0.02] rounded-[40px] border border-white/5 border-dashed">
          <Search size={32} color="rgba(255,255,255,0.1)" className="mb-4" />
          <Text className="text-white/20 font-medium">Nenhuma transação encontrada</Text>
        </View>
      ) : (
        <View>
          {filteredTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              description={tx.description}
              amount={tx.amount_cents}
              date={format(new Date(tx.date), 'dd/MM/yy', { locale: ptBR })}
              category={tx.categories?.name || 'Sem Categoria'}
              account={tx.accounts?.name || 'Conta Geral'}
              isPaid={tx.is_paid}
              onTogglePaid={() => togglePaid(tx.id, tx.is_paid)}
              onDelete={() => handleDelete(tx.id)}
              onPress={() => onEdit?.(tx)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
