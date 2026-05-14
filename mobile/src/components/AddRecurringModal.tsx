import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Repeat, Tag, CreditCard, Calendar } from 'lucide-react-native';
import { useRecurring, RecurringTransaction } from '../hooks/useRecurring';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

interface AddRecurringModalProps {
  onClose: () => void;
  recurring?: RecurringTransaction | null;
}

export default function AddRecurringModal({ onClose, recurring }: AddRecurringModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '95%'], []);
  const { createRecurring, updateRecurring, deleteRecurring } = useRecurring();

  const [description, setDescription] = useState(recurring?.description || '');
  const [amount, setAmount] = useState(recurring ? (Math.abs(recurring.amount_cents) / 100).toString() : '');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(recurring?.transaction_type || 'EXPENSE');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>(recurring?.frequency || 'monthly');
  const [accountId, setAccountId] = useState(recurring?.account_id || '');
  const [categoryId, setCategoryId] = useState(recurring?.category_id || '');
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: accs } = await supabase.from('accounts').select('*').order('name');
      if (accs) {
        setAccounts(accs);
        if (!accountId && accs.length > 0) setAccountId(accs[0].id);
      }
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) {
        setCategories(cats);
        if (!categoryId && cats.length > 0) setCategoryId(cats[0].id);
      }
    }
    fetchData();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    []
  );

  const handleSave = async () => {
    if (!description || !amount || !accountId) return;
    setSaving(true);
    
    const amountCents = Math.round(parseFloat(amount.replace(',', '.')) * 100) || 0;

    try {
      const data = {
        description,
        amount_cents: amountCents,
        transaction_type: type,
        frequency,
        account_id: accountId,
        category_id: categoryId || undefined,
        next_date: new Date().toISOString(), // In real app, would pick a date
      };

      if (recurring?.id) {
        await updateRecurring(recurring.id, data);
      } else {
        await createRecurring(data);
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
    if (!recurring?.id) return;
    try {
      await deleteRecurring(recurring.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bottomSheetRef.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const frequencies = [
    { id: 'weekly', label: 'Semanal' },
    { id: 'monthly', label: 'Mensal' },
    { id: 'yearly', label: 'Anual' },
  ];

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
            {recurring ? 'Editar Assinatura' : 'Nova Assinatura'}
          </Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        {/* Type Toggle */}
        <View className="flex-row p-1 bg-white/5 rounded-2xl mb-8">
          <Pressable 
            onPress={() => setType('EXPENSE')}
            className={`flex-1 py-3 rounded-xl items-center ${type === 'EXPENSE' ? 'bg-rose-500/20 border border-rose-500/50' : ''}`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-widest ${type === 'EXPENSE' ? 'text-rose-400' : 'text-white/40'}`}>Gasto</Text>
          </Pressable>
          <Pressable 
            onPress={() => setType('INCOME')}
            className={`flex-1 py-3 rounded-xl items-center ${type === 'INCOME' ? 'bg-emerald-500/20 border border-emerald-500/50' : ''}`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-widest ${type === 'INCOME' ? 'text-emerald-400' : 'text-white/40'}`}>Renda</Text>
          </Pressable>
        </View>

        {/* Description Input */}
        <View className="mb-6">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">O que é?</Text>
          <TextInput
            className="bg-white/5 border border-white/10 rounded-[24px] px-5 py-5 text-white text-base font-bold"
            placeholder="Ex: Netflix, Internet, Aluguel..."
            placeholderTextColor="rgba(255,255,255,0.15)"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Amount Input */}
        <View className="mb-6">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Valor</Text>
          <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4">
            <Text className="text-white/20 font-black mr-2">R$</Text>
            <TextInput
              className="flex-1 text-white text-3xl font-black tracking-tight"
              placeholder="0,00"
              placeholderTextColor="rgba(255,255,255,0.1)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        {/* Frequency Selector */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Frequência</Text>
          <View className="flex-row gap-2">
            {frequencies.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  setFrequency(f.id as any);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-1 py-4 rounded-2xl border items-center ${
                  frequency === f.id ? 'bg-violet-600 border-violet-500' : 'bg-white/5 border-white/10'
                }`}
              >
                <Text className={`text-[10px] font-bold uppercase tracking-widest ${
                  frequency === f.id ? 'text-white' : 'text-white/40'
                }`}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Account and Category Selectors (simplified for brevity) */}
        <View className="mb-8">
           <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Conta e Categoria</Text>
           <View className="flex-row gap-2">
              <View className="flex-1 bg-white/5 border border-white/10 rounded-[24px] p-4 flex-row items-center">
                 <CreditCard size={14} color="rgba(255,255,255,0.2)" className="mr-2" />
                 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {accounts.map(acc => (
                       <Pressable key={acc.id} onPress={() => setAccountId(acc.id)} className={`mr-4 ${accountId === acc.id ? 'opacity-100' : 'opacity-30'}`}>
                          <Text className="text-white text-[10px] font-bold">{acc.name}</Text>
                       </Pressable>
                    ))}
                 </ScrollView>
              </View>
              <View className="flex-1 bg-white/5 border border-white/10 rounded-[24px] p-4 flex-row items-center">
                 <Tag size={14} color="rgba(255,255,255,0.2)" className="mr-2" />
                 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {categories.map(cat => (
                       <Pressable key={cat.id} onPress={() => setCategoryId(cat.id)} className={`mr-4 ${categoryId === cat.id ? 'opacity-100' : 'opacity-30'}`}>
                          <Text className="text-white text-[10px] font-bold">{cat.name}</Text>
                       </Pressable>
                    ))}
                 </ScrollView>
              </View>
           </View>
        </View>

        <View className="flex-row gap-4 mt-4">
          {recurring && (
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
              {saving ? 'Salvando...' : (recurring ? 'Salvar Alterações' : 'Agendar Fluxo')}
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
