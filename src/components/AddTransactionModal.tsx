"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Wallet, Tag, Calendar, PencilLine } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { usePathname, useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
}

export function AddTransactionModal() {
  const { isOpen, transactionToEdit, closeModal, openAdd } = useTransactionModal();
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Form State
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (transactionToEdit) {
        setAmount((transactionToEdit.amount_cents / 100).toString().replace(".", ","));
        setDescription(transactionToEdit.description);
        setCategoryId(transactionToEdit.category_id);
        setAccountId(transactionToEdit.account_id);
        setType(transactionToEdit.transaction_type);
      } else {
        resetForm();
      }
    }
  }, [isOpen]);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Buscar o grupo familiar do usuário
    const { data: familyMember } = await supabase
      .from("family_members")
      .select("family_group_id")
      .eq("user_id", user.id)
      .single();

    if (!familyMember) return;

    const familyGroupId = familyMember.family_group_id;

    // Buscar contas e categorias DO GRUPO
    const { data: catData } = await supabase
      .from("categories")
      .select("id, name")
      .eq("family_group_id", familyGroupId);

    const { data: accData } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("family_group_id", familyGroupId);

    if (catData) setCategories(catData);
    if (accData) setAccounts(accData);
    
    if (accData?.length && !accountId) setAccountId(accData[0].id);
    if (catData?.length && !categoryId) setCategoryId(catData[0].id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (!accountId || !categoryId || !amount) {
      alert("Por favor, preencha todos os campos corretamente.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);

    const payload = {
      account_id: accountId,
      category_id: categoryId,
      amount_cents: amountCents,
      transaction_type: type,
      description,
    };

    let error;
    if (transactionToEdit) {
      const { error: err } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", transactionToEdit.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("transactions").insert({
        ...payload,
        date: new Date().toISOString(),
      });
      error = err;
    }

    if (!error) {
      closeModal();
      router.refresh();
    } else {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar transação");
    }
    setLoading(false);
  }

  function resetForm() {
    setAmount("");
    setDescription("");
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={openAdd}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-violet-600 text-white shadow-2xl shadow-violet-600/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border border-white/20"
      >
        <Plus className="w-8 h-8" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              {/* Glow background */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white">
                  {transactionToEdit ? "Editar Transação" : "Nova Transação"}
                </h2>
                <button onClick={closeModal} className="text-white/40 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type Toggle */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                  {(["EXPENSE", "INCOME"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                        type === t
                          ? "bg-white/10 text-white shadow-inner"
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      {t === "EXPENSE" ? "Gasto" : "Ganho"}
                    </button>
                  ))}
                </div>

                {/* Amount Input */}
                <div className="text-center py-4">
                  <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2 block">Valor</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold text-white/40">R$</span>
                    <input
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-transparent text-5xl font-bold text-white outline-none w-full max-w-[200px] text-center placeholder:text-white/5"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Description */}
                  <div className="relative">
                    <PencilLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                    <input
                      placeholder="O que foi isso?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Account Select */}
                    <div className="relative">
                      <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-violet-500/50 appearance-none"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id} className="bg-black text-white">{acc.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category Select */}
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-violet-500/50 appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-black text-white">{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  disabled={loading || !amount || !description}
                  type="submit"
                  className="w-full bg-violet-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98] mt-4"
                >
                  {loading ? "Salvando..." : "Confirmar Transação"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
