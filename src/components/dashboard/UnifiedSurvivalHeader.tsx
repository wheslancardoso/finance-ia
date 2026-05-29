"use client";

import React from "react";
import { Wallet, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useFinancialData } from "@/context/FinancialDataContext";
import { Simulation } from "@/domain/financial/financial-logic";

interface UnifiedSurvivalHeaderProps {
  monthOffset?: number;
  targetDate?: Date;
  activeSimulations?: Simulation[];
  onJumpToDebtExit?: () => void;
  debtExitDate?: Date | null;
  variant?: 'full' | 'compact';
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
}

export function UnifiedSurvivalHeader({
  monthOffset = 0,
  targetDate = new Date(),
  activeSimulations = [],
  onJumpToDebtExit,
  debtExitDate,
  variant = 'full',
  isCopilotOpen = false,
  onToggleCopilot
}: UnifiedSurvivalHeaderProps) {
  const { openAdd } = useTransactionModal();
  const { accounts, recurringExpensesCents: contextRecurringExpenses } = useFinancialData();
  const {
    accumulatedBalanceCents,
    creditCardUsedCents,
    weeklySurvival,
    recurringExpensesCents,
    monthlyOutlook
  } = useFinancialAnalysis(monthOffset, activeSimulations);

  const isFuture = monthOffset > 0;
  const hasSimulations = activeSimulations.length > 0;
  
  // Sempre exibimos o somatório do saldo das contas correntes (presente ou projetado futuro)
  const displayBalanceCents = accumulatedBalanceCents;
  const isNegativeBalance = displayBalanceCents < 0;

  // Limite semanal vindo da inteligência do domínio
  const weeklyLimit = weeklySurvival.weeklyLimitCents;

  // Listar contas correntes para exibição detalhada
  const checkingAccounts = accounts.filter(a => a.type !== "CREDIT_CARD");

  // Total de contas fixas a pagar no mês — projetado para meses futuros
  const fixedExpensesTotal = (isFuture || hasSimulations)
    ? (monthlyOutlook.scheduledOnly + monthlyOutlook.immediateCardDebt)
    : (recurringExpensesCents > 0 ? recurringExpensesCents : contextRecurringExpenses);

  return (
    <div className={cn(
      "relative bg-[#0d0d0d] border border-white/5 group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden sm:overflow-visible",
      variant === 'full' ? "rounded-[32px] md:rounded-[48px] p-5 md:p-10" : "rounded-[24px] p-4 mb-4"
    )}>
      {/* Premium Background Effects */}
      <div className={cn(
        "absolute -top-32 -left-32 w-[600px] h-[600px] blur-[160px] rounded-full transition-all duration-1000 opacity-20 pointer-events-none",
        isNegativeBalance ? "bg-red-600" : "bg-violet-600"
      )} />

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.02] blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />

      <div className={cn("relative z-10 flex flex-col", variant === 'full' ? "gap-4 md:gap-8" : "gap-3")}>
        {/* [Bloco Superior] - Sempre Visível */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className={cn(
              "w-12 h-12 rounded-[20px] flex items-center justify-center border transition-all duration-700 shadow-2xl shrink-0",
              isNegativeBalance ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-white/60"
            )}>
              <Wallet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p suppressHydrationWarning className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] truncate">
                  {variant === 'full' ? `Time Machine: ${format(targetDate, "MMMM", { locale: ptBR })}` : "Visão Consolidada"}
                </p>
              </div>
              <p className="text-xs font-bold text-white/20 mt-0.5">
                {variant === 'full' ? "Visão financeira do mês" : "Saldo disponível para o ciclo"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleCopilot && (
              <button
                onClick={onToggleCopilot}
                data-testid="toggle-copilot-button"
                className={cn(
                  "relative flex items-center justify-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-[16px] font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border",
                  isCopilotOpen 
                    ? "bg-violet-600 border-violet-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]" 
                    : "bg-white/5 border-white/10 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/20"
                )}
              >
                <Sparkles className={cn("w-4 h-4", isCopilotOpen && "animate-pulse")} />
                <span className="hidden sm:inline">Modo Copiloto</span>
              </button>
            )}

            {!isFuture && (
              <button 
                onClick={() => openAdd()}
                data-testid="add-transaction-button"
                className="group relative flex items-center justify-center gap-2 bg-white text-black hover:bg-violet-50 px-3 py-2 md:px-5 md:py-2.5 rounded-[16px] font-black text-[10px] transition-all active:scale-95 shadow-2xl overflow-hidden shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="tracking-widest uppercase hidden sm:inline">Nova Transação</span>
              </button>
            )}
          </div>
        </div>

        {/* [Bloco Valores Compactos] - Visível apenas em compact */}
        {variant === 'compact' && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">
                {(isFuture || hasSimulations) ? "Saldo Projetado" : "Saldo em Conta"}
              </span>
              <h2 
                data-testid="net-liquidity-value"
                className={cn(
                  "text-2xl font-black tabular-nums tracking-tight",
                  isNegativeBalance ? "text-red-400" : "text-white"
                )}
              >
                {formatCurrency(displayBalanceCents)}
              </h2>
            </div>
            {creditCardUsedCents > 0 && (
              <div className="text-right flex flex-col items-end">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Cartões Usados</span>
                <span className="text-sm font-black text-red-400/80 tabular-nums">{formatCurrency(creditCardUsedCents)}</span>
              </div>
            )}
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
                    isNegativeBalance ? "text-red-400/60" : "text-white/30"
                  )}>
                    {(isFuture || hasSimulations) ? "Saldo Projetado" : "Saldo em Conta"}
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
                      isNegativeBalance ? "text-red-400" : hasSimulations ? "text-violet-400" : isFuture ? "text-white/90" : "text-white"
                    )}
                  >
                    {formatCurrency(displayBalanceCents)}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-6 mt-6">
                    {/* Contas a pagar (despesas fixas do mês) */}
                    {fixedExpensesTotal > 0 && (
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Contas a Pagar</span>
                        <span className="text-sm font-black text-amber-400/80 tabular-nums">{formatCurrency(fixedExpensesTotal)}</span>
                      </div>
                    )}
                    
                    {/* Cartões usados */}
                    {creditCardUsedCents > 0 && (
                      <>
                        {fixedExpensesTotal > 0 && <div className="w-px h-8 bg-white/5" />}
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Cartões Usados</span>
                          <span className="text-sm font-black text-red-400/80 tabular-nums">{formatCurrency(creditCardUsedCents)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* [Bloco Teto Semanal] */}
            <div className="xl:col-span-4 w-full">
               <div className={cn(
                 "bg-white/[0.03] border rounded-[32px] p-7 space-y-6 relative overflow-hidden shadow-inner backdrop-blur-xl",
                 "border-white/5"
               )}>
                  <div className="absolute top-0 right-0 w-32 h-32 blur-[40px] rounded-full pointer-events-none bg-emerald-500/5" />
                  
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center border shrink-0 bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1 truncate">
                        Teto Semanal
                      </span>
                      <span 
                        data-testid="survival-ceiling-value"
                        className="text-3xl font-black tabular-nums tracking-tight leading-none block text-emerald-400"
                      >
                        {formatCurrency(weeklyLimit)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(5, weeklyLimit > 0 ? (weeklySurvival.weeklySpentCents / weeklyLimit) * 100 : 0))}%` }}
                        className="h-full rounded-full transition-all duration-1000 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black text-white/20 uppercase tracking-widest">
                      <span>Uso da Semana</span>
                      <span className={cn(
                        weeklySurvival.weeklySpentCents > weeklyLimit 
                          ? "text-red-400 font-black animate-pulse" 
                          : "text-white/60"
                      )}>
                        {weeklyLimit > 0 
                          ? (weeklySurvival.weeklySpentCents > weeklyLimit 
                              ? `Excedido (${Math.round((weeklySurvival.weeklySpentCents / weeklyLimit) * 100)}%)`
                              : `${Math.round((weeklySurvival.weeklySpentCents / weeklyLimit) * 100)}%`)
                          : "0%"
                        }
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
