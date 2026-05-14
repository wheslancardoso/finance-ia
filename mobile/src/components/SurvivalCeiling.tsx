import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Shield, Zap, Info } from 'lucide-react-native';
import { useSurvivalCeiling } from '../hooks/useSurvivalCeiling';
import { formatCurrency } from '../utils/format';
import { MotiView } from 'moti';

export default function SurvivalCeiling() {
  const { ceiling, loading } = useSurvivalCeiling();

  if (loading && ceiling === 0) return null;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0f172a] border border-blue-500/20 rounded-[32px] p-6 mb-6 shadow-2xl shadow-blue-500/10"
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center mr-3">
            <Shield color="#3b82f6" size={16} />
          </View>
          <Text className="text-blue-400 text-[10px] font-black uppercase tracking-[2px]">Teto de Sobrevivência</Text>
        </View>
        <Zap color="#3b82f6" size={14} className="opacity-50" />
      </View>

      <View className="flex-row items-baseline">
        <Text className="text-white text-4xl font-black tracking-tighter">
          {formatCurrency(ceiling)}
        </Text>
        <Text className="text-blue-400/40 text-[10px] font-black uppercase ml-2 tracking-widest">Disponível</Text>
      </View>

      <View className="mt-6 flex-row items-center p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10">
        <Info size={12} color="#3b82f6" className="mr-2" />
        <Text className="text-blue-400/60 text-[9px] font-bold leading-relaxed">
          Este valor considera sua liquidez total menos compromissos de custo fixo e cartões para o mês vigente.
        </Text>
      </View>
    </MotiView>
  );
}
