import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sparkles, ShieldCheck } from 'lucide-react-native';
import { formatCurrency } from '../utils/format';
import { Goal } from '../hooks/useGoals';

interface GoalCardProps {
  goal: Goal;
  onPress?: () => void;
  onContribute?: () => void;
}

export default function GoalCard({ goal, onPress, onContribute }: GoalCardProps) {
  const percentage = Math.min((goal.current_amount_cents / goal.target_amount_cents) * 100, 100);
  const remaining = goal.target_amount_cents - goal.current_amount_cents;
  const isCompleted = percentage >= 100;
  const color = goal.color_hex || '#8b5cf6';

  return (
    <Pressable 
      onPress={onPress}
      className="bg-white/[0.03] border border-white/10 rounded-[32px] p-6 mb-4"
    >
      <View className="flex-row items-start justify-between mb-6">
        <View 
          className="w-12 h-12 rounded-2xl items-center justify-center border border-white/5"
          style={{ backgroundColor: `${color}15` }}
        >
          <Sparkles size={24} color={color} />
        </View>
        {goal.deadline && (
          <View className="items-end">
            <Text className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Prazo</Text>
            <Text className="text-white/60 text-[10px] font-bold">
              {new Date(goal.deadline).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        )}
      </View>

      {isCompleted && (
        <View className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl flex-row items-center gap-2 mb-4">
          <ShieldCheck size={12} color="#34d399" />
          <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-widest">
            Pronto para Compra
          </Text>
        </View>
      )}

      <View className="mb-4">
        <Text className="text-white text-xl font-bold tracking-tight mb-1">{goal.name}</Text>
        <View className="flex-row items-baseline justify-between">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-white font-bold">{formatCurrency(goal.current_amount_cents)}</Text>
            <Text className="text-white/20 text-[10px]">de {formatCurrency(goal.target_amount_cents)}</Text>
          </View>
          {goal.monthly_contribution_cents > 0 && (
            <Text className="text-emerald-400 text-[10px] font-black uppercase">
              {formatCurrency(goal.monthly_contribution_cents)}/mês
            </Text>
          )}
        </View>
      </View>

      <View className="space-y-3">
        <View className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <View 
            className="h-full rounded-full"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>
            {percentage.toFixed(1)}% Completo
          </Text>
          <Text className="text-white/20 text-[9px] font-black uppercase tracking-wider">
            Faltam {formatCurrency(remaining)}
          </Text>
        </View>
      </View>

      <View className="mt-6 pt-4 border-t border-white/5 flex-row items-center justify-between">
        <Text className="text-white/40 text-[9px] font-black uppercase tracking-widest">
          Detalhes
        </Text>
        <Pressable 
          onPress={onContribute}
          className="bg-white/5 px-4 py-2 rounded-xl"
        >
          <Text className="text-white text-[9px] font-black uppercase tracking-widest">Aportar</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
