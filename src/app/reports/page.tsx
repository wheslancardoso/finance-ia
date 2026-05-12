"use client";

import React from "react";
import GlassCard from "@/components/GlassCard";
import IncomeMixChart from "@/components/IncomeMixChart";
import NetWorthEvolutionChart from "@/components/NetWorthEvolutionChart";
import { useFinancialData } from "@/context/FinancialDataContext";
import { TrendingUp, PieChart, Activity, ShieldCheck, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ReportsPage() {
  const { healthScore, loading } = useFinancialData();

  if (loading) {
    return (
      <div className="p-6 md:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h2 className="text-4xl font-black tracking-tight text-white italic">Insights <span className="text-violet-400">Vesper</span></h2>
        <p className="text-white/40 font-medium tracking-wide">Análise estratégica do seu ecossistema financeiro.</p>
      </header>

      {/* Top Row: Health & Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider italic">Evolução Patrimonial</h3>
          </div>
          <NetWorthEvolutionChart />
        </GlassCard>

        <GlassCard data-testid="health-score-card" className="p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider italic">Saúde Financeira</h3>
            </div>

            <div className="relative py-8 flex flex-col items-center">
              <svg viewBox="0 0 100 50" className="w-full">
                <path
                  d="M 10,45 A 40,40 0 0 1 90,45"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M 10,45 A 40,40 0 0 1 90,45"
                  fill="none"
                  stroke="url(#healthGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 - (healthScore / 100) * 125.6}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute bottom-4 flex flex-col items-center">
                <span data-testid="health-score-value" className="text-5xl font-black text-white">{healthScore}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Score Vesper</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            {healthScore >= 70 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            )}
            <p className="text-xs font-bold text-white/60">
              {healthScore >= 70 
                ? "Sua estrutura está resiliente. Ótimo momento para novos aportes."
                : "Atenção ao fluxo de caixa. Considere reduzir gastos variáveis."}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Middle Row: Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-pink-400" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider italic">Mix de Receitas</h3>
          </div>
          <IncomeMixChart />
        </GlassCard>

        <GlassCard className="p-8 flex flex-col justify-center">
           <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-[2rem] bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
                <Activity className="w-10 h-10 text-violet-400 animate-pulse" />
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-widest italic">Análise de IA</h4>
              <p className="text-sm text-white/40 max-w-sm mx-auto font-medium leading-relaxed">
                Nossa inteligência detectou que sua renda está 85% concentrada em uma única fonte. 
                Considere diversificar para aumentar sua antifragilidade.
              </p>
              <button className="px-6 py-3 rounded-2xl bg-violet-500 text-white font-black text-xs uppercase tracking-widest hover:bg-violet-600 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                Gerar Relatório PDF
              </button>
           </div>
        </GlassCard>
      </div>
    </div>
  );
}
