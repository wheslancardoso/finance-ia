"use client";

import React from "react";
import { Wallet, Plus, ShieldCheck, Zap, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { Simulation } from "@/domain/financial/financial-logic";

interface UnifiedSurvivalHeaderProps {
  monthOffset: number;
  targetDate: Date;
  activeSimulations?: Simulation[];
  onJumpToDebtExit?: () => void;
  debtExitDate?: Date | null;
}

export function UnifiedSurvivalHeader({
  monthOffset,
  targetDate,
  activeSimulations = [],
  onJumpToDebtExit,
  debtExitDate
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
    <div className="relative bg-[#0d0d0d] border border-white/5 rounded-[48px] p-6 md:p-8 overflow-hidden group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
      {/* Premium Background Effects */}
      <div className={cn(
        "absolute -top-32 -left-32 w-[600px] h-[600px] blur-[160px] rounded-full transition-all duration-1000 opacity-20",
        isCrisisMode ? "bg-red-600" : isRecoveryMode ? "bg-amber-600" : "bg-violet-600"
      )} />

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.02] blur-[100px] rounded-full -mr-32 -mt-32" />

      <div className="relative z-10 flex flex-col gap-6">
        {/* [Bloco Superior] */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-[18px] flex items-center justify-center border transition-all duration-700 shadow-2xl",
              isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-white/60"
            )}>
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] truncate">
                  Time Machine: {format(targetDate, "MMMM", { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] font-bold text-white/60 truncate uppercase tracking-widest">Fluxo de Caixa Projetado</p>
              </div>
            </div>
          </div>

          {!isFuture ? (
            <button 
              onClick={openAdd}
              className="group relative flex items-center gap-2.5 bg-white text-black hover:bg-violet-50 px-5 py-2.5 rounded-[16px] font-black text-[9px] transition-all active:scale-95 shadow-2xl overflow-hidden shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="tracking-widest uppercase">Nova Transação</span>
            </button>
          ) : (
             debtExitDate && startOfMonth(debtExitDate) > startOfMonth(new Date()) && (
              <button 
                onClick={onJumpToDebtExit}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all shrink-0"
              >
                <Zap className="w-3 h-3 fill-current" />
                Fim das Dívidas
              </button>
             )
          )}
        </div>

        {/* [Bloco Valor Principal] */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${monthOffset}-${activeSimulations.length}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              <div className="space-y-1">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-[0.4em] block",
                  isCrisisMode ? "text-red-400/60" : isRecoveryMode ? "text-amber-400/60" : "text-white/30"
                )}>
                  {isCrisisMode ? "Alerta de Crise" : isRecoveryMode ? "Liquidez Zero em" : "Patrimônio Líquido"}
                </span>
                <h1 
                  data-testid="net-liquidity-value"
                  className={cn(
                    "text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter tabular-nums leading-none drop-shadow-2xl",
                    isCrisisMode ? "text-red-400" : isRecoveryMode ? "text-white" : hasSimulations ? "text-violet-400" : isFuture ? "text-white/90" : "text-white"
                  )}
                >
                  {isCrisisMode 
                    ? "Ajuste Necessário" 
                    : isRecoveryMode 
                      ? (debtExit.exitDate ? format(debtExit.exitDate, "MMM'/'yy", { locale: ptBR }) : "---")
                      : formatCurrency(netLiquidityCents)
                  }
                </h1>
                
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {isRecoveryMode && (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Modo de Recuperação Ativo
                    </div>
                  )}
                  {hasSimulations && (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[9px] font-black uppercase tracking-widest">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      Impacto Simulado Ativo
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* [Bloco Teto Semanal] */}
        <div className="w-full">
           <div className={cn(
             "min-h-[70px] bg-white/[0.03] border border-white/5 rounded-[24px] p-5 flex items-center justify-between gap-6 relative overflow-hidden shadow-inner",
             isCrisisMode && "border-red-500/20"
           )}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] rounded-full" />
              
              <div className="flex items-center gap-4 shrink-0">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center border",
                  isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                )}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-0.5">
                    {isCrisisMode ? "Alerta: Ciclo de Dívida" : "Oxigênio Semanal"}
                  </span>
                  <span 
                    data-testid="survival-ceiling-value"
                    className={cn(
                      "text-2xl font-black tabular-nums tracking-tight leading-none",
                      isCrisisMode ? "text-red-400" : "text-emerald-400"
                    )}
                  >
                    {formatCurrency(weeklyLimit)}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 max-w-xs">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(5, (weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100))}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      isCrisisMode ? "bg-red-500" : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                    )} 
                  />
                </div>
                <div className="flex justify-between items-center text-[8px] font-black text-white/20 uppercase tracking-widest">
                  <span>Uso da Semana</span>
                  <span className={cn(isCrisisMode ? "text-red-400" : "text-white/60")}>
                    {Math.round((weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100)}%
                  </span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
