import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Repeat, Play, Pause, CreditCard, Wallet, Plus } from 'lucide-react-native';
import { useRecurring, RecurringTransaction } from '../src/hooks/useRecurring';
import AddRecurringModal from '../src/components/AddRecurringModal';
import { formatCurrency } from '../src/utils/format';
import { MotiView } from 'moti';

export default function RecurringScreen() {
  const router = useRouter();
  const { recurring, loading, toggleStatus, refresh } = useRecurring();
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringTransaction | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const activeRecurring = recurring.filter(r => r.status === 'active');
  const pausedRecurring = recurring.filter(r => r.status === 'paused');

  if (loading && recurring.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      {/* Header */}
      <View className="px-4 py-6 flex-row items-center justify-between">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/5 items-center justify-center border border-white/10"
        >
          <ArrowLeft color="#fff" size={20} />
        </Pressable>
        <Text className="text-white text-lg font-black uppercase tracking-widest">Assinaturas</Text>
        <Pressable 
          onPress={() => setShowAddModal(true)}
          className="w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center border border-emerald-500/20"
        >
          <Plus color="#10b981" size={20} />
        </Pressable>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#8b5cf6" />
        }
      >
        {/* Active Section */}
        <View className="mb-8">
          <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px] mb-6">Fluxos Ativos</Text>
          {activeRecurring.length === 0 ? (
            <Text className="text-white/20 italic mb-4">Nenhuma assinatura ativa</Text>
          ) : (
            activeRecurring.map((item, index) => (
              <RecurringItem 
                key={item.id} 
                item={item} 
                index={index} 
                onToggle={toggleStatus} 
                onPress={() => setSelectedRecurring(item)}
              />
            ))
          )}
        </View>

        {/* Paused Section */}
        {pausedRecurring.length > 0 && (
          <View className="mb-8">
            <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px] mb-6">Pausados</Text>
            {pausedRecurring.map((item, index) => (
              <RecurringItem 
                key={item.id} 
                item={item} 
                index={index + 10} 
                onToggle={toggleStatus} 
                onPress={() => setSelectedRecurring(item)}
              />
            ))}
          </View>
        )}

        <View className="h-10" />
      </ScrollView>

      {(showAddModal || selectedRecurring) && (
        <AddRecurringModal 
          recurring={selectedRecurring}
          onClose={() => {
            setShowAddModal(false);
            setSelectedRecurring(null);
            refresh();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function RecurringItem({ item, index, onToggle, onPress }: { item: any, index: number, onToggle: any, onPress: any }) {
  const isPaused = item.status === 'paused';
  
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 100 }}
      className={`rounded-[24px] mb-4 border ${
        isPaused ? 'bg-white/[0.02] border-white/5' : 'bg-white/5 border-white/10'
      }`}
    >
      <Pressable 
        onPress={onPress}
        className="flex-row items-center justify-between p-5"
      >
        <View className="flex-row items-center flex-1">
          <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
            isPaused ? 'bg-white/5' : 'bg-violet-600/20'
          }`}>
            <Repeat size={20} color={isPaused ? 'rgba(255,255,255,0.2)' : '#8b5cf6'} />
          </View>
          <View className="flex-1">
            <Text className={`font-bold ${isPaused ? 'text-white/40' : 'text-white'}`} numberOfLines={1}>
              {item.description}
            </Text>
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-widest">
              {item.frequency === 'monthly' ? 'Mensal' : item.frequency} • {item.categories?.name || 'Geral'}
            </Text>
          </View>
        </View>

        <View className="items-end ml-4">
          <Text className={`font-black tracking-tight mb-2 ${isPaused ? 'text-white/20' : 'text-white'}`}>
            {formatCurrency(item.amount_cents)}
          </Text>
          <Pressable 
            onPress={() => onToggle(item.id, item.status)}
            className={`px-3 py-1.5 rounded-full flex-row items-center ${
              isPaused ? 'bg-emerald-500/10' : 'bg-rose-500/10'
            }`}
          >
            {isPaused ? (
              <>
                <Play size={10} color="#34d399" className="mr-1" />
                <Text className="text-emerald-400 text-[8px] font-black uppercase">Ativar</Text>
              </>
            ) : (
              <>
                <Pause size={10} color="#f43f5e" className="mr-1" />
                <Text className="text-rose-500 text-[8px] font-black uppercase">Pausar</Text>
              </>
            )}
          </Pressable>
        </View>
      </Pressable>
    </MotiView>
  );
}
