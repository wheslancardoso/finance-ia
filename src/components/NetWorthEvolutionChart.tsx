"use client";

import React from "react";
import { motion } from "framer-motion";
import { useFinancialData } from "@/context/FinancialDataContext";
import { formatCurrency } from "@/lib/utils";

export default function NetWorthEvolutionChart() {
  const { getNetWorthHistory } = useFinancialData();
  const data = getNetWorthHistory();

  if (data.length === 0) return null;

  const amounts = data.map(d => Number.isFinite(d.amount) ? d.amount : 0);
  // Sempre incluir o zero na escala para dar contexto (se é positivo ou negativo)
  const max = Math.max(...amounts, 0);
  const min = Math.min(...amounts, 0);
  
  const range = max - min;
  const safeRange = range === 0 ? 100 : range;
  const padding = safeRange * 0.15; // Padding menor para não "esticar" demais
  
  const chartMax = max + padding;
  const chartMin = min - padding;
  const chartRange = chartMax - chartMin;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * 300 : 150;
    const safeAmount = Number.isFinite(d.amount) ? d.amount : 0;
    const y = 100 - ((safeAmount - chartMin) / chartRange) * 100;
    return `${x},${y}`;
  }).join(" ");

  // Calcular a posição da linha do zero
  const zeroY = 100 - ((0 - chartMin) / chartRange) * 100;

  const lastItem = data[data.length - 1];
  const previousItem = data.length >= 2 ? data[data.length - 2] : null;
  
  let percentChange = 0;
  let hasChange = false;
  let isPositive = false;
  
  if (previousItem && previousItem.amount !== 0) {
    const diff = lastItem.amount - previousItem.amount;
    percentChange = (diff / Math.abs(previousItem.amount)) * 100;
    hasChange = diff !== 0;
    isPositive = diff > 0;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">Patrimônio Atual</p>
          <p className="text-3xl font-black text-white tracking-tighter">
            {formatCurrency(lastItem.amount * 100)}
          </p>
        </div>
        {hasChange && (
          <div className={`flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-lg ${
            isPositive ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
          }`}>
            <span>{isPositive ? `+${percentChange.toFixed(1)}%` : `${percentChange.toFixed(1)}%`}</span>
          </div>
        )}
      </div>

      <div className="relative aspect-[3/1] min-h-[200px] w-full group mb-8">
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-[0.03] pointer-events-none">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="w-full h-px bg-white" />
          ))}
        </div>

        <svg viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full overflow-visible">
          {/* Gradient Fill */}
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <motion.path
            d={`M 0,${zeroY} ${points.split(' ').map((p, i) => {
              if (i === 0) return `L ${p}`;
              return p;
            }).join(' ')} L 300,${zeroY} Z`}
            fill="url(#chartGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="pointer-events-none"
          />

          {/* Zero Axis Line */}
          <line
            x1="0"
            y1={zeroY}
            x2="300"
            y2={zeroY}
            stroke="white"
            strokeWidth="1"
            strokeDasharray="4,4"
            opacity="0.1"
            vectorEffect="non-scaling-stroke"
          />

          {/* Line */}
          <motion.polyline
            points={points}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            vectorEffect="non-scaling-stroke"
            filter="url(#glow)"
            className="drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]"
          />

          {/* Data Points */}
          {data.map((d, i) => {
            const x = data.length > 1 ? (i / (data.length - 1)) * 300 : 150;
            const safeAmount = Number.isFinite(d.amount) ? d.amount : 0;
            const y = 100 - ((safeAmount - chartMin) / chartRange) * 100;
            return (
              <g key={i} className="cursor-pointer group/point">
                <motion.circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#8B5CF6"
                  stroke="white"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1 + i * 0.1 }}
                />
              </g>
            );
          })}
        </svg>

        {/* Labels */}
        <div className="absolute -bottom-8 inset-x-0 flex justify-between px-0">
          {data.map((d, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-tighter">
                {d.month}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bloco Explicativo de Patrimônio Líquido */}
      <div className="mt-12 p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
        <div className="flex items-center gap-2 text-violet-400">
          <span className="text-xs font-bold uppercase tracking-wider italic flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Metodologia do Patrimônio Líquido Real
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-white/50 font-medium">
          O Vesper calcula o seu <strong>Patrimônio Atual</strong> de forma ultra-conservadora: 
          somamos o dinheiro disponível em suas contas correntes e deduzimos <strong>todas as parcelas e faturas futuras já comprometidas</strong> em seus cartões de crédito. 
          Isso reflete o que restaria de liquidez imediata se você quitasse todas as suas obrigações hoje, evitando a ilusão de caixa.
        </p>
      </div>
    </div>
  );
}
