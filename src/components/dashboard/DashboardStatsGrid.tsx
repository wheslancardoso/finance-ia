
"use client";

import React from "react";
import { ShieldCheck, AlertCircle, AlertTriangle, History } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";

export function DashboardStatsGrid() {
  const { netLiquidityCents, totalConsolidatedDebtCents, monthlyOutlook, healthScore } = useFinancialAnalysis();

  return (
    <div className="space-y-4">
      {/* Cards de Liquidez e Dívida */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn(
          "border rounded-3xl p-6 flex flex-col gap-1 relative overflow-hidden group transition-all",
          netLiquidityCents >= 0 
            ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" 
            : "bg-red-500/10 border-red-500/20 hover:bg-red-500/20"
        )}>
          <div className="absolute top-4 right-4 transition-colors">
            {netLiquidityCents >= 0 
              ? <ShieldCheck className="w-8 h-8 text-emerald-500/20 group-hover:text-emerald-500/40" /> 
              : <AlertCircle className="w-8 h-8 text-red-500/20 group-hover:text-red-500/40" />
            }
          </div>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            netLiquidityCents >= 0 ? "text-emerald-400/60" : "text-red-400/60"
          )}>Liquidez Líquida (Real)</span>
          <span className={cn(
            "text-3xl font-black tabular-nums",
            netLiquidityCents >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {formatCurrency(netLiquidityCents)}
          </span>
          <p className="text-[10px] text-white/40 mt-2 italic">
            {netLiquidityCents >= 0 
              ? "Seu saldo cobre todas as suas faturas atuais." 
              : "⚠️ TRAVA DE SEGURANÇA: Você está em ciclo de dívida. Pare de usar o cartão e use sua sobra apenas para quitar faturas."}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-1 relative overflow-hidden group hover:bg-white/10 transition-all">
          <div className="absolute top-4 right-4 text-white/10 group-hover:text-white/20 transition-colors">
            <History className="w-8 h-8" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Dívida Total Consolidada</span>
          <span className="text-3xl font-black text-white tabular-nums">
            {formatCurrency(totalConsolidatedDebtCents)}
          </span>
          <p className="text-[10px] text-white/40 mt-2 italic">
            Soma das faturas de todos os cartões.
          </p>
        </div>
      </div>

      {/* Row de Saúde e Sobra */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-3xl p-5 border border-white/10 flex items-center gap-4 group hover:bg-white/10 transition-all">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black",
            (healthScore > 70 && netLiquidityCents >= 0) ? "bg-emerald-500/20 text-emerald-400" : 
            (healthScore > 40 && netLiquidityCents >= 0) ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
          )}>
            {healthScore}
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Saúde Financeira</p>
            <p className={cn(
              "text-sm font-black",
              (healthScore > 70 && netLiquidityCents >= 0) ? "text-emerald-400" : 
              (healthScore > 40 && netLiquidityCents >= 0) ? "text-amber-400" : "text-red-400"
            )}>
              {netLiquidityCents < 0 ? "Em Recuperação" : (healthScore > 70 ? "Excelente" : healthScore > 40 ? "Atenção" : "Crítico")}
            </p>
          </div>
        </div>

        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-3xl border transition-all",
          monthlyOutlook.isHealthy ? "bg-emerald-500/5 border-emerald-500/10" : 
          monthlyOutlook.isRecovering ? "bg-amber-500/5 border-amber-500/10" : "bg-red-500/5 border-red-500/10"
        )}>
          {monthlyOutlook.isHealthy ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : 
           monthlyOutlook.isRecovering ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : 
           <AlertCircle className="w-4 h-4 text-red-400" />}
          <div>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">
              {monthlyOutlook.isRecovering ? "Sobra Comprometida" : "Sobra Livre"}
            </p>
            <p className={cn(
              "text-sm font-black",
              monthlyOutlook.isHealthy ? "text-emerald-400" : 
              monthlyOutlook.isRecovering ? "text-amber-400" : "text-red-400"
            )}>
              {formatCurrency(monthlyOutlook.balanceAtMonthEnd)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
