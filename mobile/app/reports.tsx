import React from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Activity, PieChart, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useFinancialAnalysis } from '../src/hooks/useFinancialAnalysis';
import { formatCurrency } from '../src/utils/format';
import { MotiView } from 'moti';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function ReportsScreen() {
  const router = useRouter();
  const { analysis, loading } = useFinancialAnalysis();

  if (loading || !analysis) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </SafeAreaView>
    );
  }

  const { healthScore, netWorthHistory, incomeMix } = analysis;

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
        <Text className="text-white text-lg font-black uppercase tracking-widest">Insights Vesper</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Health Score Gauge */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-6 items-center"
        >
          <View className="flex-row items-center self-start mb-6">
            <View className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center mr-3">
              <Activity color="#60a5fa" size={20} />
            </View>
            <Text className="text-white font-black uppercase tracking-wider italic">Saúde Financeira</Text>
          </View>

          <View className="relative items-center justify-center">
            <HealthGauge score={healthScore} />
            <View className="absolute items-center">
              <Text className="text-5xl font-black text-white">{healthScore}</Text>
              <Text className="text-white/30 text-[8px] font-black uppercase tracking-[0.3em]">Score Vesper</Text>
            </View>
          </View>

          <View className="w-full mt-8 p-4 rounded-2xl bg-white/5 border border-white/10 flex-row items-center">
            {healthScore >= 70 ? (
              <ShieldCheck color="#34d399" size={20} className="mr-3" />
            ) : (
              <AlertCircle color="#fbbf24" size={20} className="mr-3" />
            )}
            <Text className="flex-1 text-white/60 text-[11px] font-bold leading-relaxed">
              {healthScore >= 70 
                ? "Sua estrutura está resiliente. Ótimo momento para novos aportes."
                : "Atenção ao fluxo de caixa. Considere reduzir gastos variáveis."}
            </Text>
          </View>
        </MotiView>

        {/* Net Worth History (Simplified bars for now) */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}
          className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-6"
        >
          <View className="flex-row items-center mb-8">
            <View className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 items-center justify-center mr-3">
              <TrendingUp color="#a78bfa" size={20} />
            </View>
            <Text className="text-white font-black uppercase tracking-wider italic">Patrimônio</Text>
          </View>

          <View className="flex-row items-end justify-between h-32">
            {netWorthHistory.map((item: any, i: number) => {
              const max = Math.max(...netWorthHistory.map((h: any) => h.amount));
              const height = (item.amount / (max || 1)) * 100;
              return (
                <View key={i} className="items-center">
                  <View 
                    style={{ height: `${height}%` }}
                    className="w-8 bg-violet-600 rounded-t-lg opacity-80" 
                  />
                  <Text className="text-white/20 text-[8px] font-black uppercase mt-2">{item.month}</Text>
                </View>
              );
            })}
          </View>
        </MotiView>

        {/* Income Mix */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 }}
          className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-10"
        >
          <View className="flex-row items-center mb-8">
            <View className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 items-center justify-center mr-3">
              <PieChart color="#f472b6" size={20} />
            </View>
            <Text className="text-white font-black uppercase tracking-wider italic">Mix de Receitas</Text>
          </View>

          {incomeMix.length === 0 ? (
            <Text className="text-white/20 italic text-center py-4">Nenhuma receita detectada nos últimos 30 dias</Text>
          ) : (
            incomeMix.map((item: any, i: number) => (
              <View key={i} className="flex-row items-center justify-between mb-4">
                <Text className="text-white font-bold">{item.name}</Text>
                <Text className="text-white/60 font-black tracking-tight">{formatCurrency(item.value * 100)}</Text>
              </View>
            ))
          )}
        </MotiView>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthGauge({ score }: { score: number }) {
  const radius = 40;
  const strokeWidth = 8;
  const circumference = Math.PI * radius; // Meio círculo
  const offset = circumference - (score / 100) * circumference;

  return (
    <Svg viewBox="0 0 100 50" width={200} height={100}>
      <Defs>
        <LinearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#ef4444" />
          <Stop offset="50%" stopColor="#f59e0b" />
          <Stop offset="100%" stopColor="#10b981" />
        </LinearGradient>
      </Defs>
      <Path
        d="M 10,45 A 40,40 0 0 1 90,45"
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M 10,45 A 40,40 0 0 1 90,45"
        fill="none"
        stroke="url(#healthGradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </Svg>
  );
}
