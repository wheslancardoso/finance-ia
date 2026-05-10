"use client";

import React, { useState } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { Wallet, CalendarDays, Calendar, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { endOfMonth, differenceInDays } from "date-fns";

type ViewMode = "DAY" | "WEEK" | "MONTH";

export default function SurvivalHUD() {
  const { 
    monthlyIncomeCents, 
    recurringIncomeCents,
    setMonthlyIncomeCents
  } = useFinancialData();

  const { 
    netLiquidityCents, 
    monthlyOutlook, 
    isSurvivalMode,
    isCrisisMode
  } = useFinancialAnalysis();

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

  // Determinar Estado Visual
  const totalIncomeForStatus = (monthlyIncomeCents || 0) + (recurringIncomeCents || 0);
  const percentageOfIncome = totalIncomeForStatus > 0 ? (survivalCeilingCents / totalIncomeForStatus) * 100 : 0;
  
  let statusColor = "text-emerald-400";
  let statusGlow = "shadow-[0_0_15px_rgba(16,185,129,0.3)]";
  let bgGradient = "from-emerald-500/10 to-transparent";
  let StatusIcon = ShieldCheck;
  let statusMessage = "Fluxo Estável";

  if (isCrisisMode) {
    statusColor = "text-rose-500";
    statusGlow = "shadow-[0_0_25px_rgba(244,63,94,0.5)]";
    bgGradient = "from-rose-500/20 to-transparent";
    StatusIcon = Zap;
    statusMessage = "MODO CRISE ATIVADO";
  } else if (percentageOfIncome < 15) {
    statusColor = "text-red-400";
    statusGlow = "shadow-[0_0_15px_rgba(239,68,68,0.4)]";
    bgGradient = "from-red-500/10 to-transparent";
    StatusIcon = AlertTriangle;
    statusMessage = "Sobrevivência Crítica";
  } else if (percentageOfIncome < 35) {
    statusColor = "text-amber-400";
    statusGlow = "shadow-[0_0_15px_rgba(245,158,11,0.3)]";
    bgGradient = "from-amber-500/10 to-transparent";
    StatusIcon = AlertTriangle;
    statusMessage = "Atenção ao Orçamento";
  }

  const hasFinancialData = (monthlyIncomeCents || 0) + (recurringIncomeCents || 0) > 0;

  // Se não houver nenhum dado e não estiver em crise, podemos ocultar ou mostrar setup
  // Mas se já houver dados, usamos eles automaticamente.
  if (!hasFinancialData && !isSurvivalMode) {
    return (
      <div className="w-full bg-[#0a0a0a]/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white/80 font-bold mb-1">Configuração de Fluxo</h3>
            <p className="text-sm text-white/40 max-w-sm">
              Configure sua renda mensal para ativar o Teto de Sobrevivência Dinâmico.
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
    <div className={`relative w-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden mb-8 ${statusGlow} transition-all duration-500`}>
      {/* Background Gradient Effect */}
      <div className={`absolute inset-0 bg-gradient-to-b ${bgGradient} opacity-50 pointer-events-none`}></div>
      
      {isCrisisMode && (
        <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />
      )}
      
      <div className="relative p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        
        {/* Left Side: Information */}
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-black/50 border border-white/10 ${statusColor}`}>
            <StatusIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Teto de Sobrevivência</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border bg-black/40 ${percentageOfIncome < 15 ? 'border-red-500/30 text-red-400' : 'border-white/10 text-white/40'}`}>
                {statusMessage}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl md:text-4xl font-bold tracking-tight ${statusColor}`}>
                {formattedTeto}
              </span>
              <span className="text-sm font-medium text-white/30 lowercase">/ {viewMode.toLowerCase()}</span>
            </div>
            
            {/* Net Worth Insight */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Liquidez Real:</span>
              <span className={cn(
                "text-[10px] font-black tabular-nums",
                netLiquidityCents >= 0 ? "text-emerald-500/60" : "text-red-500/60"
              )}>
                {(netLiquidityCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              {isSurvivalMode && (
                <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-tighter">Ciclo de Dívida</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Salvation Goal for "Break the Cycle" */}
        {isSurvivalMode && (
          <div className="hidden lg:flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[200px]">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Meta de Salvação
            </span>
            <span className="text-xl font-black text-amber-400 tabular-nums">
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
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === "DAY" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Dia
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === "WEEK" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Sem
            </button>
            <button
              onClick={() => setViewMode("MONTH")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === "MONTH" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <Wallet className="w-3.5 h-3.5" /> Mês
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
