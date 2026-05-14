import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, SafeAreaView, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, DollarSign, Wallet, LogOut, ShieldCheck, ChevronRight, MessageSquare, Phone, Zap, Palette } from 'lucide-react-native';
import { useProfile } from '../src/hooks/useProfile';
import { supabase } from '../src/lib/supabase';
import { MotiView } from 'moti';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, loading, updateProfile } = useProfile();
  
  const [income, setIncome] = useState('');
  const [fixedExpenses, setFixedExpenses] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setIncome((profile.monthly_income_cents / 100).toString());
      setFixedExpenses((profile.fixed_expenses_cents / 100).toString());
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        monthly_income_cents: Math.round(parseFloat(income.replace(',', '.')) * 100) || 0,
        fixed_expenses_cents: Math.round(parseFloat(fixedExpenses.replace(',', '.')) * 100) || 0,
      });
    } catch (err) {
      // Erro tratado no hook
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/'); // Redirecionar para home/login
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505]">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4">
          {/* Header */}
          <View className="py-6 flex-row items-center justify-between">
            <Pressable 
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/5 items-center justify-center border border-white/10"
            >
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text className="text-white text-lg font-black uppercase tracking-widest">Configurações</Text>
            <View className="w-10" />
          </View>

          {/* Profile Card */}
          <View className="items-center mb-10">
            <View className="w-24 h-24 bg-violet-600 rounded-[32px] items-center justify-center mb-4 shadow-2xl shadow-violet-600/40">
              <User color="#fff" size={40} />
            </View>
            <Text className="text-white text-2xl font-black tracking-tight mb-1">Seu Perfil</Text>
            <View className="flex-row items-center bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck size={12} color="#34d399" className="mr-1" />
              <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Usuário Verificado</Text>
            </View>
          </View>

          {/* Form */}
          <View className="space-y-8">
            <View>
              <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Renda Mensal Sugerida</Text>
              <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-5">
                <DollarSign size={20} color="rgba(255,255,255,0.2)" className="mr-3" />
                <TextInput
                  className="flex-1 text-white text-lg font-bold"
                  placeholder="0,00"
                  placeholderTextColor="rgba(255,255,255,0.1)"
                  keyboardType="numeric"
                  value={income}
                  onChangeText={setIncome}
                />
              </View>
              <Text className="text-white/20 text-[10px] mt-2 px-1 italic">
                Usado para calcular seu teto de gastos e projeções.
              </Text>
            </View>

            <View>
              <Text className="text-white/20 text-[10px] font-black uppercase tracking-[2px] mb-2 px-1">Gastos Fixos Estimados</Text>
              <View className="flex-row items-center bg-white/5 border border-white/10 rounded-[24px] px-5 py-5">
                <Wallet size={20} color="rgba(255,255,255,0.2)" className="mr-3" />
                <TextInput
                  className="flex-1 text-white text-lg font-bold"
                  placeholder="0,00"
                  placeholderTextColor="rgba(255,255,255,0.1)"
                  keyboardType="numeric"
                  value={fixedExpenses}
                  onChangeText={setFixedExpenses}
                />
              </View>
              <Text className="text-white/20 text-[10px] mt-2 px-1 italic">
                Aluguel, contas fixas, etc. Não inclui compras variáveis.
              </Text>
            </View>

            <Pressable 
              onPress={handleSave}
              disabled={saving}
              className="bg-violet-600 w-full py-5 rounded-[24px] items-center shadow-xl shadow-violet-600/20"
            >
              <Text className="text-white font-black uppercase tracking-widest">
                {saving ? 'Salvando...' : 'Atualizar Perfil'}
              </Text>
            </Pressable>

            <View className="h-4" />

            {/* WhatsApp Protocol */}
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 300 }}
              className="mb-8"
            >
              <View className="flex-row items-center mb-4">
                <MessageSquare color="#10b981" size={18} className="mr-2" />
                <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Protocolo WhatsApp</Text>
              </View>
              <View className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                <Text className="text-white/30 text-[10px] font-bold mb-4">Comande o Vesper via mensagens.</Text>
                <View className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-row items-center mb-4">
                  <Phone size={16} color="rgba(255,255,255,0.2)" className="mr-3" />
                  <TextInput
                    className="flex-1 text-white font-bold"
                    placeholder="5511999999999"
                    placeholderTextColor="rgba(255,255,255,0.1)"
                    keyboardType="numeric"
                    value={profile?.whatsapp_number || ''}
                    onChangeText={(val) => updateProfile({ whatsapp_number: val.replace(/\D/g, '') })}
                  />
                </View>
                <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex-row items-center">
                  <Zap size={14} color="#10b981" className="mr-2" />
                  <Text className="text-emerald-400 text-[10px] font-bold">Número sincronizado com sucesso.</Text>
                </View>
              </View>
            </MotiView>

            {/* Preferences */}
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 400 }}
              className="mb-10"
            >
              <View className="flex-row items-center mb-4">
                <Palette color="#fbbf24" size={18} className="mr-2" />
                <Text className="text-white/40 text-[10px] font-black uppercase tracking-[2px]">Preferências</Text>
              </View>
              <View className="space-y-3">
                <View className="bg-white/5 border border-white/10 rounded-[24px] p-4 flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-bold text-xs">Moeda Padrão</Text>
                    <Text className="text-white/20 text-[10px] font-black uppercase">Real Brasileiro (BRL)</Text>
                  </View>
                  <ChevronRight color="rgba(255,255,255,0.1)" size={16} />
                </View>
                <View className="bg-white/5 border border-white/10 rounded-[24px] p-4 flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-bold text-xs">Tema Visual</Text>
                    <Text className="text-white/20 text-[10px] font-black uppercase">Liquid Glass (Dark)</Text>
                  </View>
                  <ChevronRight color="rgba(255,255,255,0.1)" size={16} />
                </View>
                <Pressable 
                  onPress={() => router.push('/categories' as any)}
                  className="bg-white/5 border border-white/10 rounded-[24px] p-4 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="text-white font-bold text-xs">Categorias</Text>
                    <Text className="text-white/20 text-[10px] font-black uppercase">Gerenciar classificações</Text>
                  </View>
                  <ChevronRight color="rgba(255,255,255,0.1)" size={16} />
                </Pressable>
              </View>
            </MotiView>

            {/* Logout */}
            <Pressable 
              onPress={handleLogout}
              className="w-full py-5 rounded-3xl border border-rose-500/20 bg-rose-500/5 items-center mb-10"
            >
              <Text className="text-rose-500 font-black uppercase text-[10px] tracking-[4px]">Sair do Centro de Comando</Text>
            </Pressable>
          </View>
          
          <View className="h-20" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
