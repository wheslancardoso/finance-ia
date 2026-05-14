import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowUpRight, ArrowDownLeft, EllipsisVertical, Trash2 } from 'lucide-react-native';
import { MotiView } from 'moti';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, withSpring } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface TransactionItemProps {
  description: string;
  amount: number;
  date: string;
  category: string;
  account: string;
  isPaid: boolean;
  onTogglePaid: () => void;
  onDelete?: () => void;
}

export default function TransactionItem({
  description,
  amount,
  date,
  category,
  account,
  isPaid,
  onTogglePaid,
  onDelete,
}: TransactionItemProps) {
  const isNegative = amount < 0;

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: withSpring(isPaid ? 0 : 30),
    };
  });

  return (
    <MotiView 
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      className="relative w-full p-4 bg-white/[0.03] border border-white/10 rounded-[32px] flex-row items-center justify-between mb-4"
    >
      <View className="flex-row items-center gap-4 flex-1">
        {/* Icon */}
        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${isNegative ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          {isNegative ? (
            <ArrowDownLeft size={20} color="#f87171" />
          ) : (
            <ArrowUpRight size={20} color="#34d399" />
          )}
        </View>

        <View className="flex-1">
          <Text className="text-white font-bold text-base truncate" numberOfLines={1}>
            {description}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <View className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5">
              <Text className="text-white/40 text-[8px] font-bold uppercase tracking-tighter">
                {category}
              </Text>
            </View>
            <Text className="text-white/20 text-[10px] font-bold uppercase tracking-tighter">
              • {account}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-4 ml-2">
        <View className="items-end">
          <View className="flex-row items-center">
            <Text className={`text-lg font-bold tabular-nums mr-2 ${isNegative ? 'text-white' : 'text-emerald-400'}`}>
              {isNegative ? '-' : '+'} R$ {Math.abs(amount).toFixed(2)}
            </Text>
            {onDelete && (
              <Pressable 
                onPress={onDelete}
                className="w-8 h-8 rounded-full bg-rose-500/10 items-center justify-center"
              >
                <Trash2 size={14} color="#f43f5e" />
              </Pressable>
            )}
          </View>
          <Text className="text-white/20 text-[10px] font-medium">{date}</Text>
        </View>

        {/* Premium Circle Check */}
        <Pressable 
          testID="toggle-paid-button"
          onPress={onTogglePaid}
          className={`w-10 h-10 rounded-full items-center justify-center border-2 transition-all ${isPaid ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-white/5 border-white/10'}`}
        >
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <AnimatedPath
              d="M20 6 9 17l-5-5"
              stroke={isPaid ? "#0d0d0d" : "transparent"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="30"
              animatedProps={animatedProps}
            />
          </Svg>
        </Pressable>
      </View>
      
      {/* Absolute Action Menu dot */}
      <View className="absolute top-2 right-2">
        <EllipsisVertical size={16} color="rgba(255,255,255,0.2)" />
      </View>
    </MotiView>
  );
}
