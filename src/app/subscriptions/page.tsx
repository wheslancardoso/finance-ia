"use client";

import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { Zap, Bell, CreditCard, AlertCircle, AlertTriangle } from "lucide-react";
import { SubscriptionManager } from "@/components/SubscriptionManager";
import { SyncUser } from "@/components/SyncUser";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useEffect, useMemo } from "react";

export default function SubscriptionsPage() {
  const { monthlyOutlook, netLiquidityCents, isSurvivalMode } = useFinancialAnalysis();
  const { recurringTransactions, recurringExpensesCents, recurringIncomeCents } = useFinancialData();

  const stats = useMemo(() => {
    const expenseCount = recurringTransactions.filter(s => s.status === "active" && s.transaction_type === "EXPENSE").length;

    return {
      totalExpenses: recurringExpensesCents,
      totalIncomes: recurringIncomeCents,
      expenseCount
    };
  }, [recurringTransactions, recurringIncomeCents, recurringExpensesCents]);

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full space-y-12">
      <SyncUser />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className={cn(
          "p-8 space-y-4 border-emerald-500/20",
          monthlyOutlook.isHealthy ? "bg-emerald-500/5" : "bg-red-500/5 border-red-500/20"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            monthlyOutlook.isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {monthlyOutlook.isHealthy ? <Zap className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
              {isSurvivalMode ? "Saldo Comprometido" : "Saldo Livre Estimado"}
            </p>
            <h2 className={cn(
              "text-3xl font-black tabular-nums",
              monthlyOutlook.isHealthy ? "text-white" : "text-red-400"
            )}>{formatCurrency(monthlyOutlook.balanceAtMonthEnd)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase italic">
              {isSurvivalMode ? "⚠️ Sua liquidez real está negativa" : "Após todos os custos fixos"}
            </p>
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

        <GlassCard className="p-8 space-y-4 border-white/10 bg-white/5 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-emerald-400 transition-colors">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Receita Recorrente</p>
            <h2 className="text-3xl font-black text-emerald-400 tabular-nums">+{formatCurrency(stats.totalIncomes)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Salário e outros fixos</p>
          </div>
        </GlassCard>
      </div>

      {/* Intelligence: Subscription Insight */}
      <GlassCard className={cn(
        "p-6 border-l-4",
        isSurvivalMode ? "border-l-red-500 bg-red-500/5" : "border-l-violet-500 bg-violet-500/5"
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl",
            isSurvivalMode ? "bg-red-500/20 text-red-400" : "bg-violet-500/20 text-violet-400"
          )}>
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">Insight Financeiro</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              {isSurvivalMode 
                ? "Atenção: Seus custos fixos estão sendo pagos enquanto sua liquidez real está negativa. Recomendo revisar assinaturas não essenciais para acelerar a recuperação da sua saúde financeira."
                : "Seus custos fixos estão bem dimensionados para sua liquidez atual. Você tem uma margem de segurança saudável para manter seus compromissos recorrentes."
              }
            </p>
          </div>
        </div>
      </GlassCard>

      <SubscriptionManager />
    </div>
  );
}
