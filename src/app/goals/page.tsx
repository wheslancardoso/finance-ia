"use client";

import { GoalsManager } from "@/components/GoalsManager";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { Target, Trophy, TrendingUp, ShieldCheck, AlertCircle, Plus, Sparkles } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useEffect } from "react";

import { useGoalModal } from "@/context/GoalModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";

export default function GoalsPage() {
  const { goals, loading, isGamificationEnabled } = useFinancialData();
  const { openModal } = useGoalModal();
  
  const [activeSimulations, setActiveSimulations] = useState<any[]>([]);
  const [sweepResult, setSweepResult] = useState<{ advice: string; suggested_simulation: any } | null>(null);
  const [isSweepLoading, setIsSweepLoading] = useState(false);

  const { netLiquidityCents, totalConsolidatedDebtCents, isSurvivalMode, debtExit, optimizeSweepIA } = useFinancialAnalysis(0, activeSimulations);

  const stats = useMemo(() => {
    const totalSaved = goals.reduce((acc, g) => acc + (g.current_amount_cents || 0), 0);
    const totalTarget = goals.reduce((acc, g) => acc + (g.target_amount_cents || 0), 0);
    const remaining = totalTarget - totalSaved;
    const avgProgress = goals.length > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return { totalSaved, totalTarget, remaining, avgProgress };
  }, [goals]);

  const handleAnalyzeSweep = async () => {
    setIsSweepLoading(true);
    try {
      const data = await optimizeSweepIA();
      if (data) {
        setSweepResult(data);
      }
    } catch (error) {
      console.error("Falha ao analisar sweep com IA:", error);
    } finally {
      setIsSweepLoading(false);
    }
  };

  const handleApplySweepSimulation = () => {
    if (sweepResult?.suggested_simulation) {
      setActiveSimulations([sweepResult.suggested_simulation]);
    }
  };

  const handleRemoveSweepSimulation = () => {
    setActiveSimulations([]);
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n\n").map((para, i) => {
      const cleanPara = para.trim();
      if (!cleanPara) return null;
      
      if (cleanPara.startsWith("###")) {
        const title = cleanPara.replace(/^###\s*/, "");
        return (
          <h4 key={i} className="text-xs font-black uppercase tracking-wider text-violet-400 mt-4 mb-2">
            {title}
          </h4>
        );
      }
      
      const parts = cleanPara.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} className="text-xs leading-relaxed text-white/60 font-medium">
          {parts.map((part, idx) => (idx % 2 === 1 ? <strong key={idx} className="font-black text-white">{part}</strong> : part))}
        </p>
      );
    });
  };

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
      {isGamificationEnabled && (
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
      )}

      {/* Otimização de Amortização Acelerada (IA) */}
      <GlassCard className="p-6 border border-violet-500/20 bg-gradient-to-br from-violet-950/10 to-black/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-400">Vesper Copiloto</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Otimização de Amortização Acelerada</h3>
            <p className="text-xs text-white/50 leading-relaxed max-w-2xl">
              Deixe que a Inteligência Artificial audite seus orçamentos ativos e sugira cortes cirúrgicos de baixo impacto. Simule o sweep de economia na Time Machine para ver a antecipação real da sua quitação de dívidas.
            </p>
          </div>
          
          <div className="shrink-0 flex items-center">
            {!sweepResult && !isSweepLoading && (
              <button
                onClick={handleAnalyzeSweep}
                className="bg-violet-600 hover:bg-violet-500 text-white font-black py-3 px-6 rounded-xl transition-all border border-violet-400/20 shadow-lg shadow-violet-950/50 active:scale-95 text-xs uppercase tracking-wider cursor-pointer"
                data-testid="analyze-sweep-button"
              >
                Analisar com IA
              </button>
            )}
          </div>
        </div>

        {isSweepLoading && (
          <div className="mt-6 pt-6 border-t border-white/5 flex flex-col items-center justify-center py-6 space-y-3">
            <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-xs text-violet-400 font-bold uppercase tracking-widest animate-pulse">Consultando oráculo financeiro...</p>
          </div>
        )}

        {sweepResult && !isSweepLoading && (
          <div className="mt-6 pt-6 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-[#050505] border border-violet-500/10 rounded-xl p-4 space-y-3">
              {renderMarkdown(sweepResult.advice)}
            </div>

            {sweepResult.suggested_simulation && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-violet-950/10 border border-violet-500/20 rounded-xl p-4">
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-violet-400">Sugestão de Sweep</span>
                  <h4 className="text-sm font-bold text-white">{sweepResult.suggested_simulation.description}</h4>
                  <p className="text-xs text-white/40">
                    Aporte mensal simulado: <span className="text-emerald-400 font-bold">{formatCurrency(sweepResult.suggested_simulation.amount_cents)}</span> por {sweepResult.suggested_simulation.installments} meses.
                  </p>
                </div>

                <div className="shrink-0">
                  {activeSimulations.length > 0 ? (
                    <button
                      onClick={handleRemoveSweepSimulation}
                      className="bg-transparent border border-red-500/30 hover:bg-red-950/10 text-red-400 font-black py-2.5 px-5 rounded-lg transition-all active:scale-95 text-[10px] uppercase tracking-wider cursor-pointer"
                      data-testid="remove-sweep-button"
                    >
                      Remover Simulação
                    </button>
                  ) : (
                    <button
                      onClick={handleApplySweepSimulation}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/20 font-black py-2.5 px-5 rounded-lg transition-all shadow-md active:scale-95 text-[10px] uppercase tracking-wider cursor-pointer"
                      data-testid="apply-sweep-button"
                    >
                      Simular Impacto no Sweep
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeSimulations.length > 0 && debtExit && (
              <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-xl p-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-left">
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">🚀 Projeção Reativa Ativa</p>
                  <p className="text-[10px] text-white/50">
                    Com a otimização simulada de {formatCurrency(sweepResult.suggested_simulation.amount_cents)}/mês, suas dívidas acumuladas serão liquidadas em:
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">
                    {debtExit.exitDate 
                      ? new Date(debtExit.exitDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                      : "Imediato (Mês Atual!)"
                    }
                  </p>
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    {debtExit.monthsToExit === 999 
                      ? "Estabilização completa pendente" 
                      : `Quitação em ${debtExit.monthsToExit} ${debtExit.monthsToExit === 1 ? 'mês' : 'meses'}!`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {loading ? (
        <div className="py-24 flex flex-col items-center text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin mb-4" />
          <p className="text-white/40 text-sm font-medium">Sincronizando suas ambições...</p>
        </div>
      ) : (
        <GoalsManager activeSimulations={activeSimulations} />
      )}
    </div>
  );
}
