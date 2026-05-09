"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Calendar, Zap, Clock } from "lucide-react";
import { format, addMonths, subMonths, isSameMonth, startOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  lastFutureTransactionDate?: string | null;
}

export function MonthNavigator({ selectedDate, onDateChange, lastFutureTransactionDate }: MonthNavigatorProps) {
  const today = startOfMonth(new Date());
  const isFuture = !isSameMonth(selectedDate, today);
  
  const handlePrev = () => {
    const prev = subMonths(selectedDate, 1);
    if (prev >= today) {
      onDateChange(prev);
    }
  };

  const handleNext = () => {
    onDateChange(addMonths(selectedDate, 1));
  };

  const handleReset = () => {
    onDateChange(today);
  };

  const handleLastDebt = () => {
    if (lastFutureTransactionDate) {
      onDateChange(startOfMonth(new Date(lastFutureTransactionDate)));
    }
  };

  const isAtToday = isSameMonth(selectedDate, today);

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group">
      {/* Background Glow */}
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full transition-colors duration-500",
        isFuture ? "bg-violet-600/20" : "bg-emerald-600/10"
      )} />

      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
              isFuture ? "bg-violet-500/10 border-violet-500/20 text-violet-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            )}>
              {isFuture ? <Zap className="w-5 h-5 animate-pulse" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                {isFuture ? "Visão de Futuro" : "Estado Atual"}
              </h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
                Projeção Baseada em Padrões
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-1 rounded-2xl">
             <button 
              onClick={handlePrev}
              disabled={isAtToday}
              className={cn(
                "p-2 rounded-xl transition-all",
                isAtToday ? "text-white/10 cursor-not-allowed" : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="min-w-[140px] text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedDate.toISOString()}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <p className={cn(
                    "text-lg font-bold capitalize transition-colors duration-500",
                    isFuture ? "text-violet-400" : "text-emerald-400"
                  )}>
                    {format(selectedDate, "MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    {format(selectedDate, "yyyy")}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <button 
              onClick={handleNext}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isAtToday && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5 transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              Voltar para Hoje
            </button>
          )}

          {lastFutureTransactionDate && (
            <button
              onClick={handleLastDebt}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                isSameMonth(selectedDate, new Date(lastFutureTransactionDate))
                  ? "bg-amber-500 text-black" 
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fim das Dívidas ({format(new Date(lastFutureTransactionDate), "MMM/yy", { locale: ptBR })})
            </button>
          )}
          
          <button
            onClick={() => onDateChange(addMonths(today, 6))}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              isSameMonth(selectedDate, addMonths(today, 6))
                ? "bg-violet-600 text-white" 
                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            +6 Meses
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isFuture && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-2xl flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
              <p className="text-[11px] text-violet-400/80 font-medium leading-tight">
                Projetando receitas, despesas fixas e orçamentos mensais até o fim de <strong>{format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}</strong>.
                {lastFutureTransactionDate && isSameMonth(selectedDate, new Date(lastFutureTransactionDate)) && " Este é o mês em que seus parcelamentos atuais terminam!"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
