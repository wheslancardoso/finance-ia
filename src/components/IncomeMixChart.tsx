"use client";

import React from "react";
import { motion } from "framer-motion";
import { useFinancialData } from "@/context/FinancialDataContext";
import { formatCurrency } from "@/lib/utils";

export default function IncomeMixChart() {
  const { getIncomeMix } = useFinancialData();
  const data = getIncomeMix();

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-white/20 text-sm italic">Nenhum dado de receita nos últimos 30 dias.</p>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = [
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
  ];

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {data.map((item, i) => {
            const percent = (item.value / total) * 100;
            const startAngle = (cumulativePercent / 100) * 360;
            cumulativePercent += percent;
            
            // Simple dash array approach for donut
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const dashOffset = circumference - (percent / 100) * circumference;
            const rotation = startAngle;

            return (
              <motion.circle
                key={item.name}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth="12"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.5, delay: i * 0.1, ease: "circOut" }}
                style={{
                  transformOrigin: "center",
                  rotate: `${rotation}deg`,
                }}
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]"
              />
            );
          })}
        </svg>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Total</p>
          <p className="text-lg font-black text-white">{formatCurrency(total * 100)}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 w-full">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white/40 truncate w-24">{item.name}</span>
              <span className="text-xs font-black text-white">{Math.round((item.value / total) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
