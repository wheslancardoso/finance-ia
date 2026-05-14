import React from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, PieChart, TrendingUp, TrendingDown, Target, Plus } from 'lucide-react-native';
import { useBudgets, Budget } from '../src/hooks/useBudgets';
import SpendingCapacity from '../src/components/SpendingCapacity';
import AddBudgetModal from '../src/components/AddBudgetModal';
import { formatCurrency } from '../src/utils/format';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { budgets, loading, refresh } = useBudgets();
  const [selectedBudget, setSelectedBudget] = React.useState<Budget | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount_cents, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_cents, 0);
  const remainingTotal = totalBudget - totalSpent;
  const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  if (loading && budgets.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      {/* Header */}
      <View className="px-4 py-6 flex-row items-center justify-between">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/5 items-center justify-center border border-white/10"
        >
          <ArrowLeft color="#fff" size={20} />
        </Pressable>
        <Text className="text-white text-lg font-black uppercase tracking-widest">Painel HUD</Text>
        <Pressable 
          onPress={() => setShowAddModal(true)}
          className="w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center border border-emerald-500/20"
        >
          <Plus color="#10b981" size={20} />
        </Pressable>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#8b5cf6" />
        }
      >
        {/* Consolidated Card */}
        <View className="bg-violet-600 rounded-[40px] p-8 mb-8 shadow-2xl shadow-violet-600/40">
           <View className="flex-row items-center justify-between mb-6">
              <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center">
                 <PieChart color="#fff" size={24} />
              </View>
              <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest">Resumo do Mês</Text>
           </View>
           
           <View className="mb-8">
              <Text className="text-white/60 text-[10px] font-black uppercase tracking-[2px] mb-1">Total Disponível</Text>
              <Text className="text-white text-4xl font-black tracking-tighter">
                {formatCurrency(remainingTotal)}
              </Text>
           </View>

           <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                 <TrendingDown size={16} color="rgba(255,255,255,0.6)" className="mr-2" />
                 <Text className="text-white/60 text-xs font-bold tabular-nums">
                    Gasto: {formatCurrency(totalSpent)}
                 </Text>
              </View>
              <View className="bg-white/20 px-3 py-1 rounded-full">
                 <Text className="text-white text-[10px] font-black">{totalPercentage.toFixed(0)}%</Text>
              </View>
           </View>
        </View>

        <View className="flex-row items-center justify-between mb-6 px-1">
          <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Teto por Categoria</Text>
          <Text className="text-violet-400 text-[10px] font-black uppercase tracking-[2px]">Ajustar Limites</Text>
        </View>

        {budgets.length === 0 ? (
          <View className="py-20 items-center justify-center bg-white/[0.02] rounded-[40px] border border-white/5 border-dashed">
            <Target size={40} color="rgba(255,255,255,0.1)" className="mb-4" />
            <Text className="text-white/20 font-medium">Nenhum orçamento definido</Text>
          </View>
        ) : (
          budgets.map((budget) => (
            <Pressable key={budget.id} onPress={() => setSelectedBudget(budget)}>
              <SpendingCapacity 
                category={budget.category_name || 'Geral'}
                spent={budget.spent_cents}
                limit={budget.amount_cents}
              />
            </Pressable>
          ))
        )}
        
        <View className="h-10" />
      </ScrollView>

      {(showAddModal || selectedBudget) && (
        <AddBudgetModal 
          budget={selectedBudget}
          onClose={() => {
            setShowAddModal(false);
            setSelectedBudget(null);
            refresh();
          }}
        />
      )}
    </SafeAreaView>
  );
}
