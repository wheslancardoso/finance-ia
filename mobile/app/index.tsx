import { useState, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { CreditCard, Plus, History, Calculator, Target } from 'lucide-react-native';
import { startOfMonth, isSameMonth } from 'date-fns';

import TransactionList from '../src/components/TransactionList';
import LiquidityCard from '../src/components/LiquidityCard';
import AddTransactionModal from '../src/components/AddTransactionModal';
import MonthNavigator from '../src/components/MonthNavigator';
import ProjectedTimeline from '../src/components/ProjectedTimeline';
import NetWorthChart from '../src/components/NetWorthChart';
import GoalCard from '../src/components/GoalCard';

import { useFinancialAnalysis } from '../src/hooks/useFinancialAnalysis';
import { useProjectionTimeline } from '../src/hooks/useProjectionTimeline';
import { useGoals } from '../src/hooks/useGoals';
import { formatCurrency } from '../src/utils/format';

export default function Dashboard() {
  const router = useRouter();
  const [targetDate, setTargetDate] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary'>('summary');

  const monthOffset = useMemo(() => {
    const today = startOfMonth(new Date());
    const target = startOfMonth(targetDate);
    const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
    return Math.max(0, months);
  }, [targetDate]);

  const { analysis, loading, refresh } = useFinancialAnalysis(monthOffset);
  const { transactions: projectedTransactions } = useProjectionTimeline(targetDate);
  const { goals } = useGoals();

  const isFuture = monthOffset > 0;
  const isCurrentMonth = isSameMonth(targetDate, new Date());

  const chartData = useMemo(() => {
    if (!analysis) return [];
    // Mocking some data points for the chart based on current and projected liquidity
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return [
      { timestamp: now - 30 * dayMs, value: analysis.netLiquidityCents * 0.9 },
      { timestamp: now - 15 * dayMs, value: analysis.netLiquidityCents * 0.95 },
      { timestamp: now, value: analysis.netLiquidityCents },
      { timestamp: now + 30 * dayMs, value: analysis.monthlyOutlook?.projectedNetLiquidity || analysis.netLiquidityCents }
    ];
  }, [analysis]);

  if (loading && !analysis) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      <ScrollView 
        className="flex-1 px-4 py-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#10b981" />
        }
      >
        <View className="mb-8 flex-row justify-between items-end">
          <View>
            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[3px] mb-1">
              Time Machine
            </Text>
            <Text className="text-white text-3xl font-black tracking-tight">
              Vesper
            </Text>
          </View>
          <Pressable 
            onPress={() => router.push('/accounts')}
            className="p-3 bg-white/5 border border-white/10 rounded-2xl"
          >
            <CreditCard color="#fff" size={20} />
          </Pressable>
        </View>

        <MonthNavigator 
          selectedDate={targetDate} 
          onDateChange={setTargetDate} 
        />

        <LiquidityCard 
          netLiquidityCents={analysis?.netLiquidityCents || 0}
          totalAssetsCents={analysis?.accumulatedBalanceCents || 0}
          isCrisis={analysis?.monthlyOutlook?.isCrisisMode}
        />

        {isCurrentMonth && (
          <View className="flex-row gap-4 mb-10">
            <View className="flex-1 p-6 bg-white/[0.03] border border-white/10 rounded-[32px]">
              <Text className="text-white/40 text-[10px] font-black uppercase mb-1">Entradas</Text>
              <Text className="text-emerald-400 text-xl font-bold">
                {formatCurrency(analysis?.incomeCents || 0)}
              </Text>
            </View>
            <View className="flex-1 p-6 bg-white/[0.03] border border-white/10 rounded-[32px]">
              <Text className="text-white/40 text-[10px] font-black uppercase mb-1">Saídas</Text>
              <Text className="text-red-400 text-xl font-bold">
                {formatCurrency(analysis?.expenseCents || 0)}
              </Text>
            </View>
          </View>
        )}

        {!isCurrentMonth && (
           <NetWorthChart data={chartData} />
        )}

        {/* Goals Section */}
        {isCurrentMonth && (
          <View className="mb-10">
            <View className="flex-row items-center justify-between mb-4 px-1">
              <Text className="text-white/60 text-xs font-bold uppercase tracking-[2px]">
                Suas Metas
              </Text>
              <Pressable onPress={() => router.push('/goals')}>
                <Text className="text-emerald-400 text-xs font-bold">Ver todas</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {goals.slice(0, 3).map((goal) => (
                <View key={goal.id} style={{ width: 280, marginRight: 16 }}>
                  <GoalCard 
                    goal={goal} 
                    onPress={() => router.push('/goals')}
                  />
                </View>
              ))}
              {goals.length === 0 && (
                <Pressable 
                  onPress={() => router.push('/goals')}
                  className="bg-white/[0.03] border border-white/10 border-dashed rounded-[32px] p-6 items-center justify-center"
                  style={{ width: 280 }}
                >
                  <Target size={24} color="rgba(255,255,255,0.2)" />
                  <Text className="text-white/20 text-[10px] font-black uppercase mt-2">Criar Primeira Meta</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}

        {/* Tab Selector */}
        <View className="flex-row bg-white/5 p-1 rounded-2xl border border-white/10 mb-6">
          <Pressable 
            onPress={() => setActiveTab('summary')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
              activeTab === 'summary' ? 'bg-violet-600' : ''
            }`}
          >
            <Calculator size={14} color={activeTab === 'summary' ? '#fff' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${
              activeTab === 'summary' ? 'text-white' : 'text-white/40'
            }`}>Resumo</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('timeline')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
              activeTab === 'timeline' ? 'bg-violet-600' : ''
            }`}
          >
            <History size={14} color={activeTab === 'timeline' ? '#fff' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${
              activeTab === 'timeline' ? 'text-white' : 'text-white/40'
            }`}>Linha do Tempo</Text>
          </Pressable>
        </View>

        {activeTab === 'summary' ? (
          <View>
             {/* Content for Summary - already covered by LiquidityCard and stats for now */}
             <TransactionList limit={5} />
          </View>
        ) : (
          isFuture ? (
            <ProjectedTimeline transactions={projectedTransactions} />
          ) : (
            <TransactionList />
          )
        )}

        {/* Spacer for FAB */}
        <View className="h-24" />

      </ScrollView>

      {/* FAB */}
      {isCurrentMonth && (
        <Pressable 
          onPress={() => setShowAddModal(true)}
          className="absolute bottom-10 right-6 w-16 h-16 bg-white rounded-full items-center justify-center shadow-xl shadow-white/20"
        >
          <Plus color="#000" size={32} />
        </Pressable>
      )}

      {showAddModal && (
        <AddTransactionModal 
          onClose={() => setShowAddModal(false)}
          onSave={(data) => {
            console.log('Saving transaction:', data);
            setShowAddModal(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}
