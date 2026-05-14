import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  Zap, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Tv,
  Music,
  Wifi,
  Smartphone,
  Lightbulb,
  Droplets,
  ShoppingBag,
  Utensils,
  Coffee,
  Car,
  Gamepad,
  Heart,
  Briefcase,
  Home,
  CreditCard
} from 'lucide-react-native';
import { formatCurrency } from '../utils/format';
import { ProjectedTransaction } from '../hooks/useProjectionTimeline';

const getIcon = (description: string, categoryName: string, type: string) => {
  const desc = description.toLowerCase();
  const name = categoryName?.toLowerCase() || "";
  
  if (desc.includes("netflix") || desc.includes("prime video") || desc.includes("disney") || desc.includes("hbo")) return Tv;
  if (desc.includes("spotify") || desc.includes("youtube premium") || desc.includes("music") || desc.includes("deezer")) return Music;
  if (desc.includes("internet") || desc.includes("wi-fi") || desc.includes("claro") || desc.includes("vivo")) return Wifi;
  if (desc.includes("celular") || desc.includes("tim") || desc.includes("recharge")) return Smartphone;
  if (desc.includes("luz") || desc.includes("energia") || desc.includes("enel")) return Lightbulb;
  if (desc.includes("água") || desc.includes("sabesp") || desc.includes("condomínio")) return Droplets;
  if (desc.includes("amazon") || desc.includes("shopee") || desc.includes("mercado livre") || desc.includes("magalu")) return ShoppingBag;
  if (name.includes("alimento") || name.includes("comer") || name.includes("restaurante") || name.includes("ifood")) return Utensils;
  if (name.includes("café") || desc.includes("starbucks") || desc.includes("padaria")) return Coffee;
  if (name.includes("transporte") || name.includes("uber") || name.includes("carro") || desc.includes("combustível")) return Car;
  if (name.includes("lazer") || name.includes("game") || name.includes("diversão") || desc.includes("steam")) return Gamepad;
  if (name.includes("saúde") || name.includes("médico") || name.includes("farmácia") || name.includes("convênio")) return Heart;
  if (name.includes("salário") || name.includes("trampo") || name.includes("job") || name.includes("recebimento")) return Briefcase;
  if (name.includes("moradia") || name.includes("aluguel") || name.includes("casa")) return Home;
  
  return type === "INCOME" ? ArrowUpRight : ArrowDownRight;
};

interface ProjectedTimelineProps {
  transactions: ProjectedTransaction[];
}

export default function ProjectedTimeline({ transactions }: ProjectedTimelineProps) {
  if (transactions.length === 0) {
    return (
      <View className="items-center justify-center py-10 opacity-20">
        <Layers size={48} color="#fff" />
        <Text className="text-white text-[10px] font-black uppercase tracking-widest mt-4">
          Sem previsões para este mês
        </Text>
      </View>
    );
  }

  const incomes = transactions.filter(t => t.transaction_type === "INCOME");
  const recurringExpenses = transactions.filter(t => t.transaction_type === "EXPENSE" && t.isRecurring);
  const otherExpenses = transactions.filter(t => t.transaction_type === "EXPENSE" && !t.isRecurring);

  return (
    <View className="space-y-8">
      {incomes.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4 px-2">
            <TrendingUp size={12} color="#10b981" />
            <Text className="text-emerald-400/40 text-[10px] font-black uppercase tracking-[3px]">
              Receitas Esperadas
            </Text>
          </View>
          <View className="space-y-3">
            {incomes.map((tx) => <ProjectedItem key={tx.id} tx={tx} />)}
          </View>
        </View>
      )}

      {recurringExpenses.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-4 px-2">
            <Zap size={12} color="#8b5cf6" />
            <Text className="text-violet-400/40 text-[10px] font-black uppercase tracking-[3px]">
              Compromissos Fixos
            </Text>
          </View>
          <View className="space-y-3">
            {recurringExpenses.map((tx) => <ProjectedItem key={tx.id} tx={tx} />)}
          </View>
        </View>
      )}

      {otherExpenses.length > 0 && (
        <View>
          <View className="flex-row items-center gap-2 mb-4 px-2">
            <Layers size={12} color="#fff" style={{ opacity: 0.2 }} />
            <Text className="text-white/20 text-[10px] font-black uppercase tracking-[3px]">
              Outras Projeções
            </Text>
          </View>
          <View className="space-y-3">
            {otherExpenses.map((tx) => <ProjectedItem key={tx.id} tx={tx} />)}
          </View>
        </View>
      )}
    </View>
  );
}

function ProjectedItem({ tx }: { tx: ProjectedTransaction }) {
  const Icon = getIcon(tx.description, tx.category || "", tx.transaction_type);
  const isIncome = tx.transaction_type === "INCOME";
  
  return (
    <View className="bg-white/[0.03] border border-white/10 p-4 rounded-[28px] flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${
          isIncome 
            ? "bg-emerald-500/10 border-emerald-500/20" 
            : "bg-white/5 border-white/5"
        }`}>
          <Icon size={20} color={isIncome ? "#34d399" : "rgba(255,255,255,0.4)"} />
        </View>

        <View className="ml-4 flex-1">
          <Text className="text-white/80 text-sm font-bold" numberOfLines={1}>
            {tx.description}
          </Text>
          <View className="flex-row items-center mt-1">
            {tx.accountType === "CREDIT_CARD" && (
              <CreditCard size={10} color="rgba(139,92,246,0.6)" style={{ marginRight: 4 }} />
            )}
            <Text className="text-white/20 text-[9px] font-black uppercase tracking-widest">
              {tx.accountName || (tx.isRecurring ? "Recorrente" : "Reserva")} • {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}
            </Text>
          </View>
        </View>
      </View>

      <View className="items-end ml-2">
        <Text className={`text-lg font-black tracking-tighter ${
          isIncome ? "text-emerald-400" : "text-white/90"
        }`}>
          {isIncome ? "+" : "-"} {formatCurrency(tx.amount_cents)}
        </Text>
        {tx.isRecurring && (
          <Text className="text-white/10 text-[8px] font-black uppercase tracking-[2px] mt-0.5">
            Fixo Mensal
          </Text>
        )}
      </View>
    </View>
  );
}
