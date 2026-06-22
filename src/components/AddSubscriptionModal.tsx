"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Wallet, Tag, CreditCard, ChevronDown, Loader2, TrendingUp } from "lucide-react";
import { financialService } from "@/services/financialService";
import { cn, formatCurrency } from "@/lib/utils";
import { useSubscriptionModal } from "@/context/SubscriptionModalContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { useRouter } from "next/navigation";
import { useFinancialData } from "@/context/FinancialDataContext";
import { StatusModal } from "./StatusModal";

function getSafeLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }
  return new Date(dateStr);
}

function getTodayISOString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AddSubscriptionModal() {
  const { isOpen, closeModal, editingSubscription } = useSubscriptionModal();
  const { userId } = useAccountModal();
  const router = useRouter();
  const { categories, accounts, refreshData } = useFinancialData();
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    status: "success" | "error" | "info";
    title: string;
    message: string;
  }>({
    isOpen: false,
    status: "info",
    title: "",
    message: "",
  });

  // Form State
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [day, setDay] = useState(new Date().getDate());
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [isPrimaryIncome, setIsPrimaryIncome] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<string>("monthly");
  const [customDays, setCustomDays] = useState("15");
  const [isCustom, setIsCustom] = useState(false);
  const [startDate, setStartDate] = useState(getTodayISOString());
  const [openFrequency, setOpenFrequency] = useState(false);
  
  // Pre-preencher se estiver editando
  useEffect(() => {
    if (isOpen) {
      if (editingSubscription) {
        let displayDesc = editingSubscription.description || "";
        
        // Extrair data de vencimento
        const match = displayDesc.match(/\s*\[[Vv]ence:\s*(\d{4}-\d{2})\]/);
        if (match) {
          setEndDate(match[1]);
          displayDesc = displayDesc.replace(match[0], "");
        } else {
          setEndDate("");
        }

        // Extrair frequência de metadados
        const freqMatch = displayDesc.match(/\s*\[[Ff]req:\s*every_(\d+)_days\]/);
        if (freqMatch) {
          const daysVal = freqMatch[1];
          setCustomDays(daysVal);
          setIsCustom(daysVal !== "14");
          setFrequency(daysVal === "14" ? "biweekly" : "custom");
          displayDesc = displayDesc.replace(freqMatch[0], "");
        } else {
          // Fallback para coluna oficial
          const dbFreq = editingSubscription.frequency || "monthly";
          if (dbFreq.startsWith("every_") && dbFreq.endsWith("_days")) {
            const match = dbFreq.match(/every_(\d+)_days/);
            if (match) {
              setCustomDays(match[1]);
            }
            setIsCustom(true);
            setFrequency("custom");
          } else {
            setIsCustom(false);
            setFrequency(dbFreq);
          }
        }

        setDescription(displayDesc);
        setAmount(((editingSubscription.amount_cents || 0) / 100).toString().replace(".", ","));
        setCategoryId(editingSubscription.category_id || "");
        setAccountId(editingSubscription.account_id || "");
        setType(editingSubscription.transaction_type || "EXPENSE");
        
        if (editingSubscription.next_date) {
          const dateObj = getSafeLocalDate(editingSubscription.next_date);
          setDay(dateObj.getDate());
          setStartDate(dateObj.toISOString().split("T")[0]);
        }
        setIsPrimaryIncome(editingSubscription.is_primary_income || false);
      } else {
        setDescription("");
        setAmount("");
        setCategoryId("");
        if (accounts.length > 0) setAccountId(accounts[0].id);
        setDay(new Date().getDate());
        setStartDate(getTodayISOString());
        setType("EXPENSE");
        setIsPrimaryIncome(false);
        setEndDate("");
        setIsCustom(false);
        setFrequency("monthly");
        setCustomDays("15");
      }
    }
  }, [editingSubscription, isOpen]); // Removido 'accounts' para evitar resets indesejados durante a digitação

  // Custom Select States
  const [openCategory, setOpenCategory] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const frequencyDropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setOpenAccount(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setOpenCategory(false);
      }
      if (frequencyDropdownRef.current && !frequencyDropdownRef.current.contains(e.target as Node)) {
        setOpenFrequency(false);
      }
    }
    if (openAccount || openCategory || openFrequency) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openAccount, openCategory, openFrequency]);

  useEffect(() => {
    if (isOpen && accounts.length > 0 && !editingSubscription) {
      if (!accountId || !accounts.find(a => a.id === accountId)) {
        setAccountId(accounts[0].id);
      }
    }
  }, [isOpen, accounts, editingSubscription]);

  // Sync category when type changes or on open
  useEffect(() => {
    if (!editingSubscription && categories.length > 0) {
      const currentCat = categories.find(c => c.id === categoryId);
      if (currentCat && currentCat.type === type) {
        return; // Mantém a categoria se já for do tipo certo
      }
      const firstOfType = categories.find(c => c.type === type);
      if (firstOfType) setCategoryId(firstOfType.id);
    }
  }, [type, categories, editingSubscription, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const amountCents = Math.round(parseFloat(amount.replace(/\./g, "").replace(",", ".")) * 100);
    
    try {
      // Calcular a próxima data baseada na frequência escolhida
      let nextDate: Date;
      if (isCustom || frequency === "weekly" || frequency === "biweekly") {
        // Para fluxos de intervalo regular, usamos a data de início exata com proteção de timezone
        nextDate = new Date(startDate + "T12:00:00");
      } else {
        // Para fluxos fixos mensais/anuais, calculamos o próximo dia no mês atual/seguinte
        nextDate = new Date();
        nextDate.setDate(day);
        if (nextDate < new Date() && !editingSubscription) {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
      }

      // Fallback para categorias caso esteja vazio (o banco exige category_id)
      let finalCategoryId = categoryId;
      if (!finalCategoryId || finalCategoryId.trim() === "") {
        const firstOfType = categories.find(c => c.type === type);
        if (firstOfType) {
          finalCategoryId = firstOfType.id;
        } else {
          throw new Error("Nenhuma categoria encontrada para este tipo de transação. Por favor, crie uma categoria primeiro.");
        }
      }

      let finalDescription = description.trim();
      let dbFrequency = frequency;

      if (frequency === "custom") {
        dbFrequency = "daily"; // passa no CHECK do Supabase
        finalDescription += ` [Freq: every_${customDays}_days]`;
      } else if (frequency === "biweekly") {
        dbFrequency = "weekly"; // passa no CHECK do Supabase
        finalDescription += ` [Freq: every_14_days]`;
      }

      if (endDate) {
        finalDescription += ` [Vence: ${endDate}]`;
      }

      const payload: any = {
        ...(editingSubscription ? { id: editingSubscription.id } : {}),
        user_id: userId,
        account_id: accountId,
        category_id: finalCategoryId,
        description: finalDescription,
        amount_cents: amountCents,
        transaction_type: type,
        frequency: dbFrequency,
        next_date: nextDate.toISOString(),
        status: editingSubscription ? editingSubscription.status : "active",
        is_primary_income: type === "INCOME" ? isPrimaryIncome : false
      };

      const { error } = await financialService.upsertRecurringTransaction(payload);

      if (!error) {
        setStatusModal({
          isOpen: true,
          status: "success",
          title: editingSubscription ? "Fluxo Atualizado" : "Fluxo Criado",
          message: editingSubscription 
            ? `O fluxo "${description}" foi atualizado com sucesso.`
            : `O fluxo "${description}" foi criado com sucesso.`
        });
        await refreshData();
        setDescription("");
        setAmount("");
        setEndDate("");
      } else {
        console.error("Erro ao salvar fluxo:", error);
        setStatusModal({
          isOpen: true,
          status: "error",
          title: "Erro ao Salvar",
          message: `Não foi possível salvar o fluxo: ${error.message || "Erro desconhecido"}`
        });
      }
    } catch (err: any) {
      console.error("Exceção ao salvar fluxo:", err);
      setStatusModal({
        isOpen: true,
        status: "error",
        title: "Erro Inesperado",
        message: "Ocorreu um erro ao processar sua solicitação."
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <div key="subscription-modal-overlay" data-testid="add-subscription-modal" className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
                      data-testid={`subscription-type-${t}`}
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
                    data-testid="subscription-description-input"
                    placeholder={type === "EXPENSE" ? "Ex: Netflix, Internet, Aluguel" : "Ex: Salário, Pro-labore, Pensão"}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">
                      {frequency === "monthly" ? "Valor Mensal" : frequency === "biweekly" ? "Valor Quinzenal" : frequency === "weekly" ? "Valor Semanal" : frequency === "yearly" ? "Valor Anual" : `Valor a cada ${customDays} dias`}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-sm">R$</span>
                      <input
                        placeholder="0,00"
                        data-testid="subscription-amount-input"
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
                    {isCustom || frequency === "weekly" || frequency === "biweekly" ? (
                      <>
                        <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Data de Início</label>
                        <input
                          type="date"
                          data-testid="subscription-start-date-input"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-bold tabular-nums"
                          required
                        />
                      </>
                    ) : (
                      <>
                        <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Dia do Vencimento</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          data-testid="subscription-day-input"
                          value={day}
                          onChange={(e) => setDay(parseInt(e.target.value))}
                          className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 transition-all font-bold tabular-nums no-spinner"
                          required
                        />
                      </>
                    )}
                  </div>
                </div>

                {type === "INCOME" && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between group hover:bg-emerald-500/10 transition-all cursor-pointer"
                       onClick={() => setIsPrimaryIncome(!isPrimaryIncome)}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                        isPrimaryIncome ? "bg-emerald-500 text-white" : "bg-white/5 text-white/20"
                      )}>
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white">Renda Principal</p>
                        <p className="text-[10px] text-white/40 font-medium">Usar para cálculo de teto dinâmico</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-6 rounded-full p-1 transition-all duration-300",
                      isPrimaryIncome ? "bg-emerald-500" : "bg-white/10"
                    )}>
                      <div className={cn(
                        "w-4 h-4 rounded-full bg-white transition-all duration-300",
                        isPrimaryIncome ? "translate-x-4" : "translate-x-0"
                      )} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">
                    Válido até (Opcional)
                  </label>
                  <input
                    type="month"
                    data-testid="subscription-end-date-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#111111]/50 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-violet-500/50 focus:bg-white/5 transition-all font-bold tabular-nums"
                  />
                  <p className="text-[9px] text-white/30 px-1 leading-relaxed">
                    Deixe em branco para fluxo contínuo. Se definido, o gasto ou receita deixará de ser projetado nos meses posteriores ao mês escolhido (útil para faculdade, aluguel temporário, etc).
                  </p>
                </div>

                {/* Seletor de Frequência Custom Select */}
                <div className="space-y-2 relative" ref={frequencyDropdownRef}>
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Frequência de Recorrência</label>
                  <div 
                    onClick={() => {
                      setOpenFrequency(!openFrequency);
                      setOpenCategory(false);
                      setOpenAccount(false);
                    }}
                    data-testid="subscription-frequency-select"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white font-bold flex justify-between items-center transition-all cursor-pointer hover:border-white/10"
                  >
                    <span>
                      {frequency === "monthly" ? "Mensal" : frequency === "biweekly" ? "Quinzenal" : frequency === "weekly" ? "Semanal" : frequency === "yearly" ? "Anual" : `Personalizado (${customDays} dias)`}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", openFrequency && "rotate-180")} />
                  </div>
                  
                  <AnimatePresence>
                    {openFrequency && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute z-50 left-0 right-0 bottom-full mb-2 bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto"
                      >
                        {[
                          { val: "monthly", label: "Mensal" },
                          { val: "biweekly", label: "Quinzenal (A cada 14 dias)" },
                          { val: "weekly", label: "Semanal" },
                          { val: "yearly", label: "Anual" },
                          { val: "custom", label: "Personalizado..." }
                        ].map((freq) => (
                          <div
                            key={freq.val}
                            onClick={() => {
                              setFrequency(freq.val);
                              setIsCustom(freq.val === "custom");
                              setOpenFrequency(false);
                            }}
                            className={cn(
                              "px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-0",
                              freq.val === frequency && "bg-violet-500/10 text-violet-300"
                            )}
                            data-testid={`frequency-option-${freq.val}`}
                          >
                            {freq.label}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Input Deslizante Personalizado */}
                <AnimatePresence>
                  {isCustom && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden space-y-2 bg-white/2 border border-white/5 rounded-2xl p-4"
                    >
                      <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Definir Intervalo (Dias)</label>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/40 font-bold">Repetir a cada</span>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          data-testid="subscription-custom-days-input"
                          value={customDays}
                          onChange={(e) => setCustomDays(e.target.value)}
                          className="w-20 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-white text-center font-bold outline-none focus:border-violet-500/50 transition-all tabular-nums no-spinner"
                          required
                        />
                        <span className="text-xs text-white/40 font-bold">dias.</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                      data-testid="subscription-category-select"
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
                            key="no-category"
                            onClick={() => {
                              setCategoryId("");
                              setOpenCategory(false);
                            }}
                            className="px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-bold text-white/40 hover:text-white transition-colors border-b border-white/5 italic"
                          >
                            Nenhuma (Opcional)
                          </div>
                          {filteredCategories.map((cat, idx) => (
                            <div
                              key={cat.id || `cat-${idx}`}
                              onClick={() => {
                                setCategoryId(cat.id);
                                setOpenCategory(false);
                              }}
                              className={cn(
                                "px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-0",
                                cat.id === categoryId && "bg-violet-500/10 text-violet-300"
                              )}
                              data-testid={`category-option-${cat.id}`}
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
                      data-testid="subscription-account-select"
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
                          {accounts.map((acc, idx) => (
                            <div
                              key={acc.id || `acc-${idx}`}
                              onClick={() => {
                                setAccountId(acc.id);
                                setOpenAccount(false);
                              }}
                              className={cn(
                                "px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-medium text-white/80 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-center gap-3",
                                acc.id === accountId && "bg-violet-500/10 text-violet-300"
                              )}
                              data-testid={`account-option-${acc.id}`}
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
                  data-testid="subscription-submit-button"
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

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={() => {
          setStatusModal(prev => ({ ...prev, isOpen: false }));
          if (statusModal.status === "success") {
            closeModal();
            router.refresh();
          }
        }}
        type={statusModal.status}
        title={statusModal.title}
        message={statusModal.message}
      />
    </>
  );
}
