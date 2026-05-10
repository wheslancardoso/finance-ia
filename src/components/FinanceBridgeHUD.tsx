
"use client";

import React from "react";
import { ShieldCheck, AlertCircle, AlertTriangle, Zap } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { motion } from "framer-motion";
import Link from "next/link";

/**
 * FinanceBridgeHUD: Um componente compacto para ser usado no topo de todas as páginas.
 * Garante que o usuário sempre tenha consciência do seu estado financeiro real.
 */
export function FinanceBridgeHUD() {
  const { netLiquidityCents, healthScore, monthlyOutlook, isSurvivalMode } = useFinancialAnalysis();

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-black/40 backdrop-blur-md border-b border-white/5 py-3 px-6 sticky top-0 z-[40]"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Lado Esquerdo: Saúde e Status */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all",
              (healthScore > 70 && !isSurvivalMode) ? "bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30" : 
              (healthScore > 40 && !isSurvivalMode) ? "bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30" : 
              "bg-red-500/20 text-red-400 group-hover:bg-red-500/30"
            )}>
              {healthScore}
            </div>
            <div className="hidden sm:block">
              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Status do Sistema</p>
              <p className={cn(
                "text-[11px] font-bold leading-none",
                (healthScore > 70 && !isSurvivalMode) ? "text-emerald-400" : 
                (healthScore > 40 && !isSurvivalMode) ? "text-amber-400" : "text-red-400"
              )}>
                {isSurvivalMode ? "RECUPERAÇÃO CRÍTICA" : (healthScore > 70 ? "ESTÁVEL / SEGURO" : "ATENÇÃO")}
              </p>
            </div>
          </Link>

          <div className="h-6 w-px bg-white/5 mx-2 hidden md:block" />

          {/* Liquidez Real */}
          <div className="hidden md:block">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Liquidez Real</p>
            <p className={cn(
              "text-[11px] font-bold leading-none tabular-nums",
              netLiquidityCents >= 0 ? "text-white" : "text-red-400"
            )}>
              {formatCurrency(netLiquidityCents)}
            </p>
          </div>
        </div>

        {/* Lado Direito: Sobra do Mês */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none mb-1 text-right">
              {isSurvivalMode ? "Sobra Comprometida" : "Sobra Livre (Mês)"}
            </p>
            <p className={cn(
              "text-sm font-black leading-none tabular-nums",
              monthlyOutlook.isHealthy ? "text-emerald-400" : 
              monthlyOutlook.isRecovering ? "text-amber-400" : "text-red-400"
            )}>
              {formatCurrency(monthlyOutlook.balanceAtMonthEnd)}
            </p>
          </div>

          <Link 
            href="/transactions" 
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
          >
            <Zap className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] font-bold text-white/60">Ações Rápidas</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
