"use client";

import { formatCurrency } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { Zap, Bell, CreditCard } from "lucide-react";
import { SubscriptionManager } from "@/components/SubscriptionManager";
import { SyncUser } from "@/components/SyncUser";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useEffect, useMemo } from "react";

export default function SubscriptionsPage() {
  const { 
    recurringTransactions, 
    accounts, 
    loading,
    recurringIncomeCents,
    recurringExpensesCents,
    accumulatedBalanceCents 
  } = useFinancialData();
  const userId = "local_user";

  useEffect(() => {
    console.log("📂 [Page:Subscriptions] Componente montado. Fluxos ativos:", recurringTransactions.length);
  }, [recurringTransactions]);

  const stats = useMemo(() => {
    // Saldo livre: Dinheiro em conta + Receitas Recorrentes - Gastos Recorrentes
    const committedBalance = accumulatedBalanceCents + recurringIncomeCents - recurringExpensesCents;
    const expenseCount = recurringTransactions.filter(s => s.status === "active" && s.transaction_type === "EXPENSE").length;

    return {
      totalExpenses: recurringExpensesCents,
      totalIncomes: recurringIncomeCents,
      committedBalance,
      expenseCount
    };
  }, [recurringTransactions, recurringIncomeCents, recurringExpensesCents, accumulatedBalanceCents]);

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-12">
      <SyncUser userId={userId} />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-8 space-y-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Zap className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Saldo Livre Estimado</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(stats.committedBalance)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Após todos os custos fixos</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-violet-500/20 bg-violet-500/5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total de Gastos Fixos</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(stats.totalExpenses)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">De {stats.expenseCount} fontes</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-white/10 bg-white/5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Receita Recorrente</p>
            <h2 className="text-3xl font-black text-emerald-400 tabular-nums">+{formatCurrency(stats.totalIncomes)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Salário e outros fixos</p>
          </div>
        </GlassCard>
      </div>

      <SubscriptionManager />
    </div>
  );
}
