"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, Zap, Sparkles, ChevronRight } from "lucide-react";
import { addDays, format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeTravelSliderProps {
  onDateChange: (days: number) => void;
  currentDays: number;
  lastFutureTransactionDate?: string | null;
}

export function TimeTravelSlider({ onDateChange, currentDays, lastFutureTransactionDate }: TimeTravelSliderProps) {
  const targetDate = addDays(new Date(), currentDays);
  const isFuture = currentDays > 0;
  
  // Horizonte de 1 ano (365 dias)
  const maxDays = 365;

  const lastTxDays = lastFutureTransactionDate 
    ? differenceInDays(new Date(lastFutureTransactionDate), new Date())
    : 0;

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
                {isFuture ? "Viagem no Tempo" : "Estado Atual"}
              </h3>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
                Projeção Baseada em Padrões
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className={cn(
              "text-lg font-bold transition-colors duration-500",
              isFuture ? "text-violet-400" : "text-emerald-400"
            )}>
              {format(targetDate, "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
              {currentDays === 0 ? "Hoje" : currentDays >= 30 ? `Em ~${Math.round(currentDays / 30)} meses` : `Em ${currentDays} dias`}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative h-2 w-full bg-white/5 rounded-full px-1 flex items-center">
            {/* Marcador de Fim de Dívida (Parcelamento) */}
            {lastTxDays > 0 && lastTxDays <= maxDays && (
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-amber-500/40 rounded-full z-10"
                style={{ left: `calc(${(lastTxDays / maxDays) * 100}% + 4px)` }}
                title="Fim dos parcelamentos atuais"
              />
            )}

            <input
              type="range"
              min="0"
              max={maxDays}
              value={currentDays}
              onChange={(e) => onDateChange(parseInt(e.target.value))}
              className="w-full h-full bg-transparent appearance-none cursor-pointer z-20 accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-violet-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/50"
            />
            {/* Progress fill */}
            <div 
              className="absolute left-1 top-1/2 -translate-y-1/2 h-1 bg-violet-500 rounded-full pointer-events-none transition-all duration-300"
              style={{ width: `calc(${(currentDays / maxDays) * 100}% - 8px)` }}
            />
          </div>

          <div className="flex justify-between px-1">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Hoje</span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">3 meses</span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">6 meses</span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">1 ano</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {lastTxDays > 0 && (
            <button
              onClick={() => onDateChange(lastTxDays)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                currentDays === lastTxDays 
                  ? "bg-amber-500 text-black" 
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5"
              )}
            >
              <Sparkles className="w-3 h-3" />
              Fim das Dívidas ({format(addDays(new Date(), lastTxDays), "MMM/yy", { locale: ptBR })})
            </button>
          )}
          
          <button
            onClick={() => onDateChange(180)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              currentDays === 180 
                ? "bg-violet-600 text-white" 
                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5"
            )}
          >
            <Calendar className="w-3 h-3" />
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
                Simulando receitas, despesas fixas e parcelas de cartão até <strong>{format(targetDate, "MMMM 'de' yyyy", { locale: ptBR })}</strong>. 
                {currentDays === lastTxDays && " Este é o dia em que seus parcelamentos atuais terminam!"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
