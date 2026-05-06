"use client";

import React from "react";
import { motion } from "framer-motion";

interface DataPoint {
  day: string;
  value: number;
}

interface SpendingChartProps {
  data?: DataPoint[];
}

const defaultData: DataPoint[] = [
  { day: "Seg", value: 400 },
  { day: "Ter", value: 300 },
  { day: "Qua", value: 600 },
  { day: "Qui", value: 800 },
  { day: "Sex", value: 500 },
  { day: "Sáb", value: 900 },
  { day: "Dom", value: 700 },
];

export function SpendingChart({ data = defaultData }: SpendingChartProps) {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min;
  
  const width = 1000;
  const height = 200;
  const padding = 40;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * (height - padding * 2) - padding;
    return { x, y };
  });

  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="w-full h-48 relative mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
          
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Area Fill */}
        <motion.path
          d={areaPath}
          fill="url(#chartGradient)"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* The Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#A78BFA"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Data Points (Glow dots) */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#FFF"
            className="shadow-lg shadow-violet-500"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1 + i * 0.1 }}
          />
        ))}
      </svg>

      {/* Labels */}
      <div className="absolute bottom-[-24px] left-0 w-full flex justify-between px-1">
        {data.map((d) => (
          <span key={d.day} className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}
