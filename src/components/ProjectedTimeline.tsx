"use client";

import React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Utensils, 
  Car, 
  Gamepad, 
  Activity, 
  Briefcase, 
  TrendingUp, 
  ShoppingBag, 
  Home, 
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Zap,
  CreditCard,
  Tv,
  Music,
  Wifi,
  Lightbulb,
  Droplets,
  Smartphone,
  Coffee,
  Heart
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { ProjectedTransaction } from "@/utils/finance-projections";

interface ProjectedTimelineProps {
  transactions: ProjectedTransaction[];
}

const getIcon = (description: string, categoryName: string, type: string) => {
  const desc = description.toLowerCase();
  const name = categoryName?.toLowerCase() || "";
  
  // Assinaturas e recorrentes comuns
  if (desc.includes("netflix") || desc.includes("prime video") || desc.includes("disney") || desc.includes("hbo")) return Tv;
  if (desc.includes("spotify") || desc.includes("youtube premium") || desc.includes("music") || desc.includes("deezer")) return Music;
  if (desc.includes("internet") || desc.includes("wi-fi") || desc.includes("claro") || desc.includes("vivo")) return Wifi;
  if (desc.includes("celular") || desc.includes("tim") || desc.includes("recharge")) return Smartphone;
  if (desc.includes("luz") || desc.includes("energia") || desc.includes("enel")) return Lightbulb;
  if (desc.includes("água") || desc.includes("sabesp") || desc.includes("condomínio")) return Droplets;
  
  // Compras e Comida
  if (desc.includes("amazon") || desc.includes("shopee") || desc.includes("mercado livre") || desc.includes("magalu")) return ShoppingBag;
  if (name.includes("alimento") || name.includes("comer") || name.includes("restaurante") || name.includes("iFood")) return Utensils;
  if (name.includes("café") || desc.includes("starbucks") || desc.includes("padaria")) return Coffee;
  
  // Outros
  if (name.includes("transporte") || name.includes("uber") || name.includes("carro") || desc.includes("combustível")) return Car;
  if (name.includes("lazer") || name.includes("game") || name.includes("diversão") || desc.includes("steam")) return Gamepad;
  if (name.includes("saúde") || name.includes("médico") || name.includes("farmácia") || name.includes("convênio")) return Heart;
  if (name.includes("salário") || name.includes("trampo") || name.includes("job") || name.includes("recebimento")) return Briefcase;
  if (name.includes("invest") || name.includes("rendimento")) return TrendingUp;
  if (name.includes("moradia") || name.includes("aluguel") || name.includes("casa")) return Home;
  
  return type === "INCOME" ? ArrowUpRight : ArrowDownRight;
};

export function ProjectedTimeline({ transactions }: ProjectedTimelineProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <Calendar className="w-8 h-8 text-white/10" />
        </div>
        <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Sem previsões para este mês</p>
      </div>
    );
  }

  // Agrupar por tipo (Receitas, Fixos/Recorrentes, Provisões de Orçamento)
  const incomes = transactions.filter(t => t.transaction_type === "INCOME");
  const recurringExpenses = transactions.filter(t => t.transaction_type === "EXPENSE" && t.isRecurring);
  const budgetProvisions = transactions.filter(t => t.transaction_type === "EXPENSE" && !t.isRecurring);

  return (
    <div className="space-y-8 pb-4">
      {/* Receitas Projetadas */}
      {incomes.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-emerald-400/40 uppercase tracking-[0.3em] pl-2 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            Receitas Esperadas
          </h4>
          <div className="space-y-3">
            {incomes.map((tx) => (
              <ProjectedItem key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}

      {/* Despesas Recorrentes */}
      {recurringExpenses.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-violet-400/40 uppercase tracking-[0.3em] pl-2 flex items-center gap-2">
            <Zap className="w-3 h-3" />
            Compromissos Fixos
          </h4>
          <div className="space-y-3">
            {recurringExpenses.map((tx) => (
              <ProjectedItem key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}

      {/* Provisões de Orçamento */}
      {budgetProvisions.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] pl-2 flex items-center gap-2">
            <Layers className="w-3 h-3" />
            Reserva de Orçamentos
          </h4>
          <div className="space-y-3">
            {budgetProvisions.map((tx) => (
              <ProjectedItem key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectedItem({ tx }: { tx: ProjectedTransaction }) {
  const Icon = getIcon(tx.description, tx.category || "", tx.transaction_type);
  const isIncome = tx.transaction_type === "INCOME";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <div className={cn(
        "bg-white/[0.02] border border-white/5 p-4 rounded-[2rem] flex items-center justify-between transition-all duration-300",
        isIncome ? "hover:border-emerald-500/20 hover:bg-emerald-500/[0.02]" : "hover:border-white/10 hover:bg-white/[0.04]"
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors",
            isIncome 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-white/5 border-white/5 text-white/40"
          )}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <h5 className="text-sm font-bold text-white/80 group-hover:text-white transition-colors">
              {tx.description}
            </h5>
            <div className="flex items-center gap-2">
              {tx.accountType === "CREDIT_CARD" && (
                <CreditCard className="w-3 h-3 text-violet-400/60" />
              )}
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                {tx.accountName || (tx.isRecurring ? "Recorrente" : "Reserva")}
              </span>
              <span className="text-[10px] text-white/10">•</span>
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                {format(tx.date, "dd 'de' MMM", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className={cn(
            "text-base font-black tabular-nums tracking-tight",
            isIncome ? "text-emerald-400" : "text-white/90"
          )}>
            {isIncome ? "+" : "-"} {formatCurrency(tx.amount_cents)}
          </p>
          {tx.isRecurring && (
            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] mt-0.5">
              Fixo Mensal
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
