import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Target } from 'lucide-react-native';
import { useGoals } from '../src/hooks/useGoals';
import GoalCard from '../src/components/GoalCard';
import AddGoalModal from '../src/components/AddGoalModal';

export default function GoalsScreen() {
  const router = useRouter();
  const { goals, loading, refresh, contribute, createGoal } = useGoals();
  const [showAddModal, setShowAddModal] = useState(false);

  if (loading && goals.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      <View className="px-4 py-6 flex-row items-center justify-between">
        <Pressable 
          onPress={() => router.back()}
          className="p-3 bg-white/5 border border-white/10 rounded-2xl"
        >
          <ArrowLeft color="#fff" size={20} />
        </Pressable>
        <Text className="text-white text-lg font-black uppercase tracking-widest">Minhas Metas</Text>
        <Pressable 
          onPress={() => setShowAddModal(true)}
          className="p-3 bg-violet-600 rounded-2xl"
        >
          <Plus color="#fff" size={20} />
        </Pressable>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#10b981" />
        }
      >
        {goals.length === 0 ? (
          <View className="py-20 items-center justify-center space-y-6">
            <View className="w-20 h-20 bg-white/5 rounded-[32px] items-center justify-center border border-white/10">
              <Target size={40} color="rgba(255,255,255,0.2)" />
            </View>
            <View className="items-center">
              <Text className="text-white text-xl font-bold">Nenhuma meta ativa</Text>
              <Text className="text-white/40 text-center mt-2 px-10">
                Defina seu primeiro objetivo para começar a visualizar o futuro do seu dinheiro.
              </Text>
              <Pressable 
                onPress={() => setShowAddModal(true)}
                className="mt-6 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl"
              >
                <Text className="text-white font-bold">Criar Meta agora →</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="pb-10">
            {goals.map((goal) => (
              <GoalCard 
                key={goal.id} 
                goal={goal} 
                onContribute={() => contribute(goal.id, 10000)} // Mock contribution for now
              />
            ))}
          </View>
        )}
      </ScrollView>

      {showAddModal && (
        <AddGoalModal 
          onClose={() => setShowAddModal(false)}
          onSave={(data) => {
            createGoal(data);
            setShowAddModal(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}
