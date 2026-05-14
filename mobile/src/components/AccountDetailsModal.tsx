import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, CreditCard, ArrowUpRight, ArrowDownLeft, Receipt, CheckCircle2 } from 'lucide-react-native';
import { formatCurrency } from '../utils/format';
import { Account, useAccounts } from '../hooks/useAccounts';
import { useAccountDetails } from '../hooks/useAccountDetails';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccountDetailsModalProps {
  account: Account | null;
  onClose: () => void;
  onEdit?: (account: Account) => void;
}

export default function AccountDetailsModal({ account, onClose, onEdit }: AccountDetailsModalProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '95%'], []);
  const { transactions, invoices, loading, payInvoice } = useAccountDetails(account?.id || '');
  const { accounts: allAccounts } = useAccounts();
  
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  const checkingAccounts = useMemo(() => 
    allAccounts.filter(a => a.type !== 'CREDIT_CARD' && a.balance_cents > 0),
  [allAccounts]);

  useEffect(() => {
    if (checkingAccounts.length > 0) setPaymentAccountId(checkingAccounts[0].id);
  }, [checkingAccounts]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    []
  );

  if (!account) return null;

  const isCreditCard = account.type === 'CREDIT_CARD';

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
      <View style={styles.container}>
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px] mb-1">Detalhes da Conta</Text>
            <Text className="text-white text-xl font-black uppercase tracking-tight">{account.name}</Text>
          </View>
          <View className="flex-row items-center">
            <Pressable 
              onPress={() => onEdit?.(account)}
              className="mr-4 px-4 py-2 bg-white/5 rounded-xl border border-white/10"
            >
              <Text className="text-white/60 text-[10px] font-black uppercase">Editar</Text>
            </Pressable>
            <Pressable onPress={() => bottomSheetRef.current?.close()}>
              <X color="#fff" size={24} />
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* balance info */}
          <View className="bg-white/5 border border-white/10 rounded-[32px] p-6 mb-8">
            <Text className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">
              {isCreditCard ? 'Saldo Devedor Atual' : 'Saldo Disponível'}
            </Text>
            <Text className={`text-4xl font-black tracking-tighter ${account.balance_cents < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatCurrency(account.balance_cents)}
            </Text>
            
            {isCreditCard && account.limit_cents && (
               <View className="mt-4 pt-4 border-t border-white/5">
                  <Text className="text-white/20 text-[9px] font-black uppercase mb-1">Limite Total</Text>
                  <Text className="text-white/60 font-bold">{formatCurrency(account.limit_cents)}</Text>
               </View>
            )}
          </View>

          {/* Actions */}
          {isCreditCard && (
            <View className="mb-8">
              {!showPaymentSelector ? (
                <Pressable 
                  onPress={() => setShowPaymentSelector(true)}
                  className="bg-emerald-500 w-full py-5 rounded-[24px] items-center shadow-xl shadow-emerald-500/20"
                >
                  <View className="flex-row items-center">
                    <CheckCircle2 size={18} color="#fff" className="mr-2" />
                    <Text className="text-white font-black uppercase tracking-widest">Pagar Fatura Fechada</Text>
                  </View>
                </Pressable>
              ) : (
                <View className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                  <Text className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Escolha a conta de origem</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                    {checkingAccounts.map(acc => (
                      <Pressable 
                        key={acc.id}
                        onPress={() => setPaymentAccountId(acc.id)}
                        className={`px-4 py-2 rounded-full mr-2 border ${
                          paymentAccountId === acc.id ? 'bg-white/20 border-white/40' : 'bg-white/5 border-white/5'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${paymentAccountId === acc.id ? 'text-white' : 'text-white/40'}`}>
                          {acc.name} ({formatCurrency(acc.balance_cents)})
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View className="flex-row gap-2">
                    <Pressable 
                      onPress={() => setShowPaymentSelector(false)}
                      className="flex-1 py-4 bg-white/5 rounded-2xl items-center"
                    >
                      <Text className="text-white/40 font-black uppercase text-[10px]">Cancelar</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => {
                        payInvoice(account, paymentAccountId, Math.abs(account.balance_cents));
                        setShowPaymentSelector(false);
                      }}
                      className="flex-[2] py-4 bg-emerald-500 rounded-2xl items-center"
                    >
                      <Text className="text-white font-black uppercase text-[10px]">Confirmar Pagamento</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Recent Transactions */}
          <View className="mb-8">
            <View className="flex-row justify-between items-center mb-6">
               <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Últimos Lançamentos</Text>
               <Receipt size={16} color="rgba(255,255,255,0.2)" />
            </View>

            {loading ? (
              <ActivityIndicator color="#8b5cf6" />
            ) : transactions.length === 0 ? (
              <Text className="text-white/20 text-center py-10 font-medium italic">Nenhuma transação encontrada</Text>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} className="flex-row justify-between items-center mb-5">
                  <View className="flex-row items-center flex-1">
                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${
                      tx.transaction_type === 'INCOME' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                    }`}>
                      {tx.transaction_type === 'INCOME' 
                        ? <ArrowUpRight size={18} color="#34d399" />
                        : <ArrowDownLeft size={18} color="#f43f5e" />
                      }
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold" numberOfLines={1}>{tx.description}</Text>
                      <Text className="text-white/40 text-[10px] uppercase font-black">
                        {format(new Date(tx.date), "dd 'de' MMMM", { locale: ptBR })}
                      </Text>
                    </View>
                  </View>
                  <Text className={`font-black tracking-tight ${
                    tx.transaction_type === 'INCOME' ? 'text-emerald-400' : 'text-white/80'
                  }`}>
                    {tx.transaction_type === 'EXPENSE' ? '-' : ''}{formatCurrency(tx.amount_cents)}
                  </Text>
                </View>
              ))
            )}
          </View>
          
          <View className="h-10" />
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
