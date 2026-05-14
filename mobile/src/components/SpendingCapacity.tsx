import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { Sparkles, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { formatCurrency } from '../utils/format';

interface SpendingCapacityProps {
  category: string;
  spent: number;
  limit: number;
}

export default function SpendingCapacity({ category, spent, limit }: SpendingCapacityProps) {
  const percentage = Math.min((spent / limit) * 100, 100);
  const remaining = limit - spent;
  const isOverBudget = spent > limit;
  
  const getProgressColor = () => {
    if (percentage < 50) return '#8b5cf6'; // violet
    if (percentage < 85) return '#6366f1'; // indigo
    return '#f59e0b'; // amber
  };

  return (
    <View className="bg-white/5 border border-white/10 rounded-[32px] p-6 mb-4 relative overflow-hidden">
      <View className="flex-row items-start justify-between mb-6">
        <View>
          <View className="flex-row items-center mb-1">
            <Text className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded-full">
              Capacidade de Gasto
            </Text>
          </View>
          <Text className="text-xl font-bold text-white tracking-tight">
            {category}
          </Text>
        </View>
        <View className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
          isOverBudget 
            ? 'bg-amber-500/10 border-amber-500/20' 
            : 'bg-emerald-500/10 border-emerald-500/20'
        }`}>
          {isOverBudget 
            ? <AlertCircle size={20} color="#f59e0b" /> 
            : <CheckCircle2 size={20} color="#34d399" />
          }
        </View>
      </View>

      <View className="space-y-4">
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-xs font-black text-white/20 uppercase tracking-wider">
              {isOverBudget ? 'Excesso' : 'Margem de Segurança'}
            </Text>
            <Text className="text-2xl font-black text-white tabular-nums">
              {formatCurrency(Math.abs(remaining))}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs font-black text-white/20 uppercase tracking-wider mb-1">
              Status
            </Text>
            <Text className={`text-xs font-black uppercase tracking-tight ${
              isOverBudget ? 'text-amber-500' : 'text-emerald-400'
            }`}>
              {isOverBudget ? 'Ajuste Necessário' : 'Zona Segura'}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <MotiView
            from={{ width: '0%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'timing', duration: 1000 }}
            style={{
              height: '100%',
              backgroundColor: getProgressColor(),
              borderRadius: 10,
              shadowColor: getProgressColor(),
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
            }}
          />
        </View>

        <View className="flex-row justify-between items-center pt-2">
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-violet-500 mr-2" />
            <Text className="text-[10px] font-black text-white/30 uppercase tracking-tighter">
              Meta: {formatCurrency(limit)}
            </Text>
          </View>
          <View className="flex-row items-center">
            <TrendingDown size={12} color="rgba(255,255,255,0.4)" className="mr-1" />
            <Text className="text-[10px] font-black text-white/40 uppercase tracking-tighter italic">
              {percentage.toFixed(0)}% utilizado
            </Text>
          </View>
        </View>
      </View>

      {!isOverBudget && (
        <View className="mt-6 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex-row items-center">
          <Sparkles size={16} color="#34d399" className="mr-3" />
          <Text className="text-[10px] text-emerald-400/80 font-bold leading-tight flex-1">
            Ótimo ritmo! Manter esse controle garante o sucesso da sua meta de economia.
          </Text>
        </View>
      )}
    </View>
  );
}
