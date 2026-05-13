"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Sparkles, Calendar, Zap, Clock } from "lucide-react";
import { format, addMonths, subMonths, isSameMonth, startOfMonth } from "date-fns";
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
    if (prev >= today) onDateChange(prev);
  };

  const handleNext = () => onDateChange(addMonths(selectedDate, 1));
  const handleReset = () => onDateChange(today);
  const handleLastDebt = () => {
    if (lastFutureTransactionDate) {
      onDateChange(startOfMonth(new Date(lastFutureTransactionDate)));
    }
  };

  const isAtToday = isSameMonth(selectedDate, today);

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-4 shadow-2xl relative overflow-hidden h-full flex flex-col">
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full transition-colors duration-500",
        isFuture ? "bg-violet-600/20" : "bg-emerald-600/10"
      )} />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between gap-4">
          {/* Esquerda: ícone + label */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0",
              isFuture ? "bg-violet-500/10 border-violet-500/20 text-violet-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            )}>
              {isFuture ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white capitalize truncate">
                {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
              </p>
              <p className="text-[9px] text-white/30 uppercase tracking-widest">
                {isFuture ? "Projeção Futura" : "Estado Atual"}
              </p>
            </div>
          </div>

          {/* Direita: setas de navegação */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/5 p-1 rounded-xl shrink-0">
            <button 
              onClick={handlePrev} 
              disabled={isAtToday} 
              className={cn(
                "p-1.5 rounded-lg transition-all",
                isAtToday ? "text-white/10 cursor-not-allowed" : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleNext} 
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide shrink-0">
          {!isAtToday && (
            <button
              onClick={handleReset}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5 transition-all"
            >
              <Clock className="w-3 h-3" />
              Hoje
            </button>
          )}

          {lastFutureTransactionDate && (
            <button
              onClick={handleLastDebt}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border border-white/5",
                isSameMonth(selectedDate, new Date(lastFutureTransactionDate))
                  ? "bg-amber-500 text-black" 
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
              )}
            >
              <Sparkles className="w-3 h-3" />
              Liquidado
            </button>
          )}
          
          <button
            onClick={() => onDateChange(addMonths(today, 6))}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border border-white/5",
              isSameMonth(selectedDate, addMonths(today, 6))
                ? "bg-violet-600 text-white" 
                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
            )}
          >
            <Calendar className="w-3 h-3" />
            +6 Meses
          </button>
        </div>
      </div>
    </div>
  );
}

export default MonthNavigator;
