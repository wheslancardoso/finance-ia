"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target, Palette, Sparkles, Calendar } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useGoalModal } from "@/context/GoalModalContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { useRouter } from "next/navigation";

export function AddGoalModal() {
  const { isOpen, closeModal } = useGoalModal();
  const { familyGroupId } = useAccountModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [colorHex, setColorHex] = useState("#8B5CF6");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);

    try {
      const supabase = createClient();
      
      if (!familyGroupId) {
        console.error("Erro: familyGroupId não encontrado no contexto.");
        alert("Não foi possível identificar seu grupo familiar. Tente recarregar a página.");
        setLoading(false);
        return;
      }

      // Validar e formatar valores
      const targetStr = targetAmount.replace(/\./g, "").replace(",", ".");
      const currentStr = currentAmount.replace(/\./g, "").replace(",", ".");
      
      const targetCents = Math.round(parseFloat(targetStr) * 100);
      const currentCents = currentAmount ? Math.round(parseFloat(currentStr) * 100) : 0;

      if (isNaN(targetCents)) {
        alert("Valor alvo inválido.");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from("goals").insert({
        family_group_id: familyGroupId,
        name,
        target_amount_cents: targetCents,
        current_amount_cents: currentCents,
        deadline: deadline || null,
        color_hex: colorHex,
        status: "active"
      });

      if (insertError) {
        console.error("Erro ao inserir meta:", insertError);
        alert(`Erro ao salvar meta: ${insertError.message}`);
      } else {
        closeModal();
        resetForm();
        router.refresh();
      }
    } catch (err) {
      console.error("Erro inesperado no cadastro de meta:", err);
      alert("Ocorreu um erro inesperado. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setTargetAmount("");
    setCurrentAmount("");
    setDeadline("");
    setColorHex("#8B5CF6");
  }

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                  <Target className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white">Novo Objetivo</h2>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  closeModal();
                }} 
                className="text-white/20 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/5 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">O que você quer conquistar?</label>
                <input
                  autoFocus
                  placeholder="Ex: Viagem, Carro Novo, Reserva..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Valor Alvo</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-sm">R$</span>
                    <input
                      placeholder="0,00"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-white outline-none focus:border-violet-500/50 transition-all font-bold tabular-nums"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Já tenho salvo</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-sm">R$</span>
                    <input
                      placeholder="0,00"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-white outline-none focus:border-violet-500/50 transition-all font-bold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Prazo (Opcional)</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-violet-500/50 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-xl border border-white/10 overflow-hidden shadow-lg group">
                  <div className="absolute inset-0" style={{ backgroundColor: colorHex }} />
                  <input 
                    type="color" 
                    value={colorHex} 
                    onChange={(e) => setColorHex(e.target.value)} 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
                
                <button
                  disabled={loading || !targetAmount || !name}
                  type="submit"
                  className="flex-1 bg-white text-black font-black text-xs uppercase tracking-[0.3em] py-5 rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl shadow-white/5"
                >
                  {loading ? "Criando Meta..." : "Começar a Poupar"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
