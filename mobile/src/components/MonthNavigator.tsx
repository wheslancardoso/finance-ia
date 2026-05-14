import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { format, addMonths, startOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface MonthNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export default function MonthNavigator({ selectedDate, onDateChange }: MonthNavigatorProps) {
  const months = Array.from({ length: 7 }, (_, i) => addMonths(startOfMonth(new Date()), i));

  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable 
          onPress={() => onDateChange(addMonths(selectedDate, -1))}
          className="p-2 bg-white/5 rounded-xl border border-white/10"
        >
          <ChevronLeft color="#fff" size={20} />
        </Pressable>
        
        <View className="items-center">
          <Text className="text-white text-lg font-black uppercase tracking-widest">
            {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
          </Text>
          {isSameMonth(selectedDate, new Date()) && (
            <View className="bg-emerald-500/20 px-2 py-0.5 rounded-full mt-1">
              <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-widest">
                Mês Atual
              </Text>
            </View>
          )}
        </View>

        <Pressable 
          onPress={() => onDateChange(addMonths(selectedDate, 1))}
          className="p-2 bg-white/5 rounded-xl border border-white/10"
        >
          <ChevronRight color="#fff" size={20} />
        </Pressable>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
      >
        {months.map((month) => {
          const isSelected = isSameMonth(month, selectedDate);
          return (
            <Pressable
              key={month.toISOString()}
              onPress={() => onDateChange(month)}
              className={`mr-3 px-6 py-3 rounded-2xl border ${
                isSelected 
                  ? 'bg-violet-600 border-violet-500' 
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-widest ${
                isSelected ? 'text-white' : 'text-white/40'
              }`}>
                {format(month, 'MMM', { locale: ptBR })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
