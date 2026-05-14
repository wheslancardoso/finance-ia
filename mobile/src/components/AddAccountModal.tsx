import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, CreditCard, Landmark, Wallet, PiggyBank, Briefcase } from 'lucide-react-native';
import { useAccounts } from '../hooks/useAccounts';
import * as Haptics from 'expo-haptics';

interface AddAccountModalProps {
  onClose: () => void;
  account?: any; // If provided, we are editing
}

export default function AddAccountModal({ onClose, account }: AddAccountModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  const { createAccount, updateAccount, deleteAccount } = useAccounts();

  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<any>(account?.type || 'CHECKING');
  const [balance, setBalance] = useState(account ? (account.balance_cents / 100).toString() : '0');
  const [limit, setLimit] = useState(account?.limit_cents ? (account.limit_cents / 100).toString() : '');
  const [institution, setInstitution] = useState(account?.institution || '');
  const [saving, setSaving] = useState(false);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    []
  );

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    
    const balanceCents = Math.round(parseFloat(balance.replace(',', '.')) * 100) || 0;
    const limitCents = limit ? Math.round(parseFloat(limit.replace(',', '.')) * 100) : null;

    try {
      const accountData = {
        name,
        type,
        balance_cents: balanceCents,
        limit_cents: limitCents,
        institution,
        color: '#8b5cf6', // Default color
      };

      if (account?.id) {
        await updateAccount(account.id, accountData);
      } else {
        await createAccount(accountData);
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
    if (!account?.id) return;
    try {
      await deleteAccount(account.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bottomSheetRef.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const types = [
    { id: 'CHECKING', label: 'Corrente', icon: Landmark },
    { id: 'SAVINGS', label: 'Poupança', icon: PiggyBank },
    { id: 'INVESTMENT', label: 'Investimento', icon: Briefcase },
    { id: 'CREDIT_CARD', label: 'Cartão', icon: CreditCard },
    { id: 'CASH', label: 'Dinheiro', icon: Wallet },
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
            {account ? 'Editar Conta' : 'Nova Conta'}
          </Text>
          <Pressable onPress={() => bottomSheetRef.current?.close()}>
            <X color="#fff" size={24} />
          </Pressable>
        </View>

        {/* Type Selector */}
        <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-4 px-1">Tipo de Conta</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-8">
          {types.map((t) => {
            const Icon = t.icon;
            const isSelected = type === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setType(t.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`items-center justify-center p-4 rounded-[24px] mr-3 border ${
                  isSelected ? 'bg-violet-600 border-violet-500' : 'bg-white/5 border-white/10'
                }`}
                style={{ width: 100, height: 100 }}
              >
                <Icon color={isSelected ? '#fff' : 'rgba(255,255,255,0.4)'} size={24} />
                <Text className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${
                  isSelected ? 'text-white' : 'text-white/40'
                }`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Name Input */}
        <View className="mb-6">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Nome da Conta</Text>
          <TextInput
            className="bg-white/5 border border-white/10 rounded-[24px] px-5 py-5 text-white text-base font-bold"
            placeholder="Ex: Nubank, Carteira, Investimentos..."
            placeholderTextColor="rgba(255,255,255,0.15)"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Balance Input */}
        <View className="mb-6">
          <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">
            {type === 'CREDIT_CARD' ? 'Gasto Atual (Fatura)' : 'Saldo Atual'}
          </Text>
          <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4">
            <Text className="text-white/20 font-black mr-2">R$</Text>
            <TextInput
              className="flex-1 text-white text-2xl font-black tracking-tight"
              placeholder="0,00"
              placeholderTextColor="rgba(255,255,255,0.1)"
              keyboardType="numeric"
              value={balance}
              onChangeText={setBalance}
            />
          </View>
        </View>

        {/* Limit Input (Only for Cards) */}
        {type === 'CREDIT_CARD' && (
          <View className="mb-6">
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Limite do Cartão</Text>
            <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-4">
              <Text className="text-white/20 font-black mr-2">R$</Text>
              <TextInput
                className="flex-1 text-white text-2xl font-black tracking-tight"
                placeholder="0,00"
                placeholderTextColor="rgba(255,255,255,0.1)"
                keyboardType="numeric"
                value={limit}
                onChangeText={setLimit}
              />
            </View>
          </View>
        )}

        <View className="flex-row gap-4 mt-4">
          {account && (
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
              {saving ? 'Salvando...' : (account ? 'Salvar Alterações' : 'Criar Conta')}
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
