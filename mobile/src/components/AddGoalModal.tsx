import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Target, Calendar as CalendarIcon, Sparkles } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

interface AddGoalModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

const PRESET_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AddGoalModal({ onClose, onSave }: AddGoalModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '95%'], []);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [deadline, setDeadline] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    []
  );

  const handleSave = () => {
    if (!name || !targetAmount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      name,
      target_amount_cents: parseFloat(targetAmount.replace(/[^0-9]/g, '')),
      monthly_contribution_cents: parseFloat(monthlyContribution.replace(/[^0-9]/g, '') || '0'),
      deadline: deadline.toISOString(),
      color_hex: selectedColor,
    });
    bottomSheetRef.current?.close();
  };

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
      <ScrollView className="flex-1 px-6 pt-4">
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-white text-xl font-black uppercase tracking-widest">Nova Meta</Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">Nome do Objetivo</Text>
          <TextInput
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-base font-bold"
            placeholder="Ex: Viagem Japão, Reserva Emergência..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View className="flex-row gap-4 mb-8">
          <View className="flex-1">
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">Valor Alvo</Text>
            <TextInput
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-base font-bold"
              placeholder="R$ 0,00"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />
          </View>
          <View className="flex-1">
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">Aporte Mensal</Text>
            <TextInput
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-base font-bold"
              placeholder="R$ 0,00"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="numeric"
              value={monthlyContribution}
              onChangeText={setMonthlyContribution}
            />
          </View>
        </View>

        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">Data Limite</Text>
          <Pressable 
            onPress={() => setShowDatePicker(true)}
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 flex-row items-center justify-between"
          >
            <Text className="text-white font-bold">
              {deadline.toLocaleDateString('pt-BR')}
            </Text>
            <CalendarIcon color="#fff" size={20} />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={deadline}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDeadline(selectedDate);
              }}
            />
          )}
        </View>

        <View className="mb-10">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-3">Identidade Visual</Text>
          <View className="flex-row gap-3">
            {PRESET_COLORS.map(color => (
              <Pressable
                key={color}
                onPress={() => setSelectedColor(color)}
                className={`w-10 h-10 rounded-full border-2 ${selectedColor === color ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </View>
        </View>

        <Pressable 
          onPress={handleSave}
          className="w-full py-5 rounded-2xl items-center bg-violet-600 shadow-xl shadow-violet-600/20 mb-10"
        >
          <Text className="text-white font-black uppercase tracking-widest">Criar Meta</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}
