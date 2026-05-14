import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import { formatCurrency } from '../utils/format';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface NetWorthChartProps {
  data: DataPoint[];
}

export default function NetWorthChart({ data }: NetWorthChartProps) {
  if (!data || data.length === 0) return null;

  const latestValue = data[data.length - 1].value;
  const screenWidth = Dimensions.get('window').width - 32;

  return (
    <View className="mb-8">
      <View className="flex-row items-end justify-between mb-6">
        <View>
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-1">
            Patrimônio Líquido
          </Text>
          <Text className="text-white text-3xl font-black tracking-tight">
            {formatCurrency(latestValue)}
          </Text>
        </View>
      </View>

      <View className="h-40 w-full overflow-hidden">
        <LineChart.Provider data={data}>
          <LineChart height={140} width={screenWidth}>
            <LineChart.Path color="#8b5cf6" width={3}>
              <LineChart.Gradient color="#8b5cf6" opacity={0.2} />
            </LineChart.Path>
            <LineChart.CursorCrosshair color="#fff">
              <LineChart.Tooltip textStyle={{ color: '#fff', fontWeight: 'bold' }} />
            </LineChart.CursorCrosshair>
          </LineChart>
        </LineChart.Provider>
      </View>

      <View className="flex-row justify-between mt-4 border-t border-white/5 pt-4">
        <View>
          <Text className="text-white/20 text-[8px] font-black uppercase tracking-widest">Início do Ciclo</Text>
          <Text className="text-white/60 text-[10px] font-bold mt-1">Hoje</Text>
        </View>
        <View className="items-end">
          <Text className="text-white/20 text-[8px] font-black uppercase tracking-widest">Projeção 6 Meses</Text>
          <Text className="text-violet-400 text-[10px] font-bold mt-1">Meta</Text>
        </View>
      </View>
    </View>
  );
}
