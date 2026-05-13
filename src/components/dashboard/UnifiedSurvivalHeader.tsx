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
      "relative bg-[#0d0d0d] border border-white/5 overflow-hidden group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-500",
      variant === 'full' ? "rounded-[48px] p-6 md:p-8" : "rounded-[24px] p-4 mb-6"
    )}>
      {/* Premium Background Effects */}
      <div className={cn(
        "absolute -top-32 -left-32 w-[600px] h-[600px] blur-[160px] rounded-full transition-all duration-1000 opacity-20",
        isCrisisMode ? "bg-red-600" : isRecoveryMode ? "bg-amber-600" : "bg-violet-600"
      )} />

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.02] blur-[100px] rounded-full -mr-32 -mt-32" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* [Bloco Superior] - Sempre Visível */}
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
                  {variant === 'full' ? `Time Machine: ${format(targetDate, "MMMM", { locale: ptBR })}` : "Visão Consolidada"}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex flex-col">
                  <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Saldo Real</p>
                  <p className="text-xs font-black text-emerald-400/80 tabular-nums">{formatCurrency(accumulatedBalanceCents)}</p>
                </div>
                {variant === 'compact' && (
                  <>
                    <div className="w-px h-6 bg-white/5" />
                    <div className="flex flex-col">
                      <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Sobra Livre</p>
                      <p 
                        data-testid="net-liquidity-value"
                        className={cn(
                          "text-xs font-black tabular-nums",
                          isCrisisMode ? "text-red-400" : "text-white"
                        )}
                      >
                        {formatCurrency(netLiquidityCents)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isFuture && (
              <button 
                onClick={openAdd}
                data-testid="add-transaction-button"
                className="group relative flex items-center gap-2.5 bg-white text-black hover:bg-violet-50 px-4 py-2 rounded-[14px] font-black text-[9px] transition-all active:scale-95 shadow-2xl overflow-hidden shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
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

        {variant === 'full' && (
          <>
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
                    
                    <div className="flex flex-wrap items-center gap-4 mt-4">
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
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border mt-1",
                          isCrisisMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        )}>
                          {isCrisisMode ? "Crítico" : "Equilibrado"}
                        </div>
                      </div>
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
                        {isCrisisMode 
                          ? formatCurrency(Math.abs(monthlyOutlook.balanceAtMonthEnd)) 
                          : formatCurrency(weeklyLimit)
                        }
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
          </>
        )}
      </div>
    </div>
  );
}
