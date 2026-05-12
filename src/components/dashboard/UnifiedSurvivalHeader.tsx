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

  // Lógica do Teto de Sobrevivência (Unificada do HUD)
  const survivalCeilingCents = Math.max(0, monthlyOutlook.balanceAtMonthEnd);
  const weeklyLimit = survivalCeilingCents / 4;

  return (
    <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-12 overflow-hidden group">
      {/* Background dynamic glow */}
      <div className={cn(
        "absolute -top-24 -left-24 w-96 h-96 blur-[120px] rounded-full transition-colors duration-1000",
        isCrisisMode ? "bg-red-600/20" : isRecoveryMode ? "bg-amber-600/15" : "bg-emerald-600/10"
      )} />

      <div className="relative z-10 flex flex-col gap-10">
        {/* Top Row: Context & Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
              isCrisisMode ? "bg-red-500/20 border-red-500/20 text-red-400" : "bg-white/10 border-white/10 text-white/40"
            )}>
              {isCrisisMode ? <Zap className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                {isFuture ? `Projeção ${format(targetDate, "MMMM", { locale: ptBR })}` : "Status Financeiro Atual"}
              </p>
              {isRecoveryMode && !isFuture && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                    Modo de Recuperação Ativo
                  </span>
                </div>
              )}
            </div>
          </div>

          {!isFuture && (
            <button 
              onClick={openAdd}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-violet-600/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Transação</span>
              <span className="sm:hidden">Novo</span>
            </button>
          )}
        </div>

        {/* Main Value Row - Refatorada para Grid de 12 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={monthOffset}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-1"
              >
                {isRecoveryMode && !isFuture ? (
                  <>
                    <h1 
                      data-testid="net-liquidity-value"
                      className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white"
                    >
                      {debtExit.exitDate 
                        ? format(debtExit.exitDate, "MMMM 'de' yyyy", { locale: ptBR }) 
                        : "Ajuste Necessário"}
                    </h1>
                    <p className="text-sm font-bold text-white/40 uppercase tracking-widest">
                      {debtExit.exitDate ? "Alvo para Quitação Total (Mês Zero)" : "Sobra insuficiente para projetar saída"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      {activeSimulations.length > 0 && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                            Impacto Simulado Ativo
                          </span>
                        </div>
                      )}
                      <h1 
                        data-testid="net-liquidity-value"
                        className={cn(
                          "text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter tabular-nums transition-all duration-700 leading-none",
                          activeSimulations.length > 0 ? "text-violet-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.4)]" : 
                          isFuture ? "text-violet-400/80" : "text-white"
                        )}
                      >
                        {formatCurrency(netLiquidityCents)}
                      </h1>
                    </div>
                    <p className="text-sm font-bold text-white/40 uppercase tracking-widest mt-2">
                      {isFuture ? "Liquidez Projetada no Fim do Mês" : "Saldo Projetado (Final do Mês)"}
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Secondary Stats Row - Mais espaço garantido */}
          <div className="lg:col-span-5 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-3 min-w-0 h-full">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-1">
                    {isRecoveryMode ? "Teto Semanal (Oxigênio)" : "Sobra p/ Investir (Semana)"}
                  </span>
                  <span 
                    data-testid="survival-ceiling-value"
                    className={cn(
                      "text-2xl font-black tabular-nums block",
                      isCrisisMode ? "text-red-400" : isRecoveryMode ? "text-amber-400" : "text-emerald-400"
                    )}
                  >
                    {formatCurrency(weeklyLimit)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isCrisisMode ? "bg-red-500" : "bg-emerald-500"
                      )} 
                      style={{ width: `${Math.min(100, Math.max(5, (weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100))}%` }} 
                    />
                  </div>
                  <span className="text-[9px] font-bold text-white/20 uppercase tabular-nums">
                    {Math.round((weeklySurvival.weeklySpentCents / (weeklyLimit || 1)) * 100)}%
                  </span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-3 min-w-0 h-full">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-1">
                    Patrimônio Líquido Real
                  </span>
                  <span 
                    data-testid="real-liquidity-value"
                    className={cn(
                      "text-2xl font-black tabular-nums block",
                      netLiquidityCents >= 0 ? "text-white" : "text-red-400"
                    )}
                  >
                    {formatCurrency(netLiquidityCents)}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-tighter leading-tight">
                  {netLiquidityCents < 0 ? "Saldo - Dívida Consolidada" : "Saldo Total Disponível"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Alert/Insight Bar */}
        {isRecoveryMode && (
          <div className={cn(
            "flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all",
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
