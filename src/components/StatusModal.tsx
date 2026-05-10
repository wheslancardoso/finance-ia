"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusType = "success" | "error" | "info";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: StatusType;
  buttonText?: string;
}

export function StatusModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  buttonText = "Entendido"
}: StatusModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
      case "error":
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      default:
        return <Info className="w-6 h-6 text-violet-400" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case "success":
        return "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]";
      case "error":
        return "bg-red-500/10 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]";
      default:
        return "bg-violet-500/10 border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]";
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden"
          >
            {/* Liquid Glow based on type */}
            <div className={cn(
              "absolute -top-32 -right-32 w-64 h-64 blur-[100px] opacity-20 pointer-events-none transition-colors duration-500",
              type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-violet-500"
            )} />

            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500",
                getIconBg()
              )}>
                {getIcon()}
              </div>
              <button 
                onClick={onClose} 
                className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-10 relative z-10">
              <h2 className="text-2xl font-black text-white tracking-tighter">
                {title}
              </h2>
              <p className="text-white/40 text-sm font-medium leading-relaxed">
                {message}
              </p>
            </div>

            <button
              onClick={onClose}
              data-testid="status-modal-close"
              className={cn(
                "w-full py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.4em] transition-all active:scale-[0.98] shadow-2xl relative z-10",
                type === "success" ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20" :
                type === "error" ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20" :
                "bg-white text-black hover:bg-white/90"
              )}
            >
              {buttonText}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
