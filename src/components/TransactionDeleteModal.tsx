"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Layers, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteType: "single" | "future" | "all") => void;
  isInstallment: boolean;
  isRecurring: boolean;
  description: string;
}

export function TransactionDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isInstallment,
  isRecurring,
  description
}: TransactionDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-red-500/10 border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-2 mb-8">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Excluir Transação
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Você está prestes a excluir <span className="text-white font-semibold">"{description}"</span>.
                {isInstallment ? " Esta transação faz parte de uma compra parcelada." : " Esta ação não pode ser desfeita."}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {isRecurring ? (
                <>
                  <button
                    onClick={() => {
                      onConfirm("all");
                      onClose();
                    }}
                    className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white bg-red-500 hover:bg-red-600 transition-all active:scale-[0.98] shadow-xl shadow-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir TODAS as ocorrências
                  </button>
                  <button
                    onClick={() => {
                      onConfirm("future");
                      onClose();
                    }}
                    className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                  >
                    Excluir esta e as próximas
                  </button>
                  <button
                    onClick={() => {
                      onConfirm("single");
                      onClose();
                    }}
                    className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-all"
                  >
                    Excluir apenas esta
                  </button>
                </>
              ) : isInstallment ? (
                <>
                  <button
                    onClick={() => {
                      onConfirm("all");
                      onClose();
                    }}
                    data-testid="confirm-delete-all"
                    className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white bg-red-500 hover:bg-red-600 transition-all active:scale-[0.98] shadow-xl shadow-red-500/10"
                  >
                    <Layers className="w-4 h-4" />
                    Excluir TODAS as parcelas
                  </button>
                  <button
                    onClick={() => {
                      onConfirm("single");
                      onClose();
                    }}
                    data-testid="confirm-delete-single"
                    className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                  >
                    Excluir apenas esta
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onConfirm("single");
                    onClose();
                  }}
                  data-testid="confirm-delete-button"
                  className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white bg-red-500 hover:bg-red-600 transition-all active:scale-[0.98] shadow-xl shadow-red-500/10"
                >
                  Confirmar Exclusão
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white/20 hover:text-white transition-all"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
