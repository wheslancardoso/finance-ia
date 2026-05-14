import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, SafeAreaView } from 'react-native';
import { ShieldCheck, Lock, Fingerprint } from 'lucide-react-native';
import { useBiometrics } from '../hooks/useBiometrics';
import { MotiView } from 'moti';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { authenticate, isAuthenticated, loading } = useBiometrics();
  const [hasStartedAuth, setHasStartedAuth] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !hasStartedAuth) {
      setHasStartedAuth(true);
      authenticate();
    }
  }, [isAuthenticated, hasStartedAuth, authenticate]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#050505] items-center justify-center px-8">
      <MotiView 
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="items-center"
      >
        <View className="w-24 h-24 bg-violet-600 rounded-[32px] items-center justify-center mb-8 shadow-2xl shadow-violet-600/40">
          <Lock color="#fff" size={40} />
        </View>
        
        <Text className="text-white text-2xl font-black tracking-tight mb-2">Acesso Restrito</Text>
        <Text className="text-white/40 text-center mb-12 font-medium">
          Para sua segurança, o Vesper está bloqueado. Use a biometria para continuar.
        </Text>

        <Pressable 
          onPress={() => authenticate()}
          className="flex-row items-center bg-white/5 border border-white/10 px-8 py-5 rounded-[24px]"
        >
          <Fingerprint color="#8b5cf6" size={24} className="mr-3" />
          <Text className="text-white font-black uppercase tracking-widest text-xs">Desbloquear App</Text>
        </Pressable>
      </MotiView>
      
      <View className="absolute bottom-12 flex-row items-center bg-white/[0.02] px-4 py-2 rounded-full border border-white/5">
        <ShieldCheck size={12} color="rgba(255,255,255,0.2)" className="mr-2" />
        <Text className="text-white/20 text-[10px] font-black uppercase tracking-widest">Segurança de Dados Ativada</Text>
      </View>
    </SafeAreaView>
  );
}
