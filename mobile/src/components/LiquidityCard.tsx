import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency } from '../utils/format';
import { Layers } from 'lucide-react-native';

interface LiquidityCardProps {
  netLiquidityCents: number;
  totalAssetsCents: number;
  isCrisis?: boolean;
}

export default function LiquidityCard({ netLiquidityCents, totalAssetsCents, isCrisis }: LiquidityCardProps) {
  const isNegative = netLiquidityCents < 0;

  return (
    <View className="w-full p-8 bg-white/[0.03] border border-white/10 rounded-[40px] shadow-2xl mb-6 overflow-hidden">
      {/* Background Glow */}
      <View 
        className={`absolute -top-20 -right-20 w-40 h-40 blur-[80px] rounded-full opacity-20 ${isNegative ? 'bg-red-600' : 'bg-emerald-600'}`} 
      />

      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          <View className={`w-10 h-10 rounded-2xl items-center justify-center border ${isNegative ? 'bg-red-500/20 border-red-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
            <Layers size={18} color={isNegative ? "#f87171" : "#34d399"} />
          </View>
          <View>
            <Text className="text-white font-bold text-lg">Patrimônio Líquido</Text>
            <Text className="text-white/40 text-xs">Considerando todas as dívidas</Text>
          </View>
        </View>
      </View>
      
      <Text className={`text-4xl font-bold tabular-nums mb-2 ${isNegative ? 'text-red-400' : 'text-white'}`}>
        {formatCurrency(netLiquidityCents)}
      </Text>
      
      <View className="flex-row items-center gap-2">
        <View className={`px-2 py-1 rounded-lg border ${isNegative ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
          <Text className={`text-[10px] font-bold ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
            {isNegative ? 'EM RISCO DE LIQUIDEZ' : 'FLUXO SAUDÁVEL'}
          </Text>
        </View>
        <Text className="text-white/20 text-[10px] font-bold uppercase tracking-tighter">
          Bruto: {formatCurrency(totalAssetsCents)}
        </Text>
      </View>
    </View>
  );
}
