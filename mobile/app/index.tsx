import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import TransactionList from '../src/components/TransactionList';
import LiquidityCard from '../src/components/LiquidityCard';
import { useFinancialSummary } from '../src/hooks/useFinancialSummary';
import { formatCurrency } from '../src/utils/format';

export default function Dashboard() {
  const { summary, loading, refresh } = useFinancialSummary();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#090909] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#090909]">
      <ScrollView 
        className="flex-1 px-4 py-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#10b981" />
        }
      >
        <View className="mb-8">
          <Text className="text-white/40 text-sm font-bold uppercase tracking-[2px] mb-1">
            Dashboard
          </Text>
          <Text className="text-white text-3xl font-bold tracking-tight">
            Vesper Finance
          </Text>
        </View>

        <LiquidityCard 
          netLiquidityCents={summary?.netLiquidityCents || 0}
          totalAssetsCents={summary?.accumulatedBalanceCents || 0}
          isCrisis={summary?.outlook?.isCrisisMode}
        />

        {/* Stats Grid */}
        <View className="flex-row gap-4 mb-10">
          <View className="flex-1 p-6 bg-white/[0.03] border border-white/10 rounded-[32px]">
            <Text className="text-white/40 text-[10px] font-bold uppercase mb-1">Entradas</Text>
            <Text className="text-emerald-400 text-xl font-bold">
              {formatCurrency(summary?.incomeCents || 0)}
            </Text>
          </View>
          <View className="flex-1 p-6 bg-white/[0.03] border border-white/10 rounded-[32px]">
            <Text className="text-white/40 text-[10px] font-bold uppercase mb-1">Saídas</Text>
            <Text className="text-red-400 text-xl font-bold">
              {formatCurrency(summary?.expenseCents || 0)}
            </Text>
          </View>
        </View>

        <TransactionList />

      </ScrollView>
    </SafeAreaView>
  );
}
