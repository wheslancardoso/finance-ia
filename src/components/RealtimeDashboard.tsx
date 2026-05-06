"use client";

import React, { useState, useMemo } from "react";
import { SpendingCapacity } from "./SpendingCapacity";
import { TimeTravelSlider } from "./TimeTravelSlider";
import { calculateProjectedBalance } from "@/utils/finance-projections";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, History, Zap } from "lucide-react";
import { addDays } from "date-fns";

interface RealtimeDashboardProps {
  initialBalance: number;
  initialTransactions: any[];
  initialBudgets: any[];
  initialRecurring: any[];
  lastFutureTransactionDate?: string | null;
}

export default function RealtimeDashboard({ 
  initialBalance, 
  initialTransactions, 
  initialBudgets,
  initialRecurring,
  lastFutureTransactionDate
}: RealtimeDashboardProps) {
  const [days, setDays] = useState(0);

  const projectedBalance = useMemo(() => {
    const targetDate = addDays(new Date(), days);
    
    // Mapear orçamentos para o formato que a função espera
    const formattedBudgets = initialBudgets.map(b => ({
      amount_cents: b.limit,
      spent_this_month: b.spent
    }));

    return calculateProjectedBalance(
      initialBalance, 
      targetDate, 
      initialRecurring || [], 
      formattedBudgets
    );
  }, [initialBalance, initialRecurring, days, initialBudgets]);

  const isFuture = days > 0;
  const balanceDifference = projectedBalance - initialBalance;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Summary & Controls */}
      <div className="lg:col-span-8 space-y-8">
        {/* Main Balance Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 relative overflow-hidden group">
          <div className={cn(
            "absolute -top-24 -left-24 w-64 h-64 blur-[100px] rounded-full transition-colors duration-1000",
            isFuture ? "bg-violet-600/20" : "bg-emerald-600/10"
          )} />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/40 font-bold text-xs uppercase tracking-[0.2em]">
                <Wallet className="w-4 h-4" />
                {isFuture ? "Patrimônio Projetado" : "Liquidez Disponível"}
              </div>
              <motion.h1 
                key={projectedBalance}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-6xl md:text-7xl font-black tracking-tighter tabular-nums",
                  isFuture ? "text-violet-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]" : "text-white"
                )}
              >
                {formatCurrency(projectedBalance)}
              </motion.h1>
            </div>

            {isFuture && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-sm",
                  balanceDifference >= 0 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                )}
              >
                {balanceDifference >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {formatCurrency(Math.abs(balanceDifference))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Time Travel Control */}
        <TimeTravelSlider 
          onDateChange={setDays} 
          currentDays={days} 
          lastFutureTransactionDate={lastFutureTransactionDate}
        />

        {/* Budget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initialBudgets.map((budget, i) => (
            <SpendingCapacity 
              key={i}
              category={budget.category}
              spent={budget.spent}
              limit={budget.limit}
            />
          ))}
        </div>
      </div>

      {/* Right Column: Activity */}
      <div className="lg:col-span-4 space-y-8">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-white/20" />
              Atividade Recente
            </h3>
            <button className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors">Ver Tudo</button>
          </div>

          <div className="space-y-6 flex-1">
            {initialTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-white/10" />
                </div>
                <p className="text-white/20 text-xs font-medium">Nenhuma transação<br/>registrada hoje.</p>
              </div>
            ) : (
              initialTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                      tx.type === "EXPENSE" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      {tx.type === "EXPENSE" ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors">{tx.description}</p>
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">Hoje</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-black tabular-nums",
                    tx.type === "EXPENSE" ? "text-white" : "text-emerald-400"
                  )}>
                    {tx.type === "EXPENSE" ? "-" : "+"}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex items-center justify-between p-4 bg-violet-600 rounded-3xl shadow-xl shadow-violet-600/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span className="text-xs font-black text-white uppercase tracking-widest">Vesper Insights</span>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper para evitar erro de 'cn' não definido se não for importado
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
