"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Wallet, Tag, PencilLine, CreditCard, Layers, Sparkles, TrendingUp } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { usePathname, useRouter } from "next/navigation";
import { addMonths } from "date-fns";

interface Category {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
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
  const [installments, setInstallments] = useState(1);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (transactionToEdit) {
        setAmount((transactionToEdit.amount_cents / 100).toString().replace(".", ","));
        setDescription(transactionToEdit.description);
        setCategoryId(transactionToEdit.category_id);
        setAccountId(transactionToEdit.account_id);
        setType(transactionToEdit.transaction_type);
        setInstallments(1);
      } else {
        resetForm();
      }
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

    const familyGroupId = familyMember.family_group_id;

    const { data: catData } = await supabase
      .from("categories")
      .select("id, name")
      .eq("family_group_id", familyGroupId);

    const { data: accData } = await supabase
      .from("accounts")
      .select("id, name, type, balance_cents")
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
    const totalAmountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    const installmentAmountCents = Math.floor(totalAmountCents / installments);

    const basePayload = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: type,
    };

    let errorOccurred = false;

    if (transactionToEdit) {
      const { error } = await supabase
        .from("transactions")
        .update({
          ...basePayload,
          amount_cents: totalAmountCents,
          description,
        })
        .eq("id", transactionToEdit.id);
      if (error) errorOccurred = true;
    } else {
      const transactionsToInsert = [];
      const now = new Date();

      for (let i = 0; i < installments; i++) {
        const installmentDate = addMonths(now, i);
        const installmentDesc = installments > 1 
          ? `${description} (${i + 1}/${installments})`
          : description;

        transactionsToInsert.push({
          ...basePayload,
          amount_cents: installmentAmountCents,
          description: installmentDesc,
          date: installmentDate.toISOString(),
        });
      }

      const { error } = await supabase.from("transactions").insert(transactionsToInsert);
      if (error) errorOccurred = true;
    }

    if (!errorOccurred) {
      closeModal();
      router.refresh();
    } else {
      alert("Erro ao salvar transação");
    }
    setLoading(false);
  }

  function resetForm() {
    setAmount("");
    setDescription("");
    setInstallments(1);
  }

  const selectedAccount = accounts.find(a => a.id === accountId);
  const isCreditCard = selectedAccount?.type === "CREDIT_CARD";

  return (
    <>
      <button
        onClick={openAdd}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-violet-600 text-white shadow-2xl shadow-violet-600/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border border-white/20"
      >
        <Plus className="w-8 h-8" />
      </button>

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
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              {/* Top Accent Line */}
              <div className={cn(
                "absolute top-0 left-0 w-full h-[2px] transition-colors duration-500",
                type === "EXPENSE" ? "bg-red-500/50" : "bg-emerald-500/50"
              )} />

              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {transactionToEdit ? "Ajustar Registro" : "Novo Lançamento"}
                  </h2>
                  <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">Fluxo de Caixa Vesper</p>
                </div>
                <button onClick={closeModal} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Type Toggle - Agilidade */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 w-full">
                  {(["EXPENSE", "INCOME"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest",
                        type === t
                          ? "bg-white/10 text-white shadow-inner"
                          : "text-white/20 hover:text-white/40"
                      )}
                    >
                      {t === "EXPENSE" ? "Saída" : "Entrada"}
                    </button>
                  ))}
                </div>

                {/* Amount Section - FOCO TOTAL */}
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl font-bold text-white/20">R$</span>
                    <input
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={cn(
                        "bg-transparent text-6xl font-black outline-none w-full max-w-[280px] text-center placeholder:text-white/5 tabular-nums transition-colors",
                        type === "EXPENSE" ? "text-white" : "text-emerald-400"
                      )}
                    />
                  </div>
                  
                  {/* Contexto Nubank: Mostrar Saldo da Conta Selecionada */}
                  <AnimatePresence mode="wait">
                    {selectedAccount && (
                      <motion.div 
                        key={selectedAccount.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30"
                      >
                        <Wallet className="w-3 h-3" />
                        <span>Saldo em {selectedAccount.name}:</span>
                        <span className="text-white/60">{formatCurrency(selectedAccount.balance_cents)}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-6">
                  {/* Description Input */}
                  <div className="relative group">
                    <label className="absolute -top-2.5 left-5 bg-[#0A0A0A] px-2 text-[9px] font-black text-white/20 uppercase tracking-widest group-focus-within:text-violet-400 transition-colors z-10">Descrição</label>
                    <div className="relative">
                      <PencilLine className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" />
                      <input
                        placeholder="O que você comprou/recebeu?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] py-5 pl-14 pr-4 text-white text-lg font-medium outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-white/5"
                        required
                      />
                    </div>
                  </div>

                  {/* Dropdowns Visualizados como Selectors */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-4">Conta</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          {isCreditCard ? <CreditCard className="w-4 h-4 text-violet-400" /> : <Wallet className="w-4 h-4 text-white/20" />}
                        </div>
                        <select
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-violet-500/50 appearance-none font-bold"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id} className="bg-black text-white">
                              {acc.type === "CREDIT_CARD" ? `💳 ${acc.name}` : acc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-4">Categoria</label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                        <select
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-violet-500/50 appearance-none font-bold"
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-black text-white">{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Parcelamento Smart */}
                  {type === "EXPENSE" && (
                    <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[32px] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-white/20" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Parcelar Gasto</p>
                            <p className="text-[8px] text-white/20 font-bold uppercase">Projetar no futuro</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/40 rounded-xl p-1.5 border border-white/5">
                          {[1, 2, 3, 6, 12].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setInstallments(num)}
                              className={cn(
                                "w-9 h-9 rounded-lg text-[10px] font-black transition-all",
                                installments === num 
                                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/40" 
                                  : "text-white/20 hover:text-white/40"
                              )}
                            >
                              {num}x
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {installments > 1 && (
                        <div className="flex items-center gap-2 p-3 bg-violet-500/5 rounded-xl border border-violet-500/10">
                          <Sparkles className="w-3 h-3 text-violet-400" />
                          <p className="text-[10px] text-violet-400/80 font-bold italic">
                            {installments} parcelas de {((parseFloat(amount.replace(",", ".")) || 0) / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} agendadas.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  disabled={loading || !amount || !description}
                  type="submit"
                  className={cn(
                    "w-full font-black text-xs uppercase tracking-[0.4em] py-6 rounded-[24px] transition-all shadow-2xl active:scale-[0.98] mt-4",
                    type === "EXPENSE" 
                      ? "bg-white text-black hover:bg-white/90" 
                      : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20"
                  )}
                >
                  {loading ? "Processando..." : transactionToEdit ? "Atualizar" : "Confirmar Lançamento"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
