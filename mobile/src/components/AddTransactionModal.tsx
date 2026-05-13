import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Plus, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { formatCurrency } from '../utils/format';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function AddTransactionModal({ onClose, onSave }: AddTransactionModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '85%'], []);

  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        opacity={0.5}
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#0a0a0a' }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
    >
      <BottomSheetView style={styles.contentContainer}>
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-white text-xl font-bold">Nova Transação</Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        {/* Type Toggle */}
        <View className="flex-row p-1 bg-white/5 rounded-2xl mb-8">
          <Pressable 
            onPress={() => setType('EXPENSE')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${type === 'EXPENSE' ? 'bg-rose-500/20 border border-rose-500/50' : ''}`}
          >
            <ArrowDownLeft size={16} color={type === 'EXPENSE' ? '#f43f5e' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 font-bold ${type === 'EXPENSE' ? 'text-rose-400' : 'text-white/40'}`}>Despesa</Text>
          </Pressable>
          <Pressable 
            onPress={() => setType('INCOME')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${type === 'INCOME' ? 'bg-emerald-500/20 border border-emerald-500/50' : ''}`}
          >
            <ArrowUpRight size={16} color={type === 'INCOME' ? '#34d399' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 font-bold ${type === 'INCOME' ? 'text-emerald-400' : 'text-white/40'}`}>Receita</Text>
          </Pressable>
        </View>

        {/* Value Input */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-2">Valor</Text>
          <TextInput
            className="text-white text-4xl font-bold tracking-tight"
            placeholder="R$ 0,00"
            placeholderTextColor="rgba(255,255,255,0.1)"
            keyboardType="numeric"
            value={value}
            onChangeText={setValue}
          />
        </View>

        {/* Description Input */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-2">Descrição</Text>
          <TextInput
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-base"
            placeholder="Ex: Aluguel, Supermercado..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <Pressable 
          onPress={() => onSave({ type, value, description })}
          className={`w-full py-4 rounded-2xl items-center ${type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`}
        >
          <Text className="text-white font-bold text-base">Salvar Transação</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
