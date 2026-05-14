import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Target, Tag } from 'lucide-react-native';
import { useBudgets } from '../hooks/useBudgets';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

interface AddBudgetModalProps {
  onClose: () => void;
  budget?: any; // If provided, we are editing
}

export default function AddBudgetModal({ onClose, budget }: AddBudgetModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);
  const { createBudget, updateBudget, deleteBudget } = useBudgets();

  const [categoryId, setCategoryId] = useState(budget?.category_id || '');
  const [amount, setAmount] = useState(budget ? (budget.amount_cents / 100).toString() : '');
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) {
        setCategories(data);
        if (!categoryId && data.length > 0) setCategoryId(data[0].id);
      }
    }
    fetchCategories();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    []
  );

  const handleSave = async () => {
    if (!categoryId || !amount) return;
    setSaving(true);
    
    const amountCents = Math.round(parseFloat(amount.replace(',', '.')) * 100) || 0;

    try {
      if (budget?.id) {
        await updateBudget(budget.id, {
          category_id: categoryId,
          amount_cents: amountCents,
        });
      } else {
        await createBudget({
          category_id: categoryId,
          amount_cents: amountCents,
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bottomSheetRef.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!budget?.id) return;
    try {
      await deleteBudget(budget.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bottomSheetRef.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
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
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-white text-xl font-black uppercase tracking-widest">
            {budget ? 'Editar Orçamento' : 'Novo Orçamento'}
          </Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        {/* Category Selection */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Categoria</Text>
          <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4 overflow-hidden">
            <Tag size={18} color="rgba(255,255,255,0.2)" className="mr-3" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat) => (
                <Pressable 
                  key={cat.id}
                  onPress={() => {
                    setCategoryId(cat.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`px-4 py-1.5 rounded-full mr-2 ${categoryId === cat.id ? 'bg-white/20' : 'bg-transparent'}`}
                >
                  <Text className={`text-xs font-bold ${categoryId === cat.id ? 'text-white' : 'text-white/40'}`}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Amount Input */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Limite Mensal</Text>
          <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-5">
            <Target size={20} color="rgba(255,255,255,0.2)" className="mr-3" />
            <Text className="text-white/20 font-black mr-2">R$</Text>
            <TextInput
              className="flex-1 text-white text-2xl font-black tracking-tight"
              placeholder="0,00"
              placeholderTextColor="rgba(255,255,255,0.1)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        <View className="flex-row gap-4 mt-4">
          {budget && (
            <Pressable 
              onPress={handleDelete}
              className="flex-1 py-6 rounded-[32px] bg-rose-500/10 border border-rose-500/20 items-center"
            >
              <Text className="text-rose-500 font-black uppercase tracking-widest">Excluir</Text>
            </Pressable>
          )}
          <Pressable 
            onPress={handleSave}
            disabled={saving}
            className="flex-[2] py-6 rounded-[32px] bg-violet-600 items-center shadow-2xl shadow-violet-600/20"
          >
            <Text className="text-white font-black uppercase tracking-widest">
              {saving ? 'Salvando...' : (budget ? 'Salvar Alterações' : 'Definir Limite')}
            </Text>
          </Pressable>
        </View>

        <View className="h-10" />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40
  },
});
