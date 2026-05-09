"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Wallet, Tag, PencilLine, CreditCard, Layers, Sparkles, TrendingUp, Calendar, ChevronDown, Clock, Hash, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { usePathname, useRouter } from "next/navigation";
import { addMonths, format, isBefore, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFinancialData } from "@/context/FinancialDataContext";

interface Category {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
  credit_limit_cents?: number;
}

export function AddTransactionModal() {
  const { isOpen, transactionToEdit, closeModal, openAdd } = useTransactionModal();
  const { familyGroupId } = useAccountModal();
  const router = useRouter();
  const pathname = usePathname();

  const { categories, accounts, loading: contextLoading, refreshData } = useFinancialData();

  const [loading, setLoading] = useState(false);

  // Form State
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [installments, setInstallments] = useState(1);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionTime, setTransactionTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  const [isLegacyDebt, setIsLegacyDebt] = useState(false);

  // Custom Select States
  const [openCategory, setOpenCategory] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [editAllInstallments, setEditAllInstallments] = useState(false);

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

  // Automatização da Dívida Legada
  useEffect(() => {
    if (!transactionDate || transactionToEdit) return; // Não sobrescreve se estiver editando
    
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    
    try {
      const [year, month, day] = transactionDate.split('-').map(Number);
      const txDate = new Date(year, month - 1, day);

      if (!isNaN(txDate.getTime())) {
        const shouldBeLegacy = isBefore(txDate, currentMonthStart);
        if (shouldBeLegacy !== isLegacyDebt) {
          console.log(`Dívida Legada Automática: ${shouldBeLegacy ? 'DETECTADA' : 'REMOVIDA'} (Data: ${transactionDate})`);
          setIsLegacyDebt(shouldBeLegacy);
        }
      }
    } catch (e) {
      console.error("Erro ao processar data para dívida legada", e);
    }
  }, [transactionDate, transactionToEdit, isLegacyDebt]);

  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        const valCents = transactionToEdit.amount_cents || (transactionToEdit.amount ? transactionToEdit.amount : 0);
        // Para parceladas, mostra o valor TOTAL da compra (parcela × total)
        const displayCents = transactionToEdit.installment_total > 1
          ? valCents * transactionToEdit.installment_total
          : valCents;
        setAmount((displayCents / 100).toString().replace(".", ","));
        setDescription(transactionToEdit.description);
        setCategoryId(transactionToEdit.category_id);
        setAccountId(transactionToEdit.account_id);
        setType(transactionToEdit.transaction_type || transactionToEdit.type || "EXPENSE");
        setInstallments(1);
        setIsLegacyDebt(transactionToEdit.is_legacy_debt || false);
        const dateObj = new Date(transactionToEdit.date);

        // Se for uma parcela, sempre editar a série a partir da primeira
        if (transactionToEdit.installment_total > 1) {
          setInstallments(transactionToEdit.installment_total);
          setEditAllInstallments(true);
          // Calcula a data da PRIMEIRA parcela subtraindo o offset
          const firstInstallmentDate = addMonths(dateObj, -(transactionToEdit.installment_current - 1));
          setTransactionDate(firstInstallmentDate.toISOString().split('T')[0]);
          setTransactionTime(firstInstallmentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } else {
          setInstallments(1);
          setEditAllInstallments(false);
          setTransactionDate(dateObj.toISOString().split('T')[0]);
          setTransactionTime(dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        resetForm();
      }
    }
  }, [isOpen, transactionToEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // IMPORTANTE: Capturar valores do estado AGORA, antes de qualquer await.
    // O refreshData() causa re-render que pode resetar o estado de installments.
    const capturedInstallments = installments < 1 ? 1 : installments;
    const capturedAmount = amount;
    const capturedAccountId = accountId;
    const capturedCategoryId = categoryId;
    const capturedType = type;
    const capturedDescription = description;
    const capturedIsLegacyDebt = isLegacyDebt;

    try {
      if (!capturedAccountId || !capturedAmount || !familyGroupId) {
        alert("Por favor, preencha a conta e o valor. (ID do grupo familiar não encontrado)");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const totalAmountCents = Math.round(parseFloat(capturedAmount.replace(",", ".")) * 100);

      // O valor inserido é sempre o TOTAL da compra.
      // Dividimos pelo número de parcelas para obter o valor de cada parcela.
      const installmentAmountCents = Math.floor(totalAmountCents / capturedInstallments);

      const basePayload = {
        family_group_id: familyGroupId,
        account_id: capturedAccountId,
        category_id: (capturedCategoryId && capturedCategoryId.trim() !== "") ? capturedCategoryId : null,
        transaction_type: capturedType,
        is_legacy_debt: capturedIsLegacyDebt,
        is_paid: true,
        source: "MANUAL",
      };

      let errorOccurred = false;

      // Formatar a data/hora
      let finalDateISO: string;
      try {
        const dateStr = `${transactionDate}T${transactionTime}:00`;
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) throw new Error("Data inválida");
        finalDateISO = dateObj.toISOString();
      } catch (err) {
        alert("Data ou hora inválida.");
        setLoading(false);
        return;
      }

      if (transactionToEdit) {
        // --- LOGICA DE SINCRONIZAÇÃO COM METAS (Aportes) ---
        const isOldAporte = transactionToEdit.description?.startsWith("Aporte: ");
        const isNewAporte = capturedDescription.startsWith("Aporte: ");

        if (isOldAporte) {
          const oldGoalName = transactionToEdit.description.replace("Aporte: ", "");
          const { data: oldGoal } = await supabase
            .from("goals")
            .select("*")
            .eq("name", oldGoalName)
            .eq("family_group_id", familyGroupId)
            .maybeSingle();

          if (oldGoal) {
            await supabase.from("goals").update({
              current_amount_cents: Math.max(0, (oldGoal.current_amount_cents || 0) - transactionToEdit.amount_cents)
            }).eq("id", oldGoal.id);
          }
        }

        if (isNewAporte) {
          const newGoalName = capturedDescription.replace("Aporte: ", "");
          const { data: newGoal } = await supabase
            .from("goals")
            .select("*")
            .eq("name", newGoalName)
            .eq("family_group_id", familyGroupId)
            .maybeSingle();

          if (newGoal) {
            await supabase.from("goals").update({
              current_amount_cents: (newGoal.current_amount_cents || 0) + totalAmountCents
            }).eq("id", newGoal.id);
          }
        }
        // --------------------------------------------------

        // Logica de Edição Existente
        if (transactionToEdit.installment_total > 1) {
          // Sempre editar a série quando for parcelado
          const installmentsChanged = capturedInstallments !== transactionToEdit.installment_total;
          // Compara a data da primeira parcela (o form já mostra a data corrigida da 1ª parcela)
          const originalFirstDate = addMonths(new Date(transactionToEdit.date), -(transactionToEdit.installment_current - 1));
          const dateChanged = new Date(finalDateISO).toISOString().split('T')[0] !== originalFirstDate.toISOString().split('T')[0];
          // Compara o valor POR PARCELA (o form mostra o total, mas comparamos dividido)
          const amountChanged = installmentAmountCents !== transactionToEdit.amount_cents;

          if (installmentsChanged || dateChanged || amountChanged) {
            console.log("AddTransactionModal: Mudança estrutural detectada", { installmentsChanged, dateChanged, amountChanged });

            // Se mudou algo estrutural, deletamos e recriamos
            const { error: deleteError } = await supabase
              .from("transactions")
              .delete()
              .eq("description", transactionToEdit.description)
              .eq("installment_total", transactionToEdit.installment_total)
              .eq("account_id", transactionToEdit.account_id);

            if (deleteError) {
              console.error("AddTransactionModal: Erro ao deletar série antiga:", deleteError);
              errorOccurred = true;
            } else {
              // Inserir nova série
              const transactionsToInsert = [];
              const [startYear, startMonth, startDay] = transactionDate.split('-').map(Number);
              const startDate = new Date(startYear, startMonth - 1, startDay);

              for (let i = 0; i < capturedInstallments; i++) {
                const installmentDate = addMonths(startDate, i);
                const dayStr = format(installmentDate, 'yyyy-MM-dd');

                transactionsToInsert.push({
                  ...basePayload,
                  amount_cents: installmentAmountCents,
                  description: capturedDescription,
                  date: new Date(`${dayStr}T${transactionTime}:00`).toISOString(),
                  installment_current: i + 1,
                  installment_total: capturedInstallments,
                });
              }

              console.log("AddTransactionModal: Re-inserindo série", transactionsToInsert);
              const { error: insertError } = await supabase.from("transactions").insert(transactionsToInsert);
              if (insertError) {
                console.error("AddTransactionModal: Erro ao re-inserir série:", insertError);
                errorOccurred = true;
              }
            }
          } else {
            // Se apenas mudou descrição ou categoria, atualizamos em massa
            console.log("AddTransactionModal: Atualizando apenas campos não estruturais");
            const { error: groupError } = await supabase
              .from("transactions")
              .update({
                account_id: capturedAccountId,
                category_id: (capturedCategoryId && capturedCategoryId.trim() !== "") ? capturedCategoryId : null,
                description: capturedDescription,
                is_legacy_debt: capturedIsLegacyDebt,
              })
              .eq("description", transactionToEdit.description)
              .eq("installment_total", transactionToEdit.installment_total)
              .eq("account_id", transactionToEdit.account_id);

            if (groupError) {
              console.error("AddTransactionModal: Erro ao atualizar grupo:", groupError);
              errorOccurred = true;
            }
          }
        } else {
          // Editar apenas ESTA transação normal
          console.log("AddTransactionModal: Atualizando transação simples");
          const { error } = await supabase
            .from("transactions")
            .update({
              ...basePayload,
              amount_cents: totalAmountCents,
              description: capturedDescription,
              date: finalDateISO,
            })
            .eq("id", transactionToEdit.id);

          if (error) {
            console.error("AddTransactionModal: Erro ao atualizar transação simples:", error);
            errorOccurred = true;
          }
        }
      } else {
        const transactionsToInsert = [];
        const [startYear, startMonth, startDay] = transactionDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);

        for (let i = 0; i < capturedInstallments; i++) {
          const installmentDate = addMonths(startDate, i);
          const dayStr = format(installmentDate, 'yyyy-MM-dd');

          transactionsToInsert.push({
            ...basePayload,
            amount_cents: installmentAmountCents,
            description: capturedDescription,
            date: new Date(`${dayStr}T${transactionTime}:00`).toISOString(),
            installment_current: i + 1,
            installment_total: capturedInstallments,
          });
        }

        const { error } = await supabase.from("transactions").insert(transactionsToInsert);
        if (error) {
          console.error("Erro ao inserir parcelas. Detalhes:", JSON.stringify(error, null, 2));
          console.error("Payload tentado:", JSON.stringify(transactionsToInsert, null, 2));
          errorOccurred = true;
        }
      }

      if (!errorOccurred) {
        await refreshData();
        closeModal();
        router.refresh();
      } else {
        alert("Erro ao salvar transação no banco de dados.");
      }
    } catch (err) {
      console.error("Erro no handleSubmit:", err);
      alert("Ocorreu um erro inesperado ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setAmount("");
    setDescription("");
    setInstallments(1);
    setIsLegacyDebt(false);
    setTransactionTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  }

  const selectedAccount = accounts.find(a => a.id === accountId);
  const showInstallments = type === "EXPENSE" && selectedAccount?.type === "CREDIT_CARD";

  // Reset installments if hidden — mas NÃO durante loading (submit em andamento)
  // nem durante edição de transação parcelada (evita race condition com refreshData)
  useEffect(() => {
    if (!showInstallments && !loading && !transactionToEdit) {
      setInstallments(1);
    }
  }, [showInstallments, loading, transactionToEdit]);

  const isCreditCard = selectedAccount?.type === "CREDIT_CARD";
  const numericAmount = parseFloat(amount.replace(",", ".")) || 0;

  const filteredCategories = categories.filter(c => c.type === type);

  // Sync category when type changes - ONLY if not editing
  useEffect(() => {
    if (!transactionToEdit && categories.length > 0) {
      const firstOfType = categories.find(c => c.type === type);
      if (firstOfType) setCategoryId(firstOfType.id);
    }
  }, [type, categories, transactionToEdit]);

  console.log("DEBUG - UI RENDER:", {
    categoriesCount: categories.length,
    filteredCount: filteredCategories.length,
    currentType: type,
    currentCategoryId: categoryId
  });

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
              className="relative w-full max-w-lg bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className={cn(
                "absolute top-0 left-0 w-full h-[2px] transition-colors duration-500",
                type === "EXPENSE" ? "bg-red-500/50" : "bg-emerald-500/50"
              )} />

              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {transactionToEdit ? "Editar Gasto" : "Novo Lançamento"}
                  </h2>
                  <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">Centro de Comando Vesper</p>
                </div>
                <button onClick={closeModal} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
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

                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl font-bold text-white/10">R$</span>
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

                  <AnimatePresence mode="wait">
                    {selectedAccount && (
                      <motion.div
                        key={selectedAccount.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30"
                      >
                        <Wallet className="w-3 h-3" />
                        <span>
                          {selectedAccount.type === "CREDIT_CARD" ? "Limite Disponível:" : `Saldo em ${selectedAccount.name}:`}
                        </span>
                        <span className="text-white/60">
                          {formatCurrency(
                            selectedAccount.type === "CREDIT_CARD"
                              ? (selectedAccount.credit_limit_cents || 0) + selectedAccount.balance_cents
                              : selectedAccount.balance_cents
                          )}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-2">
                  <div className="relative group">
                    <label className="absolute -top-2.5 left-5 bg-[#0A0A0A] px-2 text-[9px] font-black text-white/20 uppercase tracking-widest group-focus-within:text-violet-400 transition-colors z-10">
                      {type === "EXPENSE" ? "O que você comprou?" : "Descrição do Recebimento"}
                    </label>
                    <div className="relative">
                      <PencilLine className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" />
                      <input
                        placeholder={type === "EXPENSE" ? "Ex: Almoço, Netflix, Aluguel" : "Ex: Salário, Freela, Venda..."}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] py-5 px-14 text-white text-lg font-medium outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-white/5"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Conta Custom Select */}
                    <div className="space-y-2 relative" ref={accountDropdownRef}>
                      <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-4">Origem</label>
                      <div
                        onClick={() => {
                          if (accounts.length === 0) return;
                          setOpenAccount(!openAccount);
                          setOpenCategory(false);
                        }}
                        className={cn(
                          "w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm text-white font-bold flex justify-between items-center transition-all cursor-pointer hover:border-white/20",
                          accounts.length === 0 && !contextLoading && "opacity-80"
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {accounts.length === 0 ? (
                            <span className="flex items-center gap-2 text-white/30 italic">
                              {contextLoading && <Loader2 className="w-3 h-3 animate-spin text-violet-400" />}
                              {contextLoading ? "Buscando contas..." : "Nenhuma conta encontrada"}
                            </span>
                          ) : (() => {
                            const acc = accounts.find(a => a.id === accountId);
                            return acc ? (
                              <div className="flex items-center gap-2">
                                <span className="opacity-70">{acc.type === "CREDIT_CARD" ? "💳" : "💰"}</span>
                                {acc.name}
                              </div>
                            ) : (
                              <span className="text-white/40">Selecione a conta</span>
                            );
                          })()}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", openAccount && "rotate-180")} />
                      </div>

                      <AnimatePresence>
                        {openAccount && accounts.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 left-0 right-0 top-full mt-2 bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
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

                    {/* Categoria Custom Select */}
                    <div className="space-y-2 relative" ref={categoryDropdownRef}>
                      <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-4">Categoria</label>
                      <div
                        onClick={() => {
                          setOpenCategory(!openCategory);
                          setOpenAccount(false);
                        }}
                        className={cn(
                          "w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm text-white font-bold flex justify-between items-center transition-all cursor-pointer hover:border-white/20",
                          categories.length === 0 && !contextLoading && "opacity-80"
                        )}
                      >
                        <span className="truncate">
                          {categories.length === 0 ? (
                            <span className="flex items-center gap-2 text-white/30 italic">
                              {contextLoading && <Loader2 className="w-3 h-3 animate-spin text-violet-400" />}
                              {contextLoading ? "Buscando categorias..." : "Nenhuma categoria"}
                            </span>
                          ) : filteredCategories.length === 0 ? (
                            <span className="text-white/30 italic">
                              Sem categorias de {type === "EXPENSE" ? "Gasto" : "Receita"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-white">{categories.find(c => c.id === categoryId)?.name || "Selecione a categoria"}</span>
                              {contextLoading && <Loader2 className="w-2 h-2 animate-spin text-white/20" />}
                            </div>
                          )}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", openCategory && "rotate-180")} />
                      </div>

                      <AnimatePresence>
                        {openCategory && filteredCategories.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 left-0 right-0 top-full mt-2 bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
                          >
                            <div
                              onClick={() => {
                                setCategoryId("");
                                setOpenCategory(false);
                              }}
                              className="px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-bold text-white/40 hover:text-white transition-colors border-b border-white/5 italic"
                            >
                              Nenhuma (Deixar Vazio)
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
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-4">
                      <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Quando</label>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="date"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-violet-500/50 font-bold"
                          required
                        />
                      </div>
                      <div className="relative shrink-0 flex items-center gap-0 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={transactionTime.split(":")[0]}
                          onChange={(e) => {
                            let h = parseInt(e.target.value) || 0;
                            if (h > 23) h = 23;
                            if (h < 0) h = 0;
                            setTransactionTime(`${String(h).padStart(2, "0")}:${transactionTime.split(":")[1]}`);
                          }}
                          className="w-7 bg-transparent py-4 text-sm text-white outline-none font-bold text-center no-spinner tabular-nums"
                        />
                        <span className="text-white/40 font-bold text-sm">:</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={transactionTime.split(":")[1]}
                          onChange={(e) => {
                            let m = parseInt(e.target.value) || 0;
                            if (m > 59) m = 59;
                            if (m < 0) m = 0;
                            setTransactionTime(`${transactionTime.split(":")[0]}:${String(m).padStart(2, "0")}`);
                          }}
                          className="w-7 bg-transparent py-4 text-sm text-white outline-none font-bold text-center no-spinner tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Parcelas - Seção dedicada */}
                  {showInstallments && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-4">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Parcelas</label>
                        {installments <= 1 && (
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">À Vista</span>
                        )}
                      </div>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={installments === 0 ? "" : installments}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setInstallments(0);
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num) && num >= 0 && num <= 99) {
                                setInstallments(num);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (installments < 1) setInstallments(1);
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-sm text-white outline-none focus:border-violet-500/50 font-bold tabular-nums no-spinner"
                        />
                      </div>
                    </div>
                  )}

                  {/* Projeção de parcelas - compacta */}
                  {showInstallments && installments > 1 && (
                    <div className="flex items-center justify-between px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-white/20" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{installments}x</span>
                      </div>
                      <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full border border-violet-400/20">
                        Termina em {format(addMonths(new Date(transactionDate), installments - 1), "MMM 'de' yy", { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  {/* Dívida Legada - Info Automática */}
                  {isLegacyDebt && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Dívida Legada Detectada
                        </span>
                        <span className="text-[10px] text-white/40 font-medium">Este gasto retroativo não afetará o teto de gastos do mês atual.</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Toggle de edição em massa removido pois agora é o padrão via primeira parcela */}

                <button
                  disabled={loading || !amount || !description}
                  type="submit"
                  className={cn(
                    "w-full font-black text-xs uppercase tracking-[0.4em] py-6 rounded-[24px] transition-all shadow-2xl active:scale-[0.98] mt-2",
                    type === "EXPENSE"
                      ? "bg-white text-black hover:bg-white/90 shadow-white/5"
                      : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20"
                  )}
                >
                  {loading ? "Processando..." : transactionToEdit ? (editAllInstallments ? "Atualizar Série" : "Salvar Parcela") : "Ativar Registro"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
