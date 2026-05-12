"use client";

import React from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, ArrowDownRight, Calculator, PieChart, Briefcase, Zap, CreditCard, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthlyConsolidatedExcelProps {
  income: number;
  expenses: number;
  balance: number;
  items: Array<{
    name: string;
    value: number;
    type: "INCOME" | "EXPENSE";
    category?: string;
    isInstallment?: boolean;
    isBudget?: boolean;
    isGoal?: boolean;
  }>;
  monthName: string;
}

export function MonthlyConsolidatedExcel({ 
  income, 
  expenses, 
  balance, 
  items,
  monthName
}: MonthlyConsolidatedExcelProps) {
  return (
    <div className="space-y-6">
      {/* Mini Header de Totais Estilo Planilha */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-3 h-3 text-emerald-400/60" />
            <span className="text-[9px] font-black text-emerald-400/40 uppercase tracking-widest">Recebido</span>
          </div>
          <p className="text-lg font-black text-emerald-400 tabular-nums">
            {formatCurrency(income)}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight className="w-3 h-3 text-white/20" />
            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Gasto</span>
          </div>
          <p className="text-lg font-black text-white/90 tabular-nums">
            {formatCurrency(expenses)}
          </p>
        </div>
      </div>

      {/* Lista de Itens (O "Excel") */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-t-xl border-x border-t border-white/10">
          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Descrição</span>
          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Valor</span>
        </div>
        
        <div className="border border-white/10 bg-white/[0.02] rounded-b-xl divide-y divide-white/5 overflow-hidden">
          {items.map((item, idx) => (
            <motion.div 
              key={`${item.name}-${idx}`}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center justify-between px-4 py-3 group hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  item.type === "INCOME" ? "bg-emerald-400" : 
                  item.isInstallment ? "bg-violet-400" :
                  item.isGoal ? "bg-amber-400" : "bg-white/20"
                )} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">
                    {item.name}
                  </span>
                  {item.category && (
                    <span className="text-[8px] font-medium text-white/20 uppercase tracking-tighter">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn(
                "text-xs font-black tabular-nums",
                item.type === "INCOME" ? "text-emerald-400" : "text-white/80"
              )}>
                {item.type === "INCOME" ? "+" : "-"} {formatCurrency(item.value)}
              </span>
            </motion.div>
          ))}

          {items.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Nenhum dado consolidado</p>
            </div>
          )}
        </div>
      </div>

      {/* Saldo Final (Destaque Excel) */}
      <div className={cn(
        "p-6 rounded-[2.5rem] border flex flex-col gap-6 transition-all duration-500",
        balance >= 0 
          ? "bg-emerald-500/10 border-emerald-500/20 shadow-lg shadow-emerald-500/5" 
          : "bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/5"
      )}>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30">
            <span>Salário Recebido</span>
            <span className="text-emerald-400">{formatCurrency(income)}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30">
            <span>Total Gasto</span>
            <span className="text-white/60">{formatCurrency(expenses)}</span>
          </div>
          <div className="h-px bg-white/5 w-full" />
          <div className="flex justify-between items-end pt-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Saldo Atual</span>
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-tighter">{monthName}</span>
            </div>
            <span className={cn(
              "text-3xl font-black tabular-nums tracking-tighter",
              balance >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Dica Contextual */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/2 rounded-2xl border border-white/5">
        <PieChart className="w-3.5 h-3.5 text-white/20" />
        <p className="text-[9px] font-bold text-white/40 leading-relaxed italic">
          Este resumo consolida receitas, gastos fixos, parcelamentos ativos e provisões de orçamento para {monthName}.
        </p>
      </div>
    </div>
  );
}
