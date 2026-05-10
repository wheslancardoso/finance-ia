"use client";

import { GoalsManager } from "@/components/GoalsManager";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import { Target, Trophy, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function GoalsPage() {
  const { goals, loading } = useFinancialData();

  const stats = useMemo(() => {
    const totalSaved = goals.reduce((acc, g) => acc + (g.current_amount_cents || 0), 0);
    const totalTarget = goals.reduce((acc, g) => acc + (g.target_amount_cents || 0), 0);
    const remaining = totalTarget - totalSaved;
    const avgProgress = goals.length > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return { totalSaved, totalTarget, remaining, avgProgress };
  }, [goals]);

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-12">
      {/* Goals Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-8 space-y-4 border-violet-500/20 bg-violet-500/5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total Reservado</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(stats.totalSaved)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">{stats.avgProgress.toFixed(1)}% do caminho percorrido</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Target className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Meta Total Acumulada</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(stats.totalTarget)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Soma de todos os objetivos</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-white/10 bg-white/5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Restante para Concluir</p>
            <h2 className="text-3xl font-black text-white/60 tabular-nums">{formatCurrency(stats.remaining)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Esforço necessário</p>
          </div>
        </GlassCard>
      </div>

      <GoalsManager />
    </div>
  );
}
