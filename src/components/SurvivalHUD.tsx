"use client";

import React, { useState } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { Wallet, CalendarDays, Calendar, AlertTriangle, ShieldCheck, Zap, Flame, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useGamification } from "@/hooks/useGamification";
import { endOfMonth, differenceInDays } from "date-fns";

type ViewMode = "DAY" | "WEEK" | "MONTH";

export default function SurvivalHUD() {
  const { 
    monthlyIncomeCents, 
    recurringIncomeCents,
    primaryIncomeCents,
    setMonthlyIncomeCents,
    isGamificationEnabled
  } = useFinancialData();

  const { 
    netLiquidityCents, 
    monthlyOutlook, 
    isSurvivalMode,
    isCrisisMode
  } = useFinancialAnalysis();

  const { 
    profile, 
    monthsOfCoverage, 
    tierInfo 
  } = useGamification();
  
  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");

  // Estado local para o formulário de setup
  const [setupIncome, setSetupIncome] = useState("");

  const survivalCeilingCents = Math.max(0, monthlyOutlook.balanceAtMonthEnd);

  // Cálculos Temporais
  const getDisplayValue = () => {
    const today = new Date();
    const endOfMonthDate = endOfMonth(today);
    const daysLeft = Math.max(1, differenceInDays(endOfMonthDate, today) + 1);
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

    switch (viewMode) {
      case "DAY":
        return survivalCeilingCents / daysLeft;
      case "WEEK":
        return survivalCeilingCents / weeksLeft;
      case "MONTH":
      default:
        return survivalCeilingCents;
    }
  };

  const currentTeto = getDisplayValue();
  const formattedTeto = (currentTeto / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // Determinar Estado Visual via Matrix de Gamificação
  const statusColor = tierInfo.colorClass;
  const statusGlow = tierInfo.glowClass;
  const bgGradient = tierInfo.bgGradient;
  const statusMessage = tierInfo.name;
  
  // Ícone por Tier
  const StatusIcon = (() => {
    if (tierInfo.tier === 0) return Zap;
    if (tierInfo.tier === 1) return AlertTriangle;
    if (tierInfo.tier === 2) return ShieldCheck;
    return Shield;
  })();

  const effectiveIncome = primaryIncomeCents > 0 ? primaryIncomeCents : ((monthlyIncomeCents || 0) + (recurringIncomeCents || 0));
  const hasFinancialData = effectiveIncome > 0;

  if (!isGamificationEnabled) return null;

  // Se não houver nenhum dado e não estiver em crise, podemos ocultar ou mostrar setup
  if (!hasFinancialData && !isSurvivalMode) {
    return (
      <div 
        data-testid="survival-hud"
        className="w-full bg-[#0a0a0a]/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white/80 font-bold mb-1">Configuração de Fluxo</h3>
            <p className="text-sm text-white/40 max-w-sm">
              Configure sua renda mensal abaixo ou marque uma <a href="/subscriptions" className="text-purple-400 hover:underline">receita recorrente como principal</a>.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Renda Mensal (Ex: 3000,00)" 
            className="w-full sm:w-48 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
            value={setupIncome}
            onChange={(e) => setSetupIncome(e.target.value)}
          />
          <button 
            onClick={() => {
              const incomeCents = parseFloat(setupIncome.replace(/\./g, "").replace(",", ".")) * 100;
              if (incomeCents > 0) {
                setMonthlyIncomeCents(incomeCents || 0);
              }
            }}
            className="bg-white text-black font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 transition-colors"
          >
            Ativar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="survival-hud"
      className={cn(
        "relative w-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden mb-8 transition-all duration-500",
        statusGlow
      )}
    >
      {/* Background Gradient Effect */}
      <div className={cn("absolute inset-0 bg-gradient-to-b opacity-40 pointer-events-none", bgGradient)}></div>
      
      {isCrisisMode && (
        <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />
      )}
      
      <div className="relative p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        
        {/* Left Side: Information */}
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center bg-black/50 border border-white/10", statusColor)}>
            <StatusIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Teto de Sobrevivência</span>
              <span 
                data-testid="survival-status-message"
                className={cn(
                  "text-[9px] px-2 py-0.5 rounded-full border bg-black/40 font-bold",
                  tierInfo.tier === 0 ? 'border-rose-500/30 text-rose-400' : 
                  tierInfo.tier === 1 ? 'border-violet-500/30 text-violet-400' :
                  tierInfo.tier === 2 ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'
                )}
              >
                {statusMessage}
              </span>
              {monthsOfCoverage > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full border border-white/5 bg-white/5 text-white/60 font-bold">
                  {monthsOfCoverage.toFixed(1)} meses de reserva
                </span>
              )}
            </div>
            
            <div className="flex items-baseline gap-2">
              <span 
                data-testid="survival-ceiling-value"
                className={cn("text-3xl md:text-4xl font-bold tracking-tight", statusColor)}
              >
                {formattedTeto}
              </span>
              <span className="text-sm font-medium text-white/30 lowercase">/ {viewMode.toLowerCase()}</span>
            </div>
            
            {/* Net Worth Insight & Gamification Stats */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Liquidez Real:</span>
                <span className={cn(
                  "text-[10px] font-black tabular-nums",
                  netLiquidityCents >= 0 ? "text-emerald-500/60" : "text-red-500/60"
                )}>
                  {(netLiquidityCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              
              {isSurvivalMode && (
                <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-tighter">Ciclo de Dívida</span>
                </div>
              )}

              {/* Gamification Stats Display */}
              <div className="flex items-center gap-3 border-l border-white/10 pl-3">
                <div className="flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-0.5 rounded-md">
                  <Shield className="w-3 h-3 text-violet-400" />
                  <span className="text-[9px] font-bold text-violet-400 tabular-nums">
                    {profile?.resilience_points || 0} RP
                  </span>
                </div>
                {profile?.current_streak !== undefined && profile.current_streak > 0 && (
                  <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span className="text-[9px] font-black text-amber-400 tabular-nums">
                      {profile.current_streak} meses
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Salvation Goal for "Break the Cycle" */}
        {isSurvivalMode && (
          <div className="hidden lg:flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[200px]">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Meta de Salvação
            </span>
            <span 
              data-testid="salvation-goal-value"
              className="text-xl font-black text-amber-400 tabular-nums"
            >
              {((Math.abs(netLiquidityCents)) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            <p className="text-[8px] text-white/40 mt-1 text-center font-medium leading-tight">
              Quanto você precisa para pagar <br/> tudo e ter R$ 0,00 real.
            </p>
          </div>
        )}

        {/* Right Side: Toggles */}
        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
          {/* Toggles */}
          <div className="flex p-1 bg-black/40 border border-white/5 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setViewMode("DAY")}
              data-testid="survival-view-mode-day"
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2",
                viewMode === "DAY" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              <Calendar className="w-3.5 h-3.5" /> Dia
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              data-testid="survival-view-mode-week"
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2",
                viewMode === "WEEK" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Sem
            </button>
            <button
              onClick={() => setViewMode("MONTH")}
              data-testid="survival-view-mode-month"
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2",
                viewMode === "MONTH" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              <Wallet className="w-3.5 h-3.5" /> Mês
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
