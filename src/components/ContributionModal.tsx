"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpCircle, TrendingUp, CreditCard, Wallet, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import { useGoalModal } from "@/context/GoalModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useRouter } from "next/navigation";

export function ContributionModal() {
  const { isContributionOpen, closeModal, selectedGoal } = useGoalModal();
  const { accounts, categories } = useFinancialData();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Filtrar apenas contas que podem ter saldo positivo ou cartões que permitem gastos
  const availableAccounts = useMemo(() => {
    return accounts.filter(acc => acc.type !== "INVESTMENT" || acc.id !== selectedGoal?.id);
  }, [accounts, selectedGoal]);

  useEffect(() => {
    if (isContributionOpen) {
      setAmount("");
      setSelectedAccountId(null);
    }
  }, [isContributionOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoal || !selectedAccountId) return;
    setLoading(true);

    const supabase = createClient();
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    
    // 1. Criar a transação de "Aporte"
    // Procurar uma categoria de 'Investimento' ou 'Outros'
    const targetCategory = categories.find(c => c.name.toLowerCase().includes("investimento") || c.name.toLowerCase().includes("reserva")) || categories[0];

    const { error: txError } = await supabase.from("transactions").insert({
      account_id: selectedAccountId,
      category_id: targetCategory?.id,
      description: `Aporte: ${selectedGoal.name}`,
      amount_cents: amountCents,
      transaction_type: "EXPENSE",
      date: new Date().toISOString(),
    });

    if (txError) {
      alert("Erro ao criar transação de aporte");
      setLoading(false);
      return;
    }

    // 2. Atualizar o saldo da Meta
    const newTotal = (selectedGoal.current_amount_cents || 0) + amountCents;
    const { error: goalError } = await supabase
      .from("goals")
      .update({ current_amount_cents: newTotal })
      .eq("id", selectedGoal.id);

    if (!goalError) {
      closeModal();
      router.refresh();
    } else {
      alert("Erro ao atualizar saldo da meta");
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
            onClick={(e) => {
              e.preventDefault();
              closeModal();
            }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Glow */}
            <div 
              className="absolute -top-24 -right-24 w-48 h-48 blur-[100px] opacity-20 rounded-full pointer-events-none"
              style={{ backgroundColor: selectedGoal.color_hex }}
            />

            <div className="flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center border"
                  style={{ backgroundColor: `${selectedGoal.color_hex}20`, color: selectedGoal.color_hex, borderColor: `${selectedGoal.color_hex}30` }}
                >
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Realizar Aporte</h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{selectedGoal.name}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  closeModal();
                }} 
                className="text-white/20 hover:text-white transition-colors cursor-pointer p-2 hover:bg-white/5 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Valor */}
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
                    className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 pl-16 pr-8 text-4xl text-white outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all font-black tabular-nums placeholder:text-white/5"
                    required
                  />
                </div>
              </div>

              {/* Seletor de Conta */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">De onde virá o dinheiro?</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {availableAccounts.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={cn(
                          "flex-shrink-0 flex items-center gap-3 p-3 rounded-2xl border transition-all",
                          isSelected
                            ? "bg-white/10 border-white/30 text-white"
                            : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center border"
                          style={{ backgroundColor: `${acc.color_hex}10`, color: acc.color_hex, borderColor: `${acc.color_hex}20` }}
                        >
                          {acc.type === "CREDIT_CARD" ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-bold leading-tight truncate w-24">{acc.name}</p>
                          <p className="text-[9px] font-medium opacity-60 tabular-nums">{formatCurrency(acc.balance_cents)}</p>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-violet-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <GlassCard className="p-4 bg-white/5 border-white/5">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Status da Meta</p>
                  <p className="text-sm font-bold text-white">
                    {Math.min(((selectedGoal.current_amount_cents + (amount ? Math.round(parseFloat(amount.replace(",", ".")) * 100) : 0)) / selectedGoal.target_amount_cents) * 100, 100).toFixed(1)}%
                  </p>
                </GlassCard>
                <GlassCard className="p-4 bg-white/5 border-white/5">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Novo Saldo Meta</p>
                  <p className="text-sm font-bold text-violet-400">
                    {formatCurrency(selectedGoal.current_amount_cents + (amount ? Math.round(parseFloat(amount.replace(",", ".")) * 100) : 0))}
                  </p>
                </GlassCard>
              </div>

              <button
                disabled={loading || !amount || !selectedAccountId || parseFloat(amount.replace(",", ".")) <= 0}
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
