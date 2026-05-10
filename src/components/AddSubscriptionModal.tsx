"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Wallet, Tag, CreditCard, ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useSubscriptionModal } from "@/context/SubscriptionModalContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { useRouter } from "next/navigation";
import { useFinancialData } from "@/context/FinancialDataContext";

export function AddSubscriptionModal() {
  const { isOpen, closeModal, editingSubscription } = useSubscriptionModal();
  const { userId } = useAccountModal();
  const router = useRouter();
  const { categories, accounts, refreshData } = useFinancialData();
  const [loading, setLoading] = useState(false);

  // Form State
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [day, setDay] = useState(new Date().getDate());
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  
  // Pre-preencher se estiver editando
  useEffect(() => {
    if (editingSubscription) {
      setDescription(editingSubscription.description || "");
      setAmount(((editingSubscription.amount_cents || 0) / 100).toString().replace(".", ","));
      setCategoryId(editingSubscription.category_id || "");
      setAccountId(editingSubscription.account_id || "");
      setType(editingSubscription.transaction_type || "EXPENSE");
      
      if (editingSubscription.next_date) {
        setDay(new Date(editingSubscription.next_date).getDate());
      }
    } else {
      setDescription("");
      setAmount("");
      setCategoryId("");
      if (accounts.length > 0) setAccountId(accounts[0].id);
      setDay(new Date().getDate());
      setType("EXPENSE");
    }
  }, [editingSubscription, accounts, isOpen]);

  // Custom Select States
  const [openCategory, setOpenCategory] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setOpenAccount(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setOpenCategory(false);
      }
    }
    if (openAccount || openCategory) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openAccount, openCategory]);

  useEffect(() => {
    if (isOpen && accounts.length > 0 && !editingSubscription) {
      if (!accountId || !accounts.find(a => a.id === accountId)) {
        setAccountId(accounts[0].id);
      }
    }
  }, [isOpen, accounts, editingSubscription]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    if (!userId) {
      alert("Usuário não identificado. Recarregue a página.");
      setLoading(false);
      return;
    }

    const amountCents = Math.round(parseFloat(amount.replace(/\./g, "").replace(",", ".")) * 100);
    
    // Calcular a próxima data baseada no dia escolhido
    const nextDate = new Date();
    nextDate.setDate(day);
    if (nextDate < new Date()) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    // Fallback para categorias caso esteja vazio (o banco exige category_id)
    const fallbackCategoryId = type === "EXPENSE" 
      ? "fe7555b9-5019-4cad-8d57-b2472d660c0f" // Outros (Gasto)
      : "6e0e37fc-4104-4e2a-929e-170758d76d41"; // Outros (Receita)

    const payload: any = {
      account_id: accountId,
      category_id: categoryId || fallbackCategoryId,
      description,
      amount_cents: amountCents,
      transaction_type: type,
      frequency: "monthly",
      next_date: nextDate.toISOString(),
      status: editingSubscription ? editingSubscription.status : "active"
    };

    let error;
    if (editingSubscription) {
      const { error: err } = await supabase
        .from("recurring_transactions")
        .update(payload)
        .eq("id", editingSubscription.id);
      error = err;
    } else {
      payload.user_id = userId;
      const { error: err } = await supabase
        .from("recurring_transactions")
        .insert(payload);
      error = err;
    }

    if (!error) {
      await refreshData();
      closeModal();
      setDescription("");
      setAmount("");
      router.refresh();
    } else {
      console.error("Erro ao salvar fluxo:", error);
      alert(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    }
    setLoading(false);
  }

  const filteredCategories = categories.filter(c => c.type === type);

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
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  type === "EXPENSE" ? "bg-violet-500/20 text-violet-400" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  <Zap className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white">Fluxo Recorrente</h2>
              </div>
              <button onClick={closeModal} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Toggle Tipo */}
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                {(["EXPENSE", "INCOME"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest",
                      type === t
                        ? "bg-white/10 text-white shadow-inner"
                        : "text-white/20 hover:text-white/40"
                    )}
                  >
                    {t === "EXPENSE" ? "Gasto Fixo" : "Receita Fixa"}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Descrição</label>
                <input
                  autoFocus
                  placeholder={type === "EXPENSE" ? "Ex: Netflix, Internet, Aluguel" : "Ex: Salário, Pro-labore, Pensão"}
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
                      className={cn(
                        "w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-10 pr-4 outline-none transition-all font-bold tabular-nums",
                        type === "EXPENSE" ? "text-white focus:border-violet-500/50" : "text-emerald-400 focus:border-emerald-500/50"
                      )}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Dia do Fluxo</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day}
                    onChange={(e) => setDay(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-bold tabular-nums no-spinner"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Categoria Custom Select */}
                <div className="space-y-2 relative" ref={categoryDropdownRef}>
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Categoria</label>
                  <div 
                    onClick={() => {
                      if (categories.length === 0) return;
                      setOpenCategory(!openCategory);
                      setOpenAccount(false);
                    }}
                    className={cn(
                      "w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white font-bold flex justify-between items-center transition-all",
                      categories.length === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-white/10"
                    )}
                  >
                    <span>
                      {categories.length === 0 ? (
                        <span className="flex items-center gap-2 text-white/30">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Carregando...
                        </span>
                      ) : (categories.find(c => c.id === categoryId)?.name || "Nenhuma")}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", openCategory && "rotate-180")} />
                  </div>
                  
                  <AnimatePresence>
                    {openCategory && filteredCategories.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute z-50 left-0 right-0 bottom-full mb-2 bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
                      >
                        <div
                          onClick={() => {
                            setCategoryId("");
                            setOpenCategory(false);
                          }}
                          className="px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-bold text-white/40 hover:text-white transition-colors border-b border-white/5 italic"
                        >
                          Nenhuma (Opcional)
                        </div>
                        {filteredCategories.map(cat => (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setCategoryId(cat.id);
                              setOpenCategory(false);
                            }}
                            className={cn(
                              "px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-0",
                              cat.id === categoryId && "bg-violet-500/10 text-violet-300"
                            )}
                          >
                            {cat.name}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Conta Custom Select */}
                <div className="space-y-2 relative" ref={accountDropdownRef}>
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Conta</label>
                  <div 
                    onClick={() => {
                      if (accounts.length === 0) return;
                      setOpenAccount(!openAccount);
                      setOpenCategory(false);
                    }}
                    className={cn(
                      "w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white font-bold flex justify-between items-center transition-all",
                      accounts.length === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-white/10"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {accounts.length === 0 ? (
                        <span className="flex items-center gap-2 text-white/30">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Carregando...
                        </span>
                      ) : accounts.find(a => a.id === accountId) ? (
                        <>
                          {accounts.find(a => a.id === accountId)?.type === "CREDIT_CARD" ? "💳" : "💰"}
                          {accounts.find(a => a.id === accountId)?.name}
                        </>
                      ) : "Selecione"}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", openAccount && "rotate-180")} />
                  </div>

                  <AnimatePresence>
                    {openAccount && accounts.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute z-50 left-0 right-0 bottom-full mb-2 bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
                      >
                        {accounts.map(acc => (
                          <div
                            key={acc.id}
                            onClick={() => {
                              setAccountId(acc.id);
                              setOpenAccount(false);
                            }}
                            className={cn(
                              "px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-center gap-3",
                              acc.id === accountId && "bg-violet-500/10 text-violet-300"
                            )}
                          >
                            <span>{acc.type === "CREDIT_CARD" ? "💳" : "💰"}</span>
                            {acc.name}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <button
                disabled={loading || !amount || !description}
                type="submit"
                className={cn(
                  "w-full font-black text-xs uppercase tracking-[0.3em] py-5 rounded-2xl active:scale-[0.98] transition-all shadow-xl",
                  type === "EXPENSE" 
                    ? "bg-white text-black hover:bg-white/90 shadow-white/5" 
                    : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20"
                )}
              >
                {loading ? "Salvando..." : "Confirmar Fluxo"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

  );
}
