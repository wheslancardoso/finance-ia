"use client";

import React from "react";
import { CreditCard, Calendar, ShoppingCart, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

interface BillCommitmentCardProps {
  immediateCardDebt: number;
  upcomingCardDebt: number;
  scheduledExpenses: number;
  budgetReserves: number;
  totalPlanned: number;
  isCrisis?: boolean;
}

export function BillCommitmentCard({
  immediateCardDebt,
  upcomingCardDebt,
  scheduledExpenses,
  budgetReserves,
  totalPlanned,
  isCrisis = false
}: BillCommitmentCardProps) {
  const items = [
    { 
      label: "Cartões (Vencendo)", 
      value: immediateCardDebt, 
      icon: CreditCard, 
      color: "text-red-400", 
      bgColor: "bg-red-400/10",
      description: "Faturas fechadas e vencendo agora"
    },
    { 
      label: "Agendados / Fixos", 
      value: scheduledExpenses, 
      icon: Calendar, 
      color: "text-violet-400", 
      bgColor: "bg-violet-400/10",
      description: "Aluguel, assinaturas e boletos"
    },
    { 
      label: "Reservas de Gastos", 
      value: budgetReserves, 
      icon: ShoppingCart, 
      color: "text-emerald-400", 
      bgColor: "bg-emerald-400/10",
      description: "Mercado, lazer e provisões"
    }
  ];

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group h-full flex flex-col">
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[60px] rounded-full -mr-16 -mt-16" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">
              Compromissos do Mês
            </h3>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
              O que você precisa quitar
            </p>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
            isCrisis ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          )}>
            {isCrisis ? "Atenção Crítica" : "Sob Controle"}
          </div>
        </div>

        <div className="space-y-4 flex-1">
          {items.map((item, idx) => (
            <div key={idx} className="group/item cursor-help relative">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover/item:scale-110", item.bgColor, item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white/80">{item.label}</p>
                    <p className="text-[9px] font-medium text-white/20 uppercase tracking-tighter">{formatCurrency(item.value)}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/10 group-hover/item:text-white/40 transition-colors" />
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute left-0 bottom-full mb-2 w-48 p-3 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover/item:opacity-100 transition-all pointer-events-none z-50">
                <p className="text-[10px] text-white/60 font-medium leading-tight">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Total Acumulado</p>
              <h2 className="text-3xl font-black text-white tabular-nums tracking-tighter">
                {formatCurrency(totalPlanned)}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Pendente</p>
              <p className="text-xs font-bold text-white/60 tabular-nums">
                {formatCurrency(totalPlanned)}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "35%" }} // Exemplo: 35% quitado
              className={cn(
                "h-full rounded-full",
                isCrisis ? "bg-red-500" : "bg-violet-600"
              )}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[9px] font-bold text-white/20 uppercase">Progresso de Quitação</span>
            <span className="text-[9px] font-bold text-white/40 uppercase">35% do planejado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
