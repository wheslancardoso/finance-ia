"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpCircle, Sparkles, TrendingUp } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { useGoalModal } from "@/context/GoalModalContext";
import { useRouter } from "next/navigation";

export function ContributionModal() {
  const { isContributionOpen, closeModal, selectedGoal } = useGoalModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isContributionOpen) {
      setAmount("");
    }
  }, [isContributionOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoal) return;
    setLoading(true);

    const supabase = createClient();
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    const newTotal = selectedGoal.current_amount_cents + amountCents;

    const { error } = await supabase
      .from("goals")
      .update({ current_amount_cents: newTotal })
      .eq("id", selectedGoal.id);

    if (!error) {
      closeModal();
      router.refresh();
    } else {
      alert("Erro ao realizar aporte");
    }
    setLoading(false);
  }

  return (
    <AnimatePresence>
      {isContributionOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Glow */}
            <div 
              className="absolute -top-24 -right-24 w-48 h-48 blur-[100px] opacity-20 rounded-full"
              style={{ backgroundColor: selectedGoal.color_hex }}
            />

            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center border"
                  style={{ backgroundColor: `${selectedGoal.color_hex}20`, color: selectedGoal.color_hex, borderColor: `${selectedGoal.color_hex}30` }}
                >
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Aportar</h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{selectedGoal.name}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest">Quanto quer poupar?</label>
                  <span className="text-[10px] font-bold text-white/40">Faltam {formatCurrency(selectedGoal.target_amount_cents - selectedGoal.current_amount_cents)}</span>
                </div>
                
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 font-black text-2xl">R$</span>
                  <input
                    autoFocus
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl py-8 pl-16 pr-8 text-4xl text-white outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all font-black tabular-nums placeholder:text-white/5"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <GlassCard className="p-4 bg-white/5 border-white/5">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Saldo Atual</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(selectedGoal.current_amount_cents)}</p>
                </GlassCard>
                <GlassCard className="p-4 bg-white/5 border-white/5">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Pós-Aporte</p>
                  <p className="text-sm font-bold text-violet-400">
                    {formatCurrency(selectedGoal.current_amount_cents + (amount ? Math.round(parseFloat(amount.replace(",", ".")) * 100) : 0))}
                  </p>
                </GlassCard>
              </div>

              <button
                disabled={loading || !amount || parseFloat(amount.replace(",", ".")) <= 0}
                type="submit"
                className="w-full bg-white text-black font-black text-xs uppercase tracking-[0.3em] py-6 rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3"
              >
                {loading ? (
                   "Processando..."
                ) : (
                  <>
                    <ArrowUpCircle className="w-5 h-5" />
                    Confirmar Aporte
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
