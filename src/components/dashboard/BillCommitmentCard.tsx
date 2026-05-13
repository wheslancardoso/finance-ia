"use client";

import React from "react";
import { CreditCard, Calendar, ShoppingCart, ArrowRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

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
      label: "Cartões", 
      value: immediateCardDebt, 
      icon: CreditCard, 
      color: "text-red-400", 
      bgColor: "bg-red-400/10"
    },
    { 
      label: "Agendados", 
      value: scheduledExpenses, 
      icon: Calendar, 
      color: "text-violet-400", 
      bgColor: "bg-violet-400/10"
    },
    { 
      label: "Reservas", 
      value: budgetReserves, 
      icon: ShoppingCart, 
      color: "text-emerald-400", 
      bgColor: "bg-emerald-400/10"
    }
  ];

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-5 shadow-2xl relative overflow-hidden group h-full flex flex-col">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[60px] rounded-full -mr-16 -mt-16" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest truncate">
              Compromissos
            </h3>
            <p className="text-[9px] text-white/30 font-bold uppercase tracking-tighter">
              Saídas previstas
            </p>
          </div>
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
            isCrisis ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          )}>
            {isCrisis ? "Crítico" : "Ok"}
          </div>
        </div>

        <div className="space-y-1 flex-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 group/item">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center transition-transform group-hover/item:scale-110", item.bgColor)}>
                  <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                </div>
                <span className="text-xs font-bold text-white/70 truncate">{item.label}</span>
              </div>
              <span className="text-xs font-black tabular-nums text-white/90 shrink-0">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 mt-1 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Total</span>
          <span className="text-xl font-black text-white tabular-nums">{formatCurrency(totalPlanned)}</span>
        </div>
      </div>
    </div>
  );
}
