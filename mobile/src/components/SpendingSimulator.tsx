import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Sparkles, X, Plus, Calculator, Hash } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';

interface SpendingSimulatorProps {
  onSimulate: (simulation: { description: string; amount_cents: number; installments: number }) => void;
  onClose: () => void;
}

export default function SpendingSimulator({ onSimulate, onClose }: SpendingSimulatorProps) {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [installments, setInstallments] = useState('1');

  const handleSimulate = () => {
    if (!value) return;
    
    const amountCents = Math.round(parseFloat(value.replace(',', '.')) * 100);
    const inst = parseInt(installments) || 1;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSimulate({
      description: description || 'Nova Aquisição',
      amount_cents: amountCents,
      installments: inst
    });
    onClose();
  };

  return (
    <View className="absolute inset-0 z-50 justify-end">
      <Pressable 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onPress={onClose} 
      />
      
      <MotiView
        from={{ translateY: 400 }}
        animate={{ translateY: 0 }}
        exit={{ translateY: 400 }}
        transition={{ type: 'spring', damping: 20 }}
        className="bg-[#0a0a0a] border-t border-white/10 rounded-t-[40px] px-8 pt-8 pb-12"
      >
        <View className="flex-row justify-between items-center mb-8">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-violet-600/20 border border-violet-600/30 rounded-2xl items-center justify-center mr-4">
              <Calculator color="#8b5cf6" size={20} />
            </View>
            <Text className="text-white text-xl font-black uppercase tracking-widest">Time Machine</Text>
          </View>
          <Pressable onPress={onClose} className="p-2 bg-white/5 rounded-full">
            <X color="#fff" size={20} />
          </Pressable>
        </View>

        <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px] mb-8 leading-relaxed">
          Simule o impacto de um novo gasto ou investimento nas suas projeções de liquidez futura.
        </Text>

        <View className="space-y-6">
          {/* Valor */}
          <View>
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Qual o valor total?</Text>
            <TextInput
              className="text-white text-5xl font-black tracking-tighter"
              placeholder="0,00"
              placeholderTextColor="rgba(255,255,255,0.05)"
              keyboardType="numeric"
              value={value}
              onChangeText={setValue}
              autoFocus
            />
          </View>

          {/* Descrição */}
          <View>
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">O que você está simulando?</Text>
            <TextInput
              className="bg-white/5 border border-white/10 rounded-[24px] px-5 py-5 text-white text-base font-bold"
              placeholder="Ex: Novo iPhone, Viagem, Curso..."
              placeholderTextColor="rgba(255,255,255,0.15)"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Parcelas */}
          <View>
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Em quantas parcelas?</Text>
            <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4">
              <Hash size={18} color="rgba(255,255,255,0.2)" className="mr-3" />
              <TextInput
                className="flex-1 text-white text-base font-bold"
                placeholder="1"
                placeholderTextColor="rgba(255,255,255,0.1)"
                keyboardType="numeric"
                value={installments}
                onChangeText={setInstallments}
              />
              <Text className="text-white/40 text-[10px] font-black uppercase">Vezes</Text>
            </View>
          </View>
        </View>

        <Pressable 
          onPress={handleSimulate}
          className="bg-violet-600 w-full py-6 rounded-[32px] items-center mt-10 shadow-2xl shadow-violet-600/20"
        >
          <View className="flex-row items-center">
            <Sparkles size={18} color="#fff" className="mr-3" />
            <Text className="text-white font-black uppercase tracking-widest">Ver Impacto no Futuro</Text>
          </View>
        </Pressable>
      </MotiView>
    </View>
  );
}
