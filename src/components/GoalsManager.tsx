"use client";

import React, { useState } from "react";
import { Target, Plus, Sparkles, ShieldCheck, Loader2, GripVertical, ListOrdered, Grid3X3 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { useGoalModal } from "@/context/GoalModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import GoalRecommendations from "./GoalRecommendations";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { db } from "@/lib/db";

interface GoalsManagerProps {
  initialGoals?: any[];
}

export function GoalsManager({ initialGoals }: GoalsManagerProps) {
  const { goals: contextGoals, loading, netLiquidityCents, isGamificationEnabled, upsertGoal, refreshData } = useFinancialData();
  const { openModal, openContribution, openDetail } = useGoalModal();

  const [viewMode, setViewMode] = useState<"grid" | "reorder">("grid");
  const [orderedGoals, setOrderedGoals] = useState<any[]>([]);
  const [iaLoading, setIaLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[] | null>(null);
  const [showIAPanel, setShowIAPanel] = useState(false);

  const goalsToDisplay = contextGoals.length > 0 ? contextGoals : (initialGoals || []);

  // Sincronizar orderedGoals quando goalsToDisplay mudar
  React.useEffect(() => {
    const sorted = [...goalsToDisplay].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    setOrderedGoals(sorted);
  }, [goalsToDisplay]);

  const handleReorder = async (newOrder: any[]) => {
    setOrderedGoals(newOrder);
    try {
      // Atualizar a prioridade sequencial de todas as metas
      const updates = newOrder.map((goal, index) => ({
        ...goal,
        priority: index + 1
      }));

      // 1. Atualização atômica instantânea no cache local Dexie
      await db.goals.bulkPut(updates);

      // 2. Envio paralelo dos updates na API Supabase sem concorrência de refresh
      await Promise.all(
        updates.map(async (g) => {
          const res = await fetch("/api/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(g)
          });
          if (!res.ok) {
            console.error(`Falha ao sincronizar meta ${g.id} na nuvem`);
          }
        })
      );

      // 3. Disparar um ÚNICO refresh global consistente para recalcular todo o motor
      await refreshData();
    } catch (error) {
      console.error("Falha ao salvar nova ordenação de metas:", error);
    }
  };

  const handleOptimizeWithIA = async () => {
    setIaLoading(true);
    setShowIAPanel(true);
    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "optimize-goals",
          goals: goalsToDisplay,
          financial_summary: {
            net_liquidity_cents: netLiquidityCents
          }
        })
      });

      if (!res.ok) throw new Error("Erro na classificação de IA");

      const data = await res.json();
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error("Falha ao otimizar metas com IA:", error);
    } finally {
      setIaLoading(false);
    }
  };

  const handleApplyRecommendations = async () => {
    if (!recommendations) return;
    setIaLoading(true);

    try {
      const updatedGoals = goalsToDisplay.map(goal => {
        const rec = recommendations.find(r => r.goal_id === goal.id);
        if (rec) {
          return {
            ...goal,
            priority: rec.suggested_priority
          };
        }
        return goal;
      });

      for (const g of updatedGoals) {
        await upsertGoal(g);
      }

      await refreshData();
      setRecommendations(null);
      setShowIAPanel(false);
    } catch (error) {
      console.error("Falha ao aplicar recomendações da IA:", error);
    } finally {
      setIaLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <GoalRecommendations />

      {goalsToDisplay.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Suas Ambições</h2>
              <p className="text-xs text-white/40">Fila soberana de prioridades ativas</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Seletor Visual Slide Tabs */}
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-[3px] flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer z-10",
                    viewMode === "grid" ? "text-black font-black" : "text-white/40 hover:text-white"
                  )}
                >
                  {viewMode === "grid" && (
                    <motion.div
                      layoutId="goalsViewActive"
                      className="absolute inset-0 bg-white rounded-lg -z-10 shadow-lg"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Grid3X3 className="w-3 h-3" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("reorder")}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer z-10",
                    viewMode === "reorder" ? "text-black font-black" : "text-white/40 hover:text-white"
                  )}
                >
                  {viewMode === "reorder" && (
                    <motion.div
                      layoutId="goalsViewActive"
                      className="absolute inset-0 bg-white rounded-lg -z-10 shadow-lg"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <ListOrdered className="w-3 h-3" />
                  <span>Fila Drag</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleOptimizeWithIA}
                disabled={iaLoading || goalsToDisplay.length < 2}
                data-testid="optimize-goals-ia-button"
                className="px-4 py-2.5 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {iaLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Auditar Fila com IA</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showIAPanel && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                data-testid="ia-recommendations-panel"
                className="p-6 rounded-[28px] bg-violet-955/10 border border-violet-500/20 space-y-6 relative overflow-hidden backdrop-blur-md"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Copiloto IA Soberana
                    </span>
                    <h4 className="text-base font-bold text-white">Auditoria Diagnóstica de Fila</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRecommendations(null);
                      setShowIAPanel(false);
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60 transition-colors"
                  >
                    Ignorar
                  </button>
                </div>

                {iaLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest animate-pulse">
                      Processando causalidade matemática da fila...
                    </span>
                  </div>
                ) : recommendations && recommendations.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommendations.map((rec) => {
                        const goal = goalsToDisplay.find(g => g.id === rec.goal_id);
                        if (!goal) return null;

                        return (
                          <div
                            key={rec.goal_id}
                            className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 flex flex-col justify-between"
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-sm font-bold text-white">{goal.name}</span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-[9px] uppercase tracking-wider">
                                Sugerida: #{rec.suggested_priority}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/50 leading-relaxed font-medium">
                              {rec.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleApplyRecommendations}
                        className="px-5 py-3 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 cursor-pointer"
                      >
                        Aplicar Otimização Sugerida
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecommendations(null);
                          setShowIAPanel(false);
                        }}
                        className="px-5 py-3 rounded-xl bg-white/5 text-white/50 border border-white/10 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer"
                      >
                        Manter Fila Manual
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-white/40 italic py-4">
                    Nenhuma otimização necessária. Sua fila está matematicamente perfeita sob os Tiers de Antifragilidade!
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
              data-testid="add-goal-button"
            >
              Criar agora →
            </button>
          </div>
        </div>
      ) : viewMode === "reorder" ? (
        <div className="space-y-6">
          <Reorder.Group 
            axis="y" 
            values={orderedGoals} 
            onReorder={handleReorder}
            className="space-y-4 max-w-3xl mx-auto"
          >
            {orderedGoals.map((goal, index) => {
              const percentage = Math.min((goal.current_amount_cents / goal.target_amount_cents) * 100, 100);
              const remaining = goal.target_amount_cents - goal.current_amount_cents;
              const isCrisisMode = netLiquidityCents < 0;
              const isEmergencyGoal = (name: string) => /emerg[êe]ncia|sobreviv[êe]ncia|oxig[êe]nio|reserva/i.test(name);
              const isLocked = isGamificationEnabled && isCrisisMode && !isEmergencyGoal(goal.name);

              return (
                <Reorder.Item
                  key={goal.id}
                  value={goal}
                  dragListener={!isLocked}
                  className={cn(
                    "relative backdrop-blur-xl bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 group cursor-grab active:cursor-grabbing hover:border-white/10 transition-all select-none",
                    isLocked && "opacity-50 cursor-not-allowed select-none bg-red-955/5 border-red-500/15"
                  )}
                  whileDrag={{ 
                    scale: 1.02, 
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderColor: goal.color_hex || "#8B5CF6",
                    boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)"
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Grip Handle */}
                    {!isLocked ? (
                      <div className="text-white/20 group-hover:text-white/40 transition-colors p-1 shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-6 shrink-0" />
                    )}

                    {/* Priority Pill */}
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0"
                      style={{ 
                        backgroundColor: isLocked ? "rgba(239, 68, 68, 0.05)" : `${goal.color_hex || "#8B5CF6"}15`,
                        color: isLocked ? "#ef4444" : (goal.color_hex || "#8B5CF6"),
                        border: `1px solid ${isLocked ? "#ef444430" : `${goal.color_hex || "#8B5CF6"}30`}` 
                      }}
                    >
                      #{index + 1}
                    </div>

                    {/* Goal Info */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm truncate">{goal.name}</h4>
                        {isLocked && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-extrabold text-[8px] uppercase tracking-wider shrink-0">
                            Bloqueada
                          </span>
                        )}
                      </div>
                      
                      {/* Compact Progress Bar */}
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden shrink-0">
                          <div 
                            className="h-full rounded-full animate-[shimmer_2s_infinite]"
                            style={{ 
                              width: `${percentage}%`, 
                              backgroundColor: isLocked ? "#ef4444" : (goal.color_hex || "#8B5CF6") 
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-white/40">{percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount / Deadline */}
                  <div className="text-right shrink-0 flex items-center gap-6">
                    <div>
                      <p className="text-xs font-black text-white tabular-nums">
                        {formatCurrency(goal.current_amount_cents)}
                      </p>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-wider">
                        Alvo {formatCurrency(goal.target_amount_cents)}
                      </p>
                    </div>
                    {goal.deadline && (
                      <div className="hidden sm:block border-l border-white/5 pl-6 text-left">
                        <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Prazo</p>
                        <p className="text-[10px] font-bold text-white/60">
                          {new Date(goal.deadline).toLocaleDateString("pt-BR", { month: 'short', year: '2-digit' })}
                        </p>
                      </div>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          <div className="max-w-3xl mx-auto pt-4 flex justify-center">
            <button 
              onClick={openModal}
              className="px-6 py-4 border border-dashed border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.03] text-white/40 hover:text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all cursor-pointer w-full"
              data-testid="add-goal-button"
            >
              <Plus className="w-4 h-4" />
              Nova Meta de Poupança
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {goalsToDisplay.map((goal) => {
            const percentage = Math.min((goal.current_amount_cents / goal.target_amount_cents) * 100, 100);
            const remaining = goal.target_amount_cents - goal.current_amount_cents;
            
            const isCrisisMode = netLiquidityCents < 0;
            const isEmergencyGoal = (name: string) => /emerg[êe]ncia|sobreviv[êe]ncia|oxig[êe]nio|reserva/i.test(name);
            const isLocked = isGamificationEnabled && isCrisisMode && !isEmergencyGoal(goal.name);
            
            return (
              <div key={goal.id} className="group relative" data-testid={`goal-card-${goal.id}`}>
                <GlassCard className={cn(
                  "h-full flex flex-col gap-8 transition-all hover:border-white/20",
                  isLocked && "opacity-60 cursor-not-allowed select-none bg-red-955/5 border-red-500/15"
                )}>
                  <div className="flex items-start justify-between">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner"
                      style={{ backgroundColor: isLocked ? "rgba(239, 68, 68, 0.05)" : `${goal.color_hex}15`, color: isLocked ? "#ef4444" : goal.color_hex }}
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

                  {isLocked && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col gap-1.5" data-testid="goal-lockout-warning">
                      <span className="text-red-400 font-extrabold text-[10px] tracking-wider uppercase">⚠️ META CONGELADA</span>
                      <p className="text-[10px] text-red-300/80 leading-relaxed font-bold">
                        Seu oxigênio financeiro está abaixo do nível crítico. O motor de simulação bloqueou aportes nesta meta para preservar sua sobrevivência.
                      </p>
                    </div>
                  )}

                  {percentage >= 100 && !isLocked && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pronto para Compra (Segurança Total)</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {recommendations && (
                      (() => {
                        const rec = recommendations.find(r => r.goal_id === goal.id);
                        if (rec && rec.suggested_priority !== goal.priority) {
                          return (
                            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-400/5 border border-amber-400/10 px-2.5 py-1 rounded-lg w-fit text-[9px] font-black uppercase tracking-wider animate-pulse">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Sugestão IA: Prioridade #{rec.suggested_priority}</span>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                    <h3 className="text-2xl font-bold text-white tracking-tight" data-testid="goal-card-title">{goal.name}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-white font-bold">{formatCurrency(goal.current_amount_cents)}</span>
                        <span className="text-white/20 text-xs">de {formatCurrency(goal.target_amount_cents)}</span>
                      </div>
                      {goal.monthly_contribution_cents > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{formatCurrency(goal.monthly_contribution_cents)} / mês</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        style={{ width: `${percentage}%`, backgroundColor: isLocked ? "#ef4444" : goal.color_hex }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span style={{ color: isLocked ? "#ef4444" : goal.color_hex }}>{percentage.toFixed(1)}% Completo</span>
                      <span className="text-white/20">Faltam {formatCurrency(remaining)}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <button 
                      onClick={() => !isLocked && openDetail(goal)}
                      disabled={isLocked}
                      data-testid="goal-details-button"
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest transition-colors",
                        isLocked ? "text-white/10 cursor-not-allowed" : "text-white/40 hover:text-white"
                      )}
                    >
                      Detalhes
                    </button>
                    <button 
                      onClick={() => !isLocked && openContribution(goal)}
                      disabled={isLocked}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                        isLocked 
                          ? "bg-red-500/5 text-red-500/40 cursor-not-allowed border border-red-500/10" 
                          : "bg-white/5 hover:bg-white/10 text-white"
                      )}
                      data-testid="goal-contribution-button"
                    >
                      {isLocked ? "Bloqueada" : "Aportar"}
                    </button>
                  </div>
                </GlassCard>
              </div>
            );
          })}
          
          <button 
            onClick={openModal}
            className="p-8 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-4 text-white/10 hover:text-white/20 hover:border-white/10 transition-all group"
            data-testid="add-goal-button"
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
