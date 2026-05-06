"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Palette, Landmark } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { useAccountModal } from "@/context/AccountModalContext";

export function AddAccountModal() {
  const { isOpen, accountToEdit, closeModal } = useAccountModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState("CHECKING");
  const [balance, setBalance] = useState("");
  const [colorHex, setColorHex] = useState("#7C3AED");

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setBalance((accountToEdit.balance_cents / 100).toString());
        setColorHex(accountToEdit.color_hex);
      } else {
        resetForm();
      }
    }
  }, [isOpen]);

  function resetForm() {
    setName("");
    setType("CHECKING");
    setBalance("");
    setColorHex("#7C3AED");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const balanceCents = Math.round(parseFloat(balance.replace(",", ".")) * 100);

    const payload = {
      name,
      type,
      balance_cents: balanceCents,
      color_hex: colorHex,
    };

    let error;
    if (accountToEdit) {
      const { error: err } = await supabase
        .from("accounts")
        .update(payload)
        .eq("id", accountToEdit.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("accounts").insert([payload]);
      error = err;
    }

    if (!error) {
      closeModal();
      router.refresh();
    } else {
      alert("Erro ao salvar conta");
    }
    setLoading(false);
  }

  const accountTypes = [
    { id: "CHECKING", label: "Corrente", icon: Wallet },
    { id: "SAVINGS", label: "Investimento", icon: Landmark },
    { id: "CREDIT_CARD", label: "Cartão de Crédito", icon: Wallet },
    { id: "CASH", label: "Dinheiro", icon: Wallet },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-white">
                {accountToEdit ? "Editar Conta" : "Nova Conta"}
              </h2>
              <button onClick={closeModal} className="text-white/40 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    placeholder="Nome da Conta (ex: Nubank)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-violet-500/50"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-white outline-none focus:border-violet-500/50 appearance-none"
                  >
                    {accountTypes.map((t) => (
                      <option key={t.id} value={t.id} className="bg-black">
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="Saldo Inicial"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-4 text-white outline-none focus:border-violet-500/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Cor de Identidade</label>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                    <input 
                      type="color" 
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="w-12 h-12 bg-transparent border-none cursor-pointer"
                    />
                    <span className="text-white font-mono text-sm uppercase">{colorHex}</span>
                  </div>
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98]"
              >
                {loading ? "Salvando..." : "Confirmar Conta"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
