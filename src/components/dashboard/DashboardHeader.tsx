
"use client";

import React from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactionModal } from "@/context/TransactionModalContext";

interface DashboardHeaderProps {
  isFuture: boolean;
  targetDate: Date;
  projectedBalance: number;
  balanceDifference: number;
  netLiquidityCents?: number;
  debtExitDate?: Date | null;
}

export function DashboardHeader({ 
  isFuture, 
  targetDate, 
  projectedBalance, 
  balanceDifference, 
  netLiquidityCents,
  debtExitDate
}: DashboardHeaderProps) {
  const { openAdd } = useTransactionModal();

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/40 font-bold text-xs uppercase tracking-[0.2em]">
            <Wallet className="w-4 h-4" />
            {isFuture ? `Projeção para ${format(targetDate, "MMMM", { locale: ptBR })}` : "Liquidez Atual"}
          </div>
          
          {!isFuture && (
            <button 
              onClick={openAdd}
              className="md:hidden flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all border border-white/10"
              data-testid="add-transaction-mobile-button"
            >
              <Plus className="w-3 h-3" />
              Novo
            </button>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4">
          <div className="flex flex-col">
            {netLiquidityCents !== undefined && netLiquidityCents < -100 && !isFuture ? (
              <div className="space-y-1">
                <div className="flex items-center gap-4 mb-1">
                  <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                    Modo de Recuperação
                  </span>
                  <span className="text-sm font-black text-white/60 tabular-nums">
                    Saldo: {formatCurrency(projectedBalance)}
                  </span>
                </div>
                <motion.h1 
                  data-testid="dashboard-header-value"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-4xl md:text-6xl font-black tracking-tighter text-white"
                >
                  {debtExitDate 
                    ? format(debtExitDate, "MMMM 'de' yyyy", { locale: ptBR }) 
                    : (projectedBalance > 0 ? "Ajuste sua renda" : "Sobra insuficiente")}
                </motion.h1>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  {debtExitDate ? "Data Projetada para Quitação Total (Mês Zero)" : "Não é possível projetar a saída das dívidas"}
                </p>
              </div>
            ) : (
              <motion.h1 
                key={projectedBalance}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="net-liquidity-value"
                className={cn(
                  "text-5xl md:text-7xl font-black tracking-tighter tabular-nums",
                  isFuture ? "text-violet-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]" : "text-white"
                )}
              >
                {formatCurrency(projectedBalance)}
              </motion.h1>
            )}
          </div>

          {!isFuture && netLiquidityCents !== undefined && (
            <div className="flex flex-col items-start md:items-end gap-2">
              <div 
                data-testid="real-liquidity-badge"
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase w-fit",
                  netLiquidityCents >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                )}
              >
                Liquidez Real: {formatCurrency(netLiquidityCents)}
              </div>
              
              {netLiquidityCents < 0 && (
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                  Saldo Atual: {formatCurrency(projectedBalance)}
                </div>
              )}
            </div>
          )}
        </div>

        {!isFuture && (
          <button 
            onClick={openAdd}
            className="hidden md:flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-semibold transition-all shadow-lg shadow-violet-600/20 active:scale-95"
            data-testid="add-transaction-button"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </button>
        )}
      </div>

      {isFuture && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-sm",
            balanceDifference >= 0 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          )}
        >
          {balanceDifference >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {formatCurrency(Math.abs(balanceDifference))}
        </motion.div>
      )}
    </div>
  );
}
