"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";

interface QuickSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
}

export function QuickSyncModal({ isOpen, onClose, account }: QuickSyncModalProps) {
  const [newBalance, setNewBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setNewBalance("");
      setSuccess(false);
    }
  }, [isOpen]);

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    if (!newBalance || loading) return;

    setLoading(true);
    const supabase = createClient();
    
    try {
      const currentBalanceCents = account.balance_cents;
      const newBalanceCents = Math.round(parseFloat(newBalance.replace(",", ".")) * 100);
      const delta = newBalanceCents - currentBalanceCents;

      if (delta === 0) {
        onClose();
        return;
      }

      const transactionType = delta > 0 ? "INCOME" : "EXPENSE";
      
      // 1. Criar Transação de Ajuste
      // Tentamos buscar uma categoria de "Ajuste" ou similar, senão usamos null ou a primeira disponível
      const { data: categories } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", account.user_id)
        .limit(1);

      const categoryId = categories && categories.length > 0 ? categories[0].id : null;

      const { error: txError } = await supabase.from("transactions").insert([{
        account_id: account.id,
        category_id: categoryId,
        amount_cents: Math.abs(delta),
        transaction_type: transactionType,
        date: new Date().toISOString(),
        description: `Reajuste de Saldo (${account.name})`,
        source: "SYNC"
      }]);

      if (txError) throw txError;

      // 2. Atualizar Saldo da Conta
      const { error: accError } = await supabase
        .from("accounts")
        .update({ balance_cents: newBalanceCents })
        .eq("id", account.id);

      if (accError) throw accError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Erro ao sincronizar saldo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-white/5 border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Glow */}
            <div 
              className="absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-20"
              style={{ backgroundColor: account.color_hex }}
            />

            <div className="flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10"
                  style={{ backgroundColor: `${account.color_hex}20` }}
                >
                  <RefreshCw className={cn("w-5 h-5", loading ? "animate-spin" : "")} style={{ color: account.color_hex }} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg leading-none mb-1">Sincronizar {account.name}</h2>
                  <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Ajuste de Saldo Real</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="p-4 rounded-3xl bg-white/2 border border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/40 uppercase">Saldo Atual</span>
                <span className="text-sm font-black text-white tabular-nums">{formatCurrency(account.balance_cents)}</span>
              </div>

              <form onSubmit={handleSync} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Novo Saldo no Banco</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 font-bold">R$</span>
                    <input
                      autoFocus
                      placeholder="0,00"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-3xl py-6 pl-12 pr-6 text-white text-2xl font-black outline-none focus:border-white/20 transition-all tabular-nums no-spinner"
                      required
                    />
                  </div>
                </div>

                <button
                  disabled={loading || !newBalance || success}
                  type="submit"
                  className={cn(
                    "w-full py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-2",
                    success ? "bg-emerald-500 text-white" : "bg-white text-black hover:bg-white/90"
                  )}
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Sincronizado
                    </>
                  ) : (
                    "Confirmar Ajuste"
                  )}
                </button>
              </form>

              <div className="flex items-start gap-2 px-1">
                <AlertCircle className="w-3 h-3 text-white/20 mt-0.5" />
                <p className="text-[9px] leading-relaxed text-white/30 font-medium italic">
                  A diferença será lançada automaticamente como uma transação de ajuste para manter seu histórico preciso.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
