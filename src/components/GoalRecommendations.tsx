"use client";
import React from "react";
import { Sparkles, ArrowRight, Wallet, Target, Calendar, Lock } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "./GlassCard";
import { useGoalModal } from "@/context/GoalModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";

interface GoalRecommendationsProps {
  activeSimulations?: any[];
}

export default function GoalRecommendations({ activeSimulations = [] }: GoalRecommendationsProps) {
  const { goalProjections, debtExit } = useFinancialAnalysis(0, activeSimulations);
  const { openContribution } = useGoalModal();

  if (!goalProjections || goalProjections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Estratégia de Aporte</h3>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full border",
          debtExit.monthlySurplus > 0 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
          <Wallet className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Sobra Estimada: {formatCurrency(debtExit.monthlySurplus)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goalProjections.map((rec) => (
          <button
            key={rec.goalId}
            onClick={() => rec.canFocusNow && openContribution({ id: rec.goalId, name: rec.goalName })}
            disabled={!rec.canFocusNow}
            data-testid="goal-recommendation-item"
            className={cn(
              "group text-left transition-all",
              !rec.canFocusNow && "opacity-60 cursor-not-allowed"
            )}
          >
            <GlassCard className={cn(
              "p-4 border-white/5 transition-all relative overflow-hidden",
              rec.canFocusNow ? "group-hover:border-violet-500/30 group-hover:bg-violet-500/5" : "bg-black/20"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  rec.canFocusNow ? "bg-violet-500/10 text-violet-400" : "bg-white/5 text-white/20"
                )}>
                  {rec.canFocusNow ? <Target className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-tighter text-white/40 mb-0.5">Início Estimado</p>
                  <p className={cn(
                    "text-[10px] font-bold uppercase",
                    rec.canFocusNow ? "text-emerald-400" : "text-white/60"
                  )}>
                    {rec.canFocusNow ? "AGORA" : rec.focusDate.toLocaleDateString("pt-BR", { month: 'short', year: '2-digit' })}
                  </p>
                </div>
              </div>
              
              <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors truncate">
                {rec.goalName}
              </h4>

              <p className={cn(
                "mt-1 text-[10px] leading-relaxed min-h-[30px]",
                rec.canFocusNow ? "text-white/40" : "text-amber-400/60 font-medium"
              )}>
                {rec.reasoning}
              </p>
              
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                    {rec.canFocusNow ? "Aporte Sugerido" : "Pronto em"}
                  </p>
                  <p className="text-base font-black text-white">
                    {rec.canFocusNow 
                      ? formatCurrency(rec.recommendedAmountCents) 
                      : rec.completionDate.toLocaleDateString("pt-BR", { month: 'short', year: '2-digit' })
                    }
                  </p>
                </div>
                {rec.canFocusNow && (
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-violet-500 transition-all shadow-lg">
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white" />
                  </div>
                )}
              </div>
            </GlassCard>
          </button>
        ))}
      </div>
    </div>
  );
}

