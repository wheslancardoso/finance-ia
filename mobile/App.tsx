import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { Text, View, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-[#090909]">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full p-10 bg-white/[0.03] border border-white/10 rounded-[48px] items-center shadow-2xl">
          <View className="w-20 h-20 bg-emerald-500/20 rounded-[24px] items-center justify-center border border-emerald-500/30 mb-6">
            <Text className="text-emerald-400 text-4xl font-bold">V</Text>
          </View>
          
          <Text className="text-white text-3xl font-bold tracking-tight text-center">
            Vesper Mobile
          </Text>
          
          <Text className="text-white/40 text-lg font-medium text-center mt-3 leading-6">
            A mesma inteligência financeira,{"\n"}agora nativa no seu bolso.
          </Text>
          
          <View className="w-full h-[1px] bg-white/5 my-8" />
          
          <View className="w-full bg-emerald-500 py-4 rounded-2xl items-center shadow-lg shadow-emerald-500/20">
            <Text className="text-[#0d0d0d] font-bold text-lg">Começar Agora</Text>
          </View>
        </View>
        
        <Text className="text-white/20 text-sm font-bold uppercase tracking-[4px] mt-12">
          Design System v1.0
        </Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
