
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
}

export function DashboardHeader({ isFuture, targetDate, projectedBalance, balanceDifference, netLiquidityCents }: DashboardHeaderProps) {
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
        <div className="flex items-center justify-between">
          <motion.h1 
            key={projectedBalance}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "text-6xl md:text-7xl font-black tracking-tighter tabular-nums",
              isFuture ? "text-violet-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]" : "text-white"
            )}
          >
            {formatCurrency(projectedBalance)}
          </motion.h1>

          {!isFuture && netLiquidityCents !== undefined && (
            <div className={cn(
              "mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase w-fit",
              netLiquidityCents >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              Liquidez Real: {formatCurrency(netLiquidityCents)}
            </div>
          )}

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
