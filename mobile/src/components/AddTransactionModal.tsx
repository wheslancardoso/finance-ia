import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Plus, X, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react-native';
import { formatCurrency } from '../utils/format';
import { useTransactions } from '../hooks/useTransactions';
import { supabase } from '../lib/supabase';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave?: (data: any) => void;
}

export default function AddTransactionModal({ onClose, onSave }: AddTransactionModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  const { createTransaction, createTransfer, loading: saving } = useTransactions();

  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState<string>('');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAccounts() {
      const { data } = await supabase.from('accounts').select('*').order('name');
      if (data) {
        setAccounts(data);
        if (data.length > 0) setAccountId(data[0].id);
        if (data.length > 1) setTargetAccountId(data[1].id);
      }
    }
    fetchAccounts();
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
    const date = new Date().toISOString();

    try {
      if (type === 'TRANSFER') {
        if (!targetAccountId) return;
        await createTransfer({
          from_account_id: accountId,
          to_account_id: targetAccountId,
          amount_cents: amountCents,
          description,
          date,
        });
      } else {
        await createTransaction({
          description,
          amount_cents: amountCents,
          transaction_type: type,
          account_id: accountId,
          date,
          is_paid: true,
        });
      }

      if (onSave) onSave({ type, value, description });
      bottomSheetRef.current?.close();
    } catch (err) {
      // Erro já tratado no hook
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
          <Text className="text-white text-xl font-black uppercase tracking-widest">Nova Transação</Text>
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
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${type === 'EXPENSE' ? 'text-rose-400' : 'text-white/40'}`}>Saída</Text>
          </Pressable>
          <Pressable 
            onPress={() => setType('INCOME')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${type === 'INCOME' ? 'bg-emerald-500/20 border border-emerald-500/50' : ''}`}
          >
            <ArrowUpRight size={16} color={type === 'INCOME' ? '#34d399' : 'rgba(255,255,255,0.4)'} />
            <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${type === 'INCOME' ? 'text-emerald-400' : 'text-white/40'}`}>Entrada</Text>
          </Pressable>
          <Pressable 
            onPress={() => setType('TRANSFER')}
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
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">
              {type === 'TRANSFER' ? 'De Onde?' : 'Conta'}
            </Text>
            <View className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden">
               <Text className="text-white/60 p-4 font-bold text-xs uppercase tracking-widest">
                  {accounts.find(a => a.id === accountId)?.name || 'Selecionar'}
               </Text>
            </View>
          </View>

          {type === 'TRANSFER' && (
            <View className="flex-1">
              <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2">Para Onde?</Text>
              <View className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden">
                <Text className="text-white/60 p-4 font-bold text-xs uppercase tracking-widest">
                    {accounts.find(a => a.id === targetAccountId)?.name || 'Selecionar'}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Pressable 
          onPress={handleSave}
          disabled={saving}
          className={`w-full py-5 rounded-[24px] items-center shadow-xl ${
            type === 'INCOME' ? 'bg-emerald-500 shadow-emerald-500/20' : 
            type === 'TRANSFER' ? 'bg-violet-600 shadow-violet-600/20' : 
            'bg-rose-500 shadow-rose-500/20'
          }`}
        >
          <Text className="text-white font-black uppercase tracking-widest">
            {saving ? 'Processando...' : 'Ativar Lançamento'}
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
