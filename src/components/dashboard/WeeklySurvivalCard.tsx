
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Wind, AlertCircle, TrendingDown, Clock } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { type WeeklySurvival } from "@/domain/financial/financial-logic";

interface WeeklySurvivalCardProps {
  data: WeeklySurvival;
}

export function WeeklySurvivalCard({ data }: WeeklySurvivalCardProps) {
  const { weeklyLimitCents, weeklySpentCents, remainingCents, daysRemaining, status } = data;
  
  const percentage = Math.min(100, Math.round((weeklySpentCents / weeklyLimitCents) * 100)) || 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 relative overflow-hidden group",
        status === "CRITICAL" ? "ring-2 ring-red-500/20" : status === "WARNING" ? "ring-2 ring-amber-500/20" : ""
      )}
    >
      {/* Background Glow */}
      <div className={cn(
        "absolute -right-12 -top-12 w-32 h-32 blur-[60px] rounded-full transition-colors",
        status === "CRITICAL" ? "bg-red-500/10" : status === "WARNING" ? "bg-amber-500/10" : "bg-emerald-500/5"
      )} />

      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center",
              status === "CRITICAL" ? "bg-red-500/20 text-red-400" : 
              status === "WARNING" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
            )}>
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Teto de Sobrevivência</h3>
              <p className="text-[10px] text-white/40 font-medium">Janela de 7 dias (Oxigênio)</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-[10px] font-black text-white/20 uppercase tracking-tighter justify-end">
              <Clock className="w-3 h-3" />
              {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} restantes
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Restante</p>
              <p 
                data-testid="weekly-survival-remaining"
                className={cn(
                  "text-3xl font-black tabular-nums",
                  status === "CRITICAL" ? "text-red-400" : status === "WARNING" ? "text-amber-400" : "text-emerald-400"
                )}
              >
                {formatCurrency(remainingCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Limite Semanal</p>
              <p 
                data-testid="weekly-survival-limit"
                className="text-sm font-bold text-white/60"
              >
                {formatCurrency(weeklyLimitCents)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "absolute top-0 left-0 h-full rounded-full",
                status === "CRITICAL" ? "bg-red-500" : status === "WARNING" ? "bg-amber-500" : "bg-emerald-500"
              )}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            {status === "CRITICAL" ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : status === "WARNING" ? (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-emerald-400/40" />
            )}
            <p 
              data-testid="weekly-survival-status"
              className={cn(
                "text-[10px] font-bold uppercase tracking-tight",
                status === "CRITICAL" ? "text-red-400" : status === "WARNING" ? "text-amber-400" : "text-white/40"
              )}
            >
              {status === "CRITICAL" ? "Limite excedido! Redução de danos necessária." : 
               status === "WARNING" ? "Cuidado: Você consumiu mais de 60% do oxigênio." : 
               "Consumo dentro do esperado para a semana."}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
