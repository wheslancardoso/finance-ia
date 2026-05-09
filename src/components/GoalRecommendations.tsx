"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, Wallet, Target } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "./GlassCard";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useGoalModal } from "@/context/GoalModalContext";

export default function GoalRecommendations() {
  const { getGoalRecommendations } = useFinancialData();
  const { openContribution } = useGoalModal();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getGoalRecommendations();
      setData(res);
      setLoading(false);
    }
    load();
  }, [getGoalRecommendations]);

  if (loading) {
    return (
      <div className="w-full h-32 bg-white/5 rounded-[32px] animate-pulse border border-white/5 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-white/10 animate-spin" />
      </div>
    );
  }

  if (!data || !data.recommendations || data.recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Sugestões de Aporte</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <Wallet className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            Sobra Projetada: {formatCurrency(data.surplus_cents)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.recommendations.map((rec: any) => (
          <button
            key={rec.goal_id}
            onClick={() => openContribution({ id: rec.goal_id, name: rec.goal_name })}
            className="group text-left"
          >
            <GlassCard className="p-4 border-white/5 group-hover:border-violet-500/30 transition-all hover:translate-y-[-2px]">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-violet-400" />
                </div>
                {rec.is_full_target && (
                  <span className="text-[8px] font-black uppercase tracking-tighter bg-violet-500 text-white px-2 py-0.5 rounded-full">
                    Meta Batida
                  </span>
                )}
              </div>
              
              <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors truncate">
                {rec.goal_name}
              </h4>
              
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Sugerido</p>
                  <p className="text-base font-black text-white">{formatCurrency(rec.recommended_amount_cents)}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-violet-500 transition-all">
                  <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white" />
                </div>
              </div>
            </GlassCard>
          </button>
        ))}
      </div>
    </div>
  );
}
