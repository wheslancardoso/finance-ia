"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, ArrowRight, Zap } from "lucide-react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeTravelSliderProps {
  onDateChange: (days: number) => void;
  currentDays: number;
}

export function TimeTravelSlider({ onDateChange, currentDays }: TimeTravelSliderProps) {
  const targetDate = addDays(new Date(), currentDays);
  const isFuture = currentDays > 0;

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
              {currentDays === 0 ? "Hoje" : `Em ${currentDays} dias`}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative h-2 w-full bg-white/5 rounded-full px-1 flex items-center">
            <input
              type="range"
              min="0"
              max="90"
              value={currentDays}
              onChange={(e) => onDateChange(parseInt(e.target.value))}
              className="w-full h-full bg-transparent appearance-none cursor-pointer z-20 accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-violet-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/50"
            />
            {/* Progress fill */}
            <div 
              className="absolute left-1 top-1/2 -translate-y-1/2 h-1 bg-violet-500 rounded-full pointer-events-none transition-all duration-300"
              style={{ width: `calc(${(currentDays / 90) * 100}% - 8px)` }}
            />
          </div>

          <div className="flex justify-between px-1">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Hoje</span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">+30 dias</span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">+60 dias</span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">+90 dias</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isFuture && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-violet-500/5 border border-violet-500/10 rounded-2xl flex items-center gap-3"
            >
              <Calendar className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <p className="text-[10px] text-violet-400/80 font-medium leading-tight">
                Simulando receitas, despesas fixas e orçamentos planejados até {format(targetDate, "MMMM", { locale: ptBR })}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
