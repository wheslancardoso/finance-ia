"use client";

import React, { useState, useMemo } from "react";
import { SpendingCapacity } from "./SpendingCapacity";
import { TransactionTimeline } from "./TransactionTimeline";
import { TimeTravelSlider } from "./TimeTravelSlider";
import { calculateProjectedBalance } from "@/utils/finance-projections";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, History, Zap, ShieldCheck, AlertCircle } from "lucide-react";
import { addDays, endOfMonth, differenceInDays } from "date-fns";
import { QuickSyncModal } from "./QuickSyncModal";
import { cn } from "@/lib/utils";

interface RealtimeDashboardProps {
  initialBalance: number;
  initialTransactions: any[];
  initialBudgets: any[];
  initialRecurring: any[];
  lastFutureTransactionDate?: string | null;
  accounts: any[];
}

export default function RealtimeDashboard({ 
  initialBalance, 
  initialTransactions, 
  initialBudgets,
  initialRecurring,
  lastFutureTransactionDate,
  accounts
}: RealtimeDashboardProps) {
  const [days, setDays] = useState(0);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const handleQuickSync = (account: any) => {
    setSelectedAccount(account);
    setSyncModalOpen(true);
  };

  // 1. Cálculo da Projeção (Viagem no Tempo)
  const projectedBalance = useMemo(() => {
    const targetDate = addDays(new Date(), days);
    const formattedBudgets = initialBudgets.map(b => ({
      amount_cents: b.limit,
      spent_this_month: b.spent
    }));
    return calculateProjectedBalance(initialBalance, targetDate, initialRecurring || [], formattedBudgets);
  }, [initialBalance, initialRecurring, days, initialBudgets]);

  // 2. Visão Prática: "Quanto me sobra este mês?"
  const monthlyOutlook = useMemo(() => {
    const endOfCurrentMonth = endOfMonth(new Date());
    const daysUntilEnd = differenceInDays(endOfCurrentMonth, new Date());
    
    const formattedBudgets = initialBudgets.map(b => ({
      amount_cents: b.limit,
      spent_this_month: b.spent
    }));
    
    // Projeção até o fim do mês atual
    const balanceAtMonthEnd = calculateProjectedBalance(
      initialBalance, 
      endOfCurrentMonth, 
      initialRecurring || [], 
      formattedBudgets
    );
    
    const plannedExpenses = initialBalance - balanceAtMonthEnd;
    
    return {
      balanceAtMonthEnd,
      plannedExpenses: Math.abs(plannedExpenses),
      isHealthy: balanceAtMonthEnd >= 0
    };
  }, [initialBalance, initialRecurring, initialBudgets]);

  const isFuture = days > 0;
  const balanceDifference = projectedBalance - initialBalance;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Summary & Controls */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* Simplified Cockpit Header */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 relative overflow-hidden group">
          <div className={cn(
            "absolute -top-24 -left-24 w-64 h-64 blur-[100px] rounded-full transition-colors duration-1000",
            isFuture ? "bg-violet-600/20" : "bg-emerald-600/10"
          )} />
          
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/40 font-bold text-xs uppercase tracking-[0.2em]">
                  <Wallet className="w-4 h-4" />
                  {isFuture ? "Patrimônio Projetado" : "Liquidez Atual"}
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

            {/* Quick Account Sync Bar */}
            {!isFuture && (
              <div className="flex flex-wrap gap-3">
                {accounts.filter(a => a.type !== "CREDIT_CARD").map(acc => (
                  <button 
                    key={acc.id}
                    onClick={() => handleQuickSync(acc)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color_hex }} />
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors">{acc.name}</span>
                    <span className="text-[10px] font-black text-white tabular-nums">{formatCurrency(acc.balance_cents)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Practical Insights Bar (Previsão do Mês) */}
            {!isFuture && (
              <div className="flex flex-wrap gap-4 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 bg-white/2 px-4 py-3 rounded-2xl border border-white/5">
                  <ArrowDownRight className="w-4 h-4 text-red-400/60" />
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Gastos Previstos</p>
                    <p className="text-sm font-bold text-white/80">{formatCurrency(monthlyOutlook.plannedExpenses)}</p>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all",
                  monthlyOutlook.isHealthy ? "bg-emerald-500/5 border-emerald-500/10" : "bg-red-500/5 border-red-500/10"
                )}>
                  {monthlyOutlook.isHealthy ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Sobra Livre</p>
                    <p className={cn(
                      "text-sm font-black",
                      monthlyOutlook.isHealthy ? "text-emerald-400" : "text-red-400"
                    )}>
                      {formatCurrency(monthlyOutlook.balanceAtMonthEnd)}
                    </p>
                  </div>
                </div>
              </div>
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
              Recentes
            </h3>
            <button className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors">Ver Tudo</button>
          </div>

          <div className="flex-1">
            <TransactionTimeline transactions={initialTransactions} />
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex items-center justify-between p-4 bg-violet-600 rounded-3xl shadow-xl shadow-violet-600/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Vesper Insights</span>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {selectedAccount && (
        <QuickSyncModal 
          isOpen={syncModalOpen}
          onClose={() => setSyncModalOpen(false)}
          account={selectedAccount}
        />
      )}
    </div>
  );
}
