"use client";

import { GoalsManager } from "@/components/GoalsManager";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import { Target, Trophy, TrendingUp, ShieldCheck, AlertCircle, Plus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useEffect } from "react";

import { useGoalModal } from "@/context/GoalModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";

export default function GoalsPage() {
  const { goals, loading } = useFinancialData();
  const { openModal } = useGoalModal();
  const { netLiquidityCents, totalConsolidatedDebtCents, isSurvivalMode } = useFinancialAnalysis();

  const stats = useMemo(() => {
    const totalSaved = goals.reduce((acc, g) => acc + (g.current_amount_cents || 0), 0);
    const totalTarget = goals.reduce((acc, g) => acc + (g.target_amount_cents || 0), 0);
    const remaining = totalTarget - totalSaved;
    const avgProgress = goals.length > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return { totalSaved, totalTarget, remaining, avgProgress };
  }, [goals]);

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-bold text-violet-500 uppercase tracking-[0.3em]">Ambições</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white">Suas Metas</h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Reservado:</span>
              <span className="text-sm font-bold text-violet-400 tabular-nums">{formatCurrency(stats.totalSaved)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Objetivo Total:</span>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(stats.totalTarget)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Faltam:</span>
              <span className="text-sm font-bold text-white/60 tabular-nums">{formatCurrency(stats.remaining)}</span>
            </div>
            <div className="h-4 w-px bg-white/10 hidden md:block" />
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-violet-500 rounded-full" 
                  style={{ width: `${stats.avgProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-white/40">{stats.avgProgress.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={openModal}
          className="bg-white text-black font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-2 group active:scale-95 shadow-xl shadow-white/10 shrink-0"
          data-testid="add-goal-button"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Novo Objetivo
        </button>
      </header>
      
      {/* Intelligence Bridge Insight */}
      <GlassCard className={cn(
        "p-6 flex flex-col md:flex-row items-center gap-6 border-l-4 transition-all",
        !isSurvivalMode 
          ? "border-l-emerald-500 bg-emerald-500/5 border-emerald-500/10" 
          : "border-l-red-500 bg-red-500/5 border-red-500/10"
      )}>
        <div className={cn(
          "w-16 h-16 rounded-3xl flex items-center justify-center shrink-0",
          !isSurvivalMode ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        )}>
          {!isSurvivalMode ? <ShieldCheck className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>
        <div className="space-y-1 flex-1 text-center md:text-left">
          <h3 className="text-sm font-black uppercase tracking-[0.15em] text-white/80">Insight Estratégico: Capacidade de Aporte</h3>
          <p className="text-xs text-white/40 leading-relaxed max-w-2xl">
            {netLiquidityCents >= 0 
              ? "Com base no seu Panorama Mensal, você tem segurança para manter seus aportes conforme o planejado."
              : `Trava de Segurança: Você possui uma dívida consolidada de ${formatCurrency(totalConsolidatedDebtCents)}. O sistema recomenda pausar os aportes em metas. Sua prioridade agora é converter sua sobra mensal em liquidez real para quitar as faturas.`}
          </p>
        </div>
        {isSurvivalMode && (
          <div className="px-4 py-2 bg-red-500/20 border border-red-500/20 rounded-xl text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">
            Ciclo de Dívida Detectado
          </div>
        )}
      </GlassCard>

      {loading ? (
        <div className="py-24 flex flex-col items-center text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin mb-4" />
          <p className="text-white/40 text-sm font-medium">Sincronizando suas ambições...</p>
        </div>
      ) : (
        <GoalsManager />
      )}
    </div>
  );
}
