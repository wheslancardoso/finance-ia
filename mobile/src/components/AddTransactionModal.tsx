import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Plus, X, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Hash, Tag } from 'lucide-react-native';
import { formatCurrency } from '../utils/format';
import { useTransactions } from '../hooks/useTransactions';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave?: (data: any) => void;
  transaction?: any; // If provided, we are editing
}

export default function AddTransactionModal({ onClose, onSave, transaction }: AddTransactionModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '95%'], []);
  const { 
    createTransaction, 
    createTransfer, 
    createInstallmentSeries, 
    updateTransaction,
    loading: saving 
  } = useTransactions();

  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>(transaction?.transaction_type || 'EXPENSE');
  const [value, setValue] = useState(transaction ? (Math.abs(transaction.amount_cents) / 100).toString() : '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [accountId, setAccountId] = useState<string>(transaction?.account_id || '');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(transaction?.category_id || '');
  const [installments, setInstallments] = useState('1');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: accs } = await supabase.from('accounts').select('*').order('name');
      if (accs) {
        setAccounts(accs);
        if (accs.length > 0) setAccountId(accs[0].id);
        if (accs.length > 1) setTargetAccountId(accs[1].id);
      }

      const { data: cats } = await supabase.from('categories').select('*').order('name');
      if (cats) {
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
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
    if (!value || !description || !accountId) return;
    
    const amountCents = Math.round(parseFloat(value.replace(',', '.')) * 100);
    const numInstallments = parseInt(installments) || 1;

    try {
      if (transaction?.id) {
        await updateTransaction(transaction.id, {
          description,
          amount_cents: amountCents,
          transaction_type: type,
          account_id: accountId,
          category_id: categoryId || null,
        });
      } else if (type === 'TRANSFER') {
        await createTransfer({
          description,
          amount_cents: amountCents,
          from_account_id: accountId,
          to_account_id: targetAccountId,
          date: new Date().toISOString(),
        });
      } else if (type === 'EXPENSE' && numInstallments > 1) {
        await createInstallmentSeries({
          description,
          amount_total_cents: amountCents,
          installments: numInstallments,
          account_id: accountId,
          category_id: categoryId || undefined,
          date: new Date().toISOString(),
        });
      } else {
        await createTransaction({
          description,
          amount_cents: amountCents,
          transaction_type: type,
          account_id: accountId,
          category_id: categoryId || undefined,
          date: new Date().toISOString(),
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave?.({});
      bottomSheetRef.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error(err);
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
            {transaction ? 'Editar Lançamento' : 'Nova Transação'}
          </Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        {/* Type Toggle */}
        <View className="flex-row p-1 bg-white/5 rounded-2xl mb-8">
          <Pressable 
            onPress={() => {
              setType('EXPENSE');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${type === 'EXPENSE' ? 'bg-rose-500/20 border border-rose-500/50' : ''}`}
          >
            <ArrowDownLeft size={16} color={type === 'EXPENSE' ? '#f43f5e' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${type === 'EXPENSE' ? 'text-rose-400' : 'text-white/40'}`}>Saída</Text>
          </Pressable>
          <Pressable 
            onPress={() => {
              setType('INCOME');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${type === 'INCOME' ? 'bg-emerald-500/20 border border-emerald-500/50' : ''}`}
          >
            <ArrowUpRight size={16} color={type === 'INCOME' ? '#34d399' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${type === 'INCOME' ? 'text-emerald-400' : 'text-white/40'}`}>Entrada</Text>
          </Pressable>
          <Pressable 
            onPress={() => {
              setType('TRANSFER');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${type === 'TRANSFER' ? 'bg-violet-500/20 border border-violet-500/50' : ''}`}
          >
            <ArrowRightLeft size={16} color={type === 'TRANSFER' ? '#8b5cf6' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${type === 'TRANSFER' ? 'text-violet-400' : 'text-white/40'}`}>Troca</Text>
          </Pressable>
        </View>

        {/* Value Input */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">Valor</Text>
          <TextInput
            className="text-white text-5xl font-black tracking-tighter"
            placeholder="0,00"
            placeholderTextColor="rgba(255,255,255,0.05)"
            keyboardType="numeric"
            value={value}
            onChangeText={setValue}
          />
        </View>

        {/* Description Input */}
        <View className="mb-8">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">O que foi isso?</Text>
          <TextInput
            className="bg-white/5 border border-white/10 rounded-[24px] px-5 py-5 text-white text-base font-bold"
            placeholder="Ex: Almoço, Salário, Pix..."
            placeholderTextColor="rgba(255,255,255,0.15)"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Account Selectors */}
        <View className="flex-row gap-4 mb-10">
          <View className="flex-1">
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">
              {type === 'TRANSFER' ? 'De Onde?' : 'Conta'}
            </Text>
            <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4 overflow-hidden">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {accounts.map((acc) => (
                  <Pressable 
                    key={acc.id}
                    onPress={() => {
                      setAccountId(acc.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className={`px-4 py-1.5 rounded-full mr-2 ${accountId === acc.id ? 'bg-white/20' : 'bg-transparent'}`}
                  >
                    <Text className={`text-xs font-bold ${accountId === acc.id ? 'text-white' : 'text-white/40'}`}>
                      {acc.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          {type === 'TRANSFER' && (
            <View className="flex-1">
              <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Para Onde?</Text>
              <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4 overflow-hidden">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {accounts.filter(a => a.id !== accountId).map((acc) => (
                    <Pressable 
                      key={acc.id}
                      onPress={() => {
                        setTargetAccountId(acc.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      className={`px-4 py-1.5 rounded-full mr-2 ${targetAccountId === acc.id ? 'bg-white/20' : 'bg-transparent'}`}
                    >
                      <Text className={`text-xs font-bold ${targetAccountId === acc.id ? 'text-white' : 'text-white/40'}`}>
                        {acc.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Category Selection (Only if not transfer) */}
        {type !== 'TRANSFER' && (
          <View className="mb-6">
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
        )}

        {/* Installments Selection (Only if expense) */}
        {type === 'EXPENSE' && (
          <View className="mb-8">
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Parcelamento</Text>
            <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4">
              <Hash size={18} color="rgba(255,255,255,0.2)" className="mr-3" />
              <TextInput
                className="flex-1 text-white text-base font-bold"
                placeholder="Número de parcelas (ex: 12)"
                placeholderTextColor="rgba(255,255,255,0.1)"
                keyboardType="numeric"
                value={installments}
                onChangeText={setInstallments}
              />
              <Text className="text-white/40 text-[10px] font-black uppercase">Vezes</Text>
            </View>
          </View>
        )}

        <Pressable 
          onPress={handleSave}
          disabled={saving}
          className={`w-full py-6 rounded-[32px] items-center shadow-2xl ${
            type === 'INCOME' ? 'bg-emerald-500 shadow-emerald-500/20' : 
            type === 'TRANSFER' ? 'bg-violet-600 shadow-violet-600/20' : 
            'bg-rose-500 shadow-rose-500/20'
          }`}
        >
          <Text className="text-white font-black uppercase tracking-widest">
            {saving ? 'Processando...' : (transaction ? 'Salvar Alterações' : 'Confirmar Lançamento')}
          </Text>
        </Pressable>
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
