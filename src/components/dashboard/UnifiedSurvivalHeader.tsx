"use client";

import React from "react";
import { Wallet, Plus, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { Simulation } from "@/domain/financial/financial-logic";

interface UnifiedSurvivalHeaderProps {
  monthOffset?: number;
  targetDate?: Date;
  activeSimulations?: Simulation[];
  onJumpToDebtExit?: () => void;
  debtExitDate?: Date | null;
  variant?: 'full' | 'compact';
}

export function UnifiedSurvivalHeader({
  monthOffset = 0,
  targetDate = new Date(),
  activeSimulations = [],
  onJumpToDebtExit,
  debtExitDate,
  variant = 'full'
}: UnifiedSurvivalHeaderProps) {
  const { openAdd } = useTransactionModal();
  const {
    netLiquidityCents,
    accumulatedBalanceCents,
    totalConsolidatedDebtCents,
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
    <div className={cn(
      "relative bg-[#0d0d0d] border border-white/5 group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden sm:overflow-visible",
      variant === 'full' ? "rounded-[32px] md:rounded-[48px] p-5 md:p-10" : "rounded-[24px] p-4 mb-4"
    )}>
      {/* Premium Background Effects */}
      <div className={cn(
        "absolute -top-32 -left-32 w-[600px] h-[600px] blur-[160px] rounded-full transition-all duration-1000 opacity-20 pointer-events-none",
        isCrisisMode ? "bg-red-600" : isRecoveryMode ? "bg-amber-600" : "bg-violet-600"
      )} />

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.02] blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />

      <div className={cn("relative z-10 flex flex-col", variant === 'full' ? "gap-4 md:gap-8" : "gap-3")}>
        {/* [Bloco Superior] - Sempre Visível */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className={cn(
              "w-12 h-12 rounded-[20px] flex items-center justify-center border transition-all duration-700 shadow-2xl shrink-0",
              isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-white/60"
            )}>
              <Wallet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] truncate">
                  {variant === 'full' ? `Time Machine: ${format(targetDate, "MMMM", { locale: ptBR })}` : "Visão Consolidada"}
                </p>
              </div>
              <p className="text-xs font-bold text-white/20 mt-0.5">
                {variant === 'full' ? "Projeção acumulada de liquidez" : "Saldo disponível para o ciclo"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 hidden md:flex">
            {!isFuture && (
              <button 
                onClick={openAdd}
                data-testid="add-transaction-button"
                className="group relative flex items-center gap-2.5 bg-white text-black hover:bg-violet-50 px-5 py-2.5 rounded-[16px] font-black text-[10px] transition-all active:scale-95 shadow-2xl overflow-hidden shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="tracking-widest uppercase hidden sm:inline">Nova Transação</span>
              </button>
            )}
            
            {variant === 'compact' && isCrisisMode && (
              <div className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">Alerta de Crise</p>
              </div>
            )}
          </div>
        </div>

        {/* [Bloco Valores Compactos] - Visível apenas em compact */}
        {variant === 'compact' && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Liquidez do Ciclo</span>
              <h2 
                data-testid="net-liquidity-value"
                className={cn(
                  "text-2xl font-black tabular-nums tracking-tight",
                  isCrisisMode ? "text-red-400" : "text-white"
                )}
              >
                {isCrisisMode ? "Ajuste Necessário" : formatCurrency(netLiquidityCents)}
              </h2>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Saldo Real</span>
              <span className="text-sm font-black text-emerald-400 tabular-nums">{formatCurrency(accumulatedBalanceCents)}</span>
            </div>
          </div>
        )}

        {variant === 'full' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-10 items-end">
            {/* [Bloco Valor Principal] */}
            <div className="xl:col-span-8 w-full overflow-hidden sm:overflow-visible">
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.4em] block",
                    isCrisisMode ? "text-red-400/60" : isRecoveryMode ? "text-amber-400/60" : "text-white/30"
                  )}>
                    {isCrisisMode ? "Alerta de Crise" : isRecoveryMode ? "Liquidez Zero em" : "Liquidez ao Fim do Mês"}
                    {hasSimulations && (
                      <span className="ml-2 text-[8px] font-black bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full vertical-middle uppercase tracking-widest">
                        Impacto Simulado Ativo
                      </span>
                    )}
                  </span>
                  <h1 
                    data-testid="net-liquidity-value"
                    className={cn(
                      "text-[clamp(2rem,6vw,4.5rem)] py-2 font-black tracking-tighter tabular-nums leading-none drop-shadow-2xl sm:whitespace-normal",
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
                  
                  <div className="flex flex-wrap items-center gap-6 mt-6">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Saldo Bancário Real</span>
                      <span className="text-sm font-black text-emerald-400 tabular-nums">{formatCurrency(accumulatedBalanceCents)}</span>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Dívida Total</span>
                      <span className="text-sm font-black text-red-400/80 tabular-nums">{formatCurrency(totalConsolidatedDebtCents)}</span>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Status do Mês</span>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border mt-1.5",
                        isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      )}>
                        {isCrisisMode ? "Crítico" : "Equilibrado"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* [Bloco Teto Semanal] */}
            <div className="xl:col-span-4 w-full">
               <div className={cn(
                 "bg-white/[0.03] border border-white/5 rounded-[32px] p-7 space-y-6 relative overflow-hidden shadow-inner backdrop-blur-xl",
                 isCrisisMode && "border-red-500/20"
               )}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] rounded-full pointer-events-none" />
                  
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={cn(
                      "w-10 h-10 rounded-[14px] flex items-center justify-center border shrink-0",
                      isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1 truncate">
                        {isCrisisMode ? "Alerta: Ciclo de Dívida" : "Oxigênio Semanal"}
                      </span>
                      <span 
                        data-testid="survival-ceiling-value"
                        className={cn(
                          "text-3xl font-black tabular-nums tracking-tight leading-none block",
                          isCrisisMode ? "text-red-400" : "text-emerald-400"
                        )}
                      >
                        {isCrisisMode 
                          ? formatCurrency(Math.abs(monthlyOutlook.balanceAtMonthEnd)) 
                          : formatCurrency(weeklyLimit)
                        }
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(5, (weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100))}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          isCrisisMode ? "bg-red-500" : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                        )} 
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black text-white/20 uppercase tracking-widest">
                      <span>Uso da Semana</span>
                      <span className={cn(isCrisisMode ? "text-red-400" : "text-white/60")}>
                        {Math.round((weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100)}%
                      </span>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
