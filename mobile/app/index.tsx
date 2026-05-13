import React from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import TransactionList from '../src/components/TransactionList';

export default function Dashboard() {
  return (
    <SafeAreaView className="flex-1 bg-[#090909]">
      <ScrollView 
        className="flex-1 px-4 py-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8">
          <Text className="text-white/40 text-sm font-bold uppercase tracking-[2px] mb-1">
            Dashboard
          </Text>
          <Text className="text-white text-3xl font-bold tracking-tight">
            Vesper Finance
          </Text>
        </View>

        {/* Liquidity Card Placeholder */}
        <View className="w-full p-8 bg-white/[0.03] border border-white/10 rounded-[40px] shadow-2xl mb-6">
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-emerald-500/20 rounded-2xl items-center justify-center border border-emerald-500/30">
                <Text className="text-emerald-400 font-bold">L</Text>
              </View>
              <View>
                <Text className="text-white font-bold text-lg">Liquidez Total</Text>
                <Text className="text-white/40 text-xs">Atualizado agora</Text>
              </View>
            </View>
          </View>
          
          <Text className="text-white text-4xl font-bold tabular-nums mb-2">
            R$ 45.230,00
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Text className="text-emerald-400 text-[10px] font-bold">+12% este mês</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid Placeholder */}
        <View className="flex-row gap-4 mb-10">
          <View className="flex-1 p-6 bg-white/[0.03] border border-white/10 rounded-[32px]">
            <Text className="text-white/40 text-[10px] font-bold uppercase mb-1">Entradas</Text>
            <Text className="text-emerald-400 text-xl font-bold">R$ 8.400</Text>
          </View>
          <View className="flex-1 p-6 bg-white/[0.03] border border-white/10 rounded-[32px]">
            <Text className="text-white/40 text-[10px] font-bold uppercase mb-1">Saídas</Text>
            <Text className="text-red-400 text-xl font-bold">R$ 3.250</Text>
          </View>
        </View>

        <TransactionList />

      </ScrollView>
    </SafeAreaView>
  );
}
