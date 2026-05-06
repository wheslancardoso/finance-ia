"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Wallet, Tag, CreditCard } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useSubscriptionModal } from "@/context/SubscriptionModalContext";
import { useRouter } from "next/navigation";

export function AddSubscriptionModal() {
  const { isOpen, closeModal } = useSubscriptionModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form State
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [day, setDay] = useState(new Date().getDate());

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: familyMember } = await supabase
      .from("family_members")
      .select("family_group_id")
      .eq("user_id", user.id)
      .single();

    if (!familyMember) return;

    const { data: cats } = await supabase.from("categories").select("id, name");
    const { data: accs } = await supabase.from("accounts").select("id, name, type").eq("family_group_id", familyMember.family_group_id);

    if (cats) setCategories(cats);
    if (accs) setAccounts(accs);
    if (cats?.length) setCategoryId(cats[0].id);
    if (accs?.length) setAccountId(accs[0].id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: familyMember } = await supabase
      .from("family_members")
      .select("family_group_id")
      .eq("user_id", user.id)
      .single();

    if (!familyMember) return;

    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    
    // Calcular a próxima data baseada no dia escolhido
    const nextDate = new Date();
    nextDate.setDate(day);
    if (nextDate < new Date()) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    const { error } = await supabase.from("recurring_transactions").insert({
      family_group_id: familyMember.family_group_id,
      account_id: accountId,
      category_id: categoryId,
      description,
      amount_cents: amountCents,
      transaction_type: "EXPENSE",
      frequency: "monthly",
      next_date: nextDate.toISOString(),
      status: "active"
    });

    if (!error) {
      closeModal();
      setDescription("");
      setAmount("");
      router.refresh();
    } else {
      alert("Erro ao salvar assinatura");
    }
    setLoading(false);
  }

  return (
    <AnimatePresence>
      {isOpen && (
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
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white">Nova Assinatura</h2>
              </div>
              <button onClick={closeModal} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">O que é?</label>
                <input
                  autoFocus
                  placeholder="Ex: Netflix, Internet, Spotify"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Valor Mensal</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-sm">R$</span>
                    <input
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-white outline-none focus:border-violet-500/50 transition-all font-bold tabular-nums"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Dia de Cobrança</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day}
                    onChange={(e) => setDay(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Conta de Origem</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 appearance-none font-bold"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="bg-black">
                      {acc.type === "CREDIT_CARD" ? "💳" : "💰"} {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                disabled={loading || !amount || !description}
                type="submit"
                className="w-full bg-white text-black font-black text-xs uppercase tracking-[0.3em] py-5 rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl shadow-white/5"
              >
                {loading ? "Salvando..." : "Confirmar Assinatura"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
