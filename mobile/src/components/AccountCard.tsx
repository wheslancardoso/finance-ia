import { View, Text, Pressable } from 'react-native';
import { Wallet, CreditCard, Landmark, PiggyBank, CircleDollarSign } from 'lucide-react-native';
import { MotiView } from 'moti';
import { formatCurrency } from '../utils/format';
import { Account } from '../hooks/useAccounts';

interface AccountCardProps {
  account: Account;
  index: number;
  onPress?: (account: Account) => void;
}

export default function AccountCard({ account, index, onPress }: AccountCardProps) {
  const getIcon = () => {
    switch (account.type) {
      case 'CREDIT_CARD': return CreditCard;
      case 'SAVINGS': return PiggyBank;
      case 'INVESTMENT': return Landmark;
      case 'CASH': return CircleDollarSign;
      default: return Wallet;
    }
  };

  const Icon = getIcon();
  const isCreditCard = account.type === 'CREDIT_CARD';
  const balanceColor = account.balance_cents < 0 ? 'text-rose-400' : 'text-emerald-400';

  return (
    <Pressable onPress={() => onPress?.(account)}>
      <MotiView
        from={{ opacity: 0, scale: 0.9, translateY: 20 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: index * 100 }}
        className="bg-white/[0.03] border border-white/10 rounded-[32px] p-6 mb-4 overflow-hidden"
      >
      {/* Background Glow */}
      <View 
        className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10"
        style={{ backgroundColor: account.color || '#10b981' }}
      />

      <View className="flex-row justify-between items-start mb-4">
        <View className="p-3 bg-white/5 border border-white/5 rounded-2xl">
          <Icon size={20} color={account.color || '#fff'} />
        </View>
        <View className="items-end">
          <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            {account.type.replace('_', ' ')}
          </Text>
          {account.institution && (
            <Text className="text-white/60 text-xs font-medium">
              {account.institution}
            </Text>
          )}
        </View>
      </View>

      <View>
        <Text className="text-white/60 text-sm font-medium mb-1">
          {account.name}
        </Text>
        <Text className={`text-2xl font-bold tracking-tight ${balanceColor}`}>
          {formatCurrency(account.balance_cents)}
        </Text>
      </View>

      {isCreditCard && account.limit_cents && (
        <View className="mt-4 pt-4 border-t border-white/5 flex-row justify-between items-center">
          <View>
            <Text className="text-white/20 text-[9px] font-bold uppercase mb-0.5">Limite Disponível</Text>
            <Text className="text-white/80 text-xs font-bold">
              {formatCurrency(account.limit_cents - Math.abs(account.balance_cents))}
            </Text>
          </View>
          <View className="h-1.5 flex-1 bg-white/5 rounded-full mx-4 overflow-hidden">
            <View 
              className="h-full bg-emerald-500/50" 
              style={{ width: `${Math.max(0, Math.min(100, (1 - Math.abs(account.balance_cents) / account.limit_cents) * 100))}%` }}
            />
          </View>
        </View>
      )}
      </MotiView>
    </Pressable>
  );
}
