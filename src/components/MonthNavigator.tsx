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
  debtExitDate?: Date | null;
}

export function MonthNavigator({ selectedDate, onDateChange, lastFutureTransactionDate, debtExitDate }: MonthNavigatorProps) {
  const [today, setToday] = React.useState<Date>(selectedDate);
  
  React.useEffect(() => {
    setToday(startOfMonth(new Date()));
  }, []);

  const isFuture = selectedDate > today && !isSameMonth(selectedDate, today);
  const isPast = selectedDate < today && !isSameMonth(selectedDate, today);
  
  const handlePrev = () => {
    const prev = subMonths(startOfMonth(selectedDate), 1);
    onDateChange(prev);
  };

  const handleNext = () => onDateChange(addMonths(startOfMonth(selectedDate), 1));
  const handleReset = () => onDateChange(today);
  const handleLastDebt = () => {
    const target = debtExitDate || (lastFutureTransactionDate ? new Date(lastFutureTransactionDate) : null);
    if (target) {
      onDateChange(startOfMonth(target));
    }
  };

  const isAtToday = isSameMonth(selectedDate, today);

  const monthOffset = React.useMemo(() => {
    const todayMo = startOfMonth(today);
    const targetMo = startOfMonth(selectedDate);
    const months = (targetMo.getFullYear() - todayMo.getFullYear()) * 12 + (targetMo.getMonth() - todayMo.getMonth());
    return Math.max(0, months);
  }, [selectedDate, today]);

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-5 shadow-2xl relative overflow-hidden h-full flex flex-col">
      
      {/* Glow de fundo */}
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full transition-colors duration-500",
        isFuture ? "bg-violet-600/20" : (isPast ? "bg-slate-600/15" : "bg-emerald-600/10")
      )} />

      <div className="relative z-10 flex flex-col h-full gap-5">

        {/* LINHA 1: Label + Setas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center border transition-all shrink-0",
              isFuture
                ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                : (isPast
                  ? "bg-slate-500/10 border-slate-500/20 text-slate-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")
            )}>
              {isFuture ? <Zap className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            </div>
            <div>
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                {isFuture ? "Projeção" : (isPast ? "Histórico" : "Atual")}
              </p>
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                isFuture ? "text-violet-400" : (isPast ? "text-slate-400" : "text-emerald-400")
              )}>
                Time Machine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-black/30 border border-white/5 p-1 rounded-xl">
            <button
              onClick={handlePrev}
              aria-label="Mês Anterior"
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Próximo Mês"
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LINHA 2: Display visual dos 3 meses */}
        <div className="flex items-center justify-between px-2 flex-1">
          
          {/* Mês anterior */}
          <div className="text-center opacity-30">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">
              {format(subMonths(startOfMonth(selectedDate), 1), "MMM", { locale: ptBR })}
            </p>
            <p className="text-lg font-black text-white/30">
              {format(subMonths(startOfMonth(selectedDate), 1), "yy")}
            </p>
          </div>

          {/* Mês atual — destaque */}
          <div className="text-center">
            <div className={cn(
              "px-5 py-3 rounded-2xl border transition-all duration-500",
              isFuture
                ? "bg-violet-500/10 border-violet-500/20"
                : (isPast
                  ? "bg-slate-500/10 border-slate-500/20"
                  : "bg-emerald-500/10 border-emerald-500/20")
            )}>
              <p className={cn(
                "text-2xl font-black capitalize leading-none",
                isFuture ? "text-violet-300" : (isPast ? "text-slate-300" : "text-emerald-300")
              )}>
                {format(selectedDate, "MMM", { locale: ptBR })}
              </p>
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest mt-1",
                isFuture ? "text-violet-400/60" : (isPast ? "text-slate-400/60" : "text-emerald-400/60")
              )}>
                {format(selectedDate, "yyyy")}
              </p>
            </div>
            {/* Indicador de offset */}
            {isFuture && (
              <p className="text-[8px] font-black text-violet-400/40 uppercase tracking-widest mt-2">
                +{monthOffset} {monthOffset === 1 ? "mês" : "meses"}
              </p>
            )}
          </div>

          {/* Próximo mês */}
          <div className="text-center opacity-30">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">
              {format(addMonths(startOfMonth(selectedDate), 1), "MMM", { locale: ptBR })}
            </p>
            <p className="text-lg font-black text-white/30">
              {format(addMonths(startOfMonth(selectedDate), 1), "yy")}
            </p>
          </div>

        </div>

        {/* LINHA 3: Botões de atalho */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide shrink-0 pb-1">
          <button
            onClick={handleReset}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border",
              isAtToday
                ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white"
            )}
          >
            <Clock className="w-3 h-3" />
            Hoje
          </button>



          {(debtExitDate || lastFutureTransactionDate) && (
            <button
              onClick={handleLastDebt}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border",
                isSameMonth(selectedDate, debtExitDate || (lastFutureTransactionDate ? new Date(lastFutureTransactionDate) : new Date()))
                  ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white"
              )}
            >
              <Sparkles className="w-3 h-3" />
              Fim Dívidas
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default MonthNavigator;
