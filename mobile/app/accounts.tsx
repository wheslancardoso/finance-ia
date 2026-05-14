import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useAccounts, Account } from '../src/hooks/useAccounts';
import AccountCard from '../src/components/AccountCard';
import AccountDetailsModal from '../src/components/AccountDetailsModal';
import { formatCurrency } from '../src/utils/format';

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, loading, refresh } = useAccounts();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const totalBalanceCents = accounts.reduce((acc, curr) => 
    curr.type !== 'CREDIT_CARD' ? acc + curr.balance_cents : acc, 0
  );

  const totalCreditDebtCents = accounts.reduce((acc, curr) => 
    curr.type === 'CREDIT_CARD' ? acc + Math.abs(curr.balance_cents) : acc, 0
  );

  if (loading && accounts.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-white/5">
        <Pressable 
          onPress={() => router.back()}
          className="p-2 -ml-2"
        >
          <ChevronLeft color="#fff" size={24} />
        </Pressable>
        <Text className="text-white font-bold text-lg">Contas e Cartões</Text>
        <Pressable className="p-2 -mr-2 bg-emerald-500/10 rounded-full">
          <Plus color="#10b981" size={20} />
        </Pressable>
      </View>

      <ScrollView 
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#10b981" />
        }
      >
        {/* Consolidated Summary */}
        <View className="py-8 items-center">
          <Text className="text-white/40 text-[10px] font-bold uppercase tracking-[2px] mb-2">Saldo Total Consolidado</Text>
          <Text className="text-white text-4xl font-black tracking-tighter">
            {formatCurrency(totalBalanceCents - totalCreditDebtCents)}
          </Text>
          <View className="flex-row gap-4 mt-4">
            <View className="items-center">
              <Text className="text-white/20 text-[8px] font-bold uppercase mb-0.5">Ativos</Text>
              <Text className="text-emerald-400 font-bold text-sm">{formatCurrency(totalBalanceCents)}</Text>
            </View>
            <View className="w-[1px] h-4 bg-white/10 self-center" />
            <View className="items-center">
              <Text className="text-white/20 text-[8px] font-bold uppercase mb-0.5">Dívidas</Text>
              <Text className="text-rose-400 font-bold text-sm">{formatCurrency(totalCreditDebtCents)}</Text>
            </View>
          </View>
        </View>

        {/* Section: Accounts */}
        <View className="mb-8">
          <Text className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-6">Contas Correntes e Dinheiro</Text>
          {accounts.filter(a => a.type !== 'CREDIT_CARD').map((account, index) => (
            <AccountCard 
              key={account.id} 
              account={account} 
              index={index} 
              onPress={setSelectedAccount} 
            />
          ))}
        </View>

        {/* Section: Cards */}
        <View className="mb-12">
          <Text className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-6">Cartões de Crédito</Text>
          {accounts.filter(a => a.type === 'CREDIT_CARD').map((account, index) => (
            <AccountCard 
              key={account.id} 
              account={account} 
              index={index} 
              onPress={setSelectedAccount} 
            />
          ))}
        </View>
      </ScrollView>

      {selectedAccount && (
        <AccountDetailsModal 
          account={selectedAccount} 
          onClose={() => setSelectedAccount(null)} 
        />
      )}
    </SafeAreaView>
  );
}
