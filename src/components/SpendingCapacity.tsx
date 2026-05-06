"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpendingCapacityProps {
  category: string;
  spent: number;
  limit: number;
  period?: "semana" | "mês";
}

export function SpendingCapacity({ 
  category, 
  spent, 
  limit, 
  period = "mês" 
}: SpendingCapacityProps) {
  const percentage = Math.min((spent / limit) * 100, 100);
  const remaining = limit - spent;
  const isOverBudget = spent > limit;
  
  // Lógica comportamental: mudar a cor suavemente
  const getProgressColor = () => {
    if (percentage < 50) return "bg-violet-500";
    if (percentage < 85) return "bg-indigo-500";
    return "bg-amber-500";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[50px] rounded-full -mr-16 -mt-16 pointer-events-none" />
      
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded-full">
              Capacidade de Gasto
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            {category}
          </h3>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors",
          isOverBudget 
            ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        )}>
          {isOverBudget ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-xs font-bold text-white/20 uppercase tracking-wider">
              {isOverBudget ? "Excesso" : "Margem de Segurança"}
            </p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {formatCurrency(Math.abs(remaining))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-white/20 uppercase tracking-wider mb-1">
              Status
            </p>
            <p className={cn(
              "text-xs font-bold uppercase tracking-tight",
              isOverBudget ? "text-amber-500" : "text-emerald-400"
            )}>
              {isOverBudget ? "Ajuste Necessário" : "Zona Segura"}
            </p>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("absolute top-0 left-0 h-full rounded-full shadow-[0_0_15px_rgba(139,92,246,0.3)]", getProgressColor())}
          />
        </div>

        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
              Meta: {formatCurrency(limit)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-white/40">
            <TrendingDown className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-tighter italic">
              {percentage.toFixed(0)}% utilizado neste {period}
            </span>
          </div>
        </div>
      </div>

      {/* Comportamental reinforcement footer */}
      {!isOverBudget && (
        <div className="mt-6 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-[10px] text-emerald-400/80 font-medium leading-tight">
            Ótimo ritmo! Manter esse controle garante o sucesso da sua meta de economia.
          </p>
        </div>
      )}
    </div>
  );
}
