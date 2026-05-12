"use client";

import React from "react";
import { Target, Plus, Sparkles, ShieldCheck } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { useGoalModal } from "@/context/GoalModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import GoalRecommendations from "./GoalRecommendations";

interface GoalsManagerProps {
  initialGoals?: any[];
}

export function GoalsManager({ initialGoals }: GoalsManagerProps) {
  const { goals: contextGoals, loading, netLiquidityCents } = useFinancialData();
  const { openModal, openContribution, openDetail } = useGoalModal();


  const goalsToDisplay = contextGoals.length > 0 ? contextGoals : (initialGoals || []);

  return (
    <div className="space-y-10">
      <GoalRecommendations />

      {(!goalsToDisplay || goalsToDisplay.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/10">
            <Target className="w-10 h-10 text-white/20" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Nenhuma meta ativa</h3>
            <p className="text-white/40 max-w-xs mx-auto">
              Defina seu primeiro objetivo para começar a visualizar o futuro do seu dinheiro.
            </p>
            <button 
              onClick={openModal}
              className="text-violet-400 font-bold text-sm hover:text-violet-300 transition-colors pt-4"
              data-testid="add-goal-button-internal"
            >
              Criar agora →
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {goalsToDisplay.map((goal) => {
            const percentage = Math.min((goal.current_amount_cents / goal.target_amount_cents) * 100, 100);
            const remaining = goal.target_amount_cents - goal.current_amount_cents;
            
            return (
              <div key={goal.id} className="group relative" data-testid={`goal-card-${goal.id}`}>
                <GlassCard className="h-full flex flex-col gap-8 transition-all hover:border-white/20">
                  <div className="flex items-start justify-between">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner"
                      style={{ backgroundColor: `${goal.color_hex}15`, color: goal.color_hex }}
                    >
                      <Sparkles className="w-7 h-7" />
                    </div>
                    {goal.deadline && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Prazo Estimado</p>
                        <p className="text-xs font-bold text-white/60">
                          {new Date(goal.deadline).toLocaleDateString("pt-BR", { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>

                  {percentage >= 100 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pronto para Compra (Segurança Total)</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white tracking-tight" data-testid="goal-card-title">{goal.name}</h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-bold">{formatCurrency(goal.current_amount_cents)}</span>
                      <span className="text-white/20 text-xs">de {formatCurrency(goal.target_amount_cents)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        style={{ width: `${percentage}%`, backgroundColor: goal.color_hex }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span style={{ color: goal.color_hex }}>{percentage.toFixed(1)}% Completo</span>
                      <span className="text-white/20">Faltam {formatCurrency(remaining)}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <button 
                      onClick={() => openDetail(goal)}
                      data-testid="goal-details-button"
                      className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors"
                    >
                      Detalhes
                    </button>
                    <button 
                      onClick={() => openContribution(goal)}
                      className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest transition-all"
                      data-testid="goal-contribution-button"
                    >
                      Aportar
                    </button>
                  </div>
                </GlassCard>
              </div>
            );
          })}
          
          <button 
            onClick={openModal}
            className="p-8 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-4 text-white/10 hover:text-white/20 hover:border-white/10 transition-all group"
            data-testid="add-goal-button-internal"
          >
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest">Nova Meta</p>
          </button>
        </div>
      )}
    </div>
  );
}
