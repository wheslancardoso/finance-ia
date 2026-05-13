"use client";

import React from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, Plus, ShieldCheck, Zap, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { Simulation } from "@/domain/financial/financial-logic";

interface UnifiedSurvivalHeaderProps {
  monthOffset: number;
  targetDate: Date;
  activeSimulations?: Simulation[];
}

export function UnifiedSurvivalHeader({ 
  monthOffset, 
  targetDate,
  activeSimulations = []
}: UnifiedSurvivalHeaderProps) {
  const { openAdd } = useTransactionModal();
  const { 
    netLiquidityCents, 
    monthlyOutlook, 
    isCrisisMode, 
    debtExit,
    weeklySurvival 
  } = useFinancialAnalysis(monthOffset, activeSimulations);

  const isFuture = monthOffset > 0;
  const isRecoveryMode = netLiquidityCents < -100;
  const hasSimulations = activeSimulations.length > 0;

  // Lógica do Teto de Sobrevivência (Unificada do HUD)
  const survivalCeilingCents = Math.max(0, monthlyOutlook.balanceAtMonthEnd);
  const weeklyLimit = survivalCeilingCents / 4;

  return (
    <div className="relative bg-[#0d0d0d] border border-white/5 rounded-[48px] p-6 md:p-10 overflow-hidden group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
      {/* Premium Background Effects */}
      <div className={cn(
        "absolute -top-32 -left-32 w-[600px] h-[600px] blur-[160px] rounded-full transition-all duration-1000 opacity-20",
        isCrisisMode ? "bg-red-600" : isRecoveryMode ? "bg-amber-600" : "bg-violet-600"
      )} />
      
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.02] blur-[100px] rounded-full -mr-32 -mt-32" />

      <div className="relative z-10 flex flex-col gap-12">
        {/* Top Row: Context & Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-[20px] flex items-center justify-center border transition-all duration-700 shadow-2xl",
              isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-white/60"
            )}>
              {isCrisisMode ? <Zap className="w-6 h-6 animate-pulse" /> : <Wallet className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
                  {isFuture ? `Time Machine: ${format(targetDate, "MMMM", { locale: ptBR })}` : "Patrimônio Líquido Real"}
                </p>
                {hasSimulations && (
                  <span className="flex h-1.5 w-1.5 rounded-full bg-violet-400 animate-ping" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-bold text-white/60">
                  {isFuture ? "Projeção acumulada de liquidez" : "Saldo imediato descontando dívidas"}
                </p>
              </div>
            </div>
          </div>

          {!isFuture && (
            <button 
              onClick={openAdd}
              className="group relative flex items-center gap-3 bg-white text-black hover:bg-violet-50 px-8 py-4 rounded-[22px] font-black text-xs transition-all active:scale-95 shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-200/0 via-violet-200/0 to-violet-200/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline tracking-widest uppercase">Nova Transação</span>
              <span className="sm:hidden">Novo</span>
            </button>
          )}
        </div>

        {/* Main Value Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${monthOffset}-${hasSimulations}`}
                initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                exit={{ opacity: 0, filter: "blur(10px)", y: -20 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-4"
              >
                {isRecoveryMode && !isFuture ? (
                  <div className="space-y-2">
                    <span className="text-sm font-black text-amber-400/60 uppercase tracking-[0.4em] block">
                      Data Alvo para Liquidez Zero
                    </span>
                    <h1 
                      data-testid="net-liquidity-value"
                      className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white drop-shadow-2xl"
                    >
                      {debtExit.exitDate 
                        ? format(debtExit.exitDate, "MMM'/'yy", { locale: ptBR }) 
                        : "---"}
                    </h1>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {hasSimulations && (
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[9px] font-black uppercase tracking-widest"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          Impacto Simulado Ativo
                        </motion.div>
                      )}
                      {isFuture && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[9px] font-black uppercase tracking-widest">
                          Simulação de Fluxo de Caixa
                        </div>
                      )}
                    </div>
                    <h1 
                      data-testid="net-liquidity-value"
                      className={cn(
                        "text-[clamp(2.5rem,8vw,6rem)] font-black tracking-tighter tabular-nums transition-all duration-700 leading-[0.85] drop-shadow-2xl py-2",
                        hasSimulations ? "text-violet-400" : isFuture ? "text-white/90" : "text-white"
                      )}
                    >
                      {formatCurrency(netLiquidityCents)}
                    </h1>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Survival/Oxygen Card - Refactored for Premium look */}
          <div className="lg:col-span-4 w-full">
            <div className="bg-white/[0.03] border border-white/5 rounded-[32px] p-7 md:p-8 space-y-6 relative overflow-hidden shadow-inner">
               <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[40px] rounded-full" />
               
               <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20">
                      Teto Semanal (Oxigênio)
                    </span>
                    <ShieldCheck className={cn("w-4 h-4", isCrisisMode ? "text-red-400" : "text-emerald-400")} />
                  </div>
                  <span 
                    data-testid="survival-ceiling-value"
                    className={cn(
                      "text-3xl font-black tabular-nums block tracking-tight",
                      isCrisisMode ? "text-red-400" : "text-emerald-400"
                    )}
                  >
                    {formatCurrency(weeklyLimit)}
                  </span>
               </div>

               <div className="space-y-3">
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(5, (weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100))}%` }}
                      className={cn(
                        "h-full rounded-full",
                        isCrisisMode ? "bg-red-500" : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                      )} 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">
                      Consumo da Semana
                    </span>
                    <span className="text-[9px] font-black text-white/60 uppercase tabular-nums">
                      {Math.round((weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100)}%
                    </span>
                  </div>
               </div>
            </div>
          </div>
        </div>
        {/* Bottom Alert/Insight Bar */}
        {isRecoveryMode && (
          <div className={cn(
            "flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all mt-8",
            isCrisisMode ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/5 border-amber-500/10"
          )}>
            {isCrisisMode ? <Zap className="w-4 h-4 text-red-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            <div className="flex-1">
              <p className="text-[10px] font-bold text-white/80">
                {isCrisisMode 
                  ? "ATENÇÃO: Você está em ciclo de dívida. Cada centavo deve ser monitorado."
                  : `Seu plano de quitação depende de manter os gastos semanais abaixo de ${formatCurrency(weeklyLimit)}.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

