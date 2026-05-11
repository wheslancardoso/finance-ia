"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
}

export default function GlassCard({ children, className, onClick, "data-testid": dataTestId }: GlassCardProps) {
  return (
    <motion.div
      onClick={onClick}
      data-testid={dataTestId}
      whileHover={{ scale: 1.02, translateY: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        "relative",
        "backdrop-blur-xl bg-white/10",
        "border border-white/20",
        "rounded-[2rem] shadow-2xl",
        "p-8 text-white",
        className
      )}
    >
      {/* Refraction effect overlay - lowered opacity and z-index to stay behind content */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-0" />
      
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}
