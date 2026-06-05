"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger"
}: ConfirmModalProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div key={`confirm-modal-content-${title.replace(/\s+/g, '-').toLowerCase()}`} className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-[#0A0A0A]/80 border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden backdrop-blur-2xl"
          >
            {/* Subtle Gradient Glow */}
            <div className={cn(
              "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-20",
              variant === "danger" ? "bg-red-500" : "bg-amber-500"
            )} />

            <div className="flex flex-col items-center text-center space-y-6">
              <div className={cn(
                "w-20 h-20 rounded-[28px] flex items-center justify-center border-2 rotate-3 hover:rotate-0 transition-transform duration-500",
                variant === "danger" 
                  ? "bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)]" 
                  : "bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)]"
              )}>
                <AlertTriangle className="w-10 h-10" />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-black text-white tracking-tighter">
                  {title}
                </h2>
                <p className="text-white/40 text-sm leading-relaxed font-medium">
                  {message}
                </p>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button
                  data-testid="confirm-button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "w-full py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.3em] text-white transition-all active:scale-[0.98] shadow-2xl",
                    variant === "danger" 
                      ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" 
                      : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                  )}
                >
                  {confirmText}
                </button>
                <button
                  data-testid="cancel-button"
                  onClick={onClose}
                  className="w-full py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white hover:bg-white/5 transition-all"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
