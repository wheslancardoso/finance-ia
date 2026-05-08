"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Landmark, CreditCard, Banknote, RefreshCw, Check, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { cn, formatCurrency, getTransactionInvoiceMonth } from "@/lib/utils";
import { useAccountModal } from "@/context/AccountModalContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AddAccountModal() {
  const { isOpen, accountToEdit, closeModal, familyGroupId } = useAccountModal();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState("CHECKING");
  const [balance, setBalance] = useState("");
  const [colorHex, setColorHex] = useState("#7C3AED");
  
  // Credit Card Fields
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDay, setClosingDay] = useState(10);
  const [dueDay, setDueDay] = useState(15);

  // Invoice Sync State
  const [invoiceRealValue, setInvoiceRealValue] = useState("");
  const [calculatedInvoice, setCalculatedInvoice] = useState(0);
  const [invoiceMonthLabel, setInvoiceMonthLabel] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setBalance((accountToEdit.balance_cents / 100).toString().replace(".", ","));
        setColorHex(accountToEdit.color_hex);
        setCreditLimit(accountToEdit.credit_limit_cents ? (accountToEdit.credit_limit_cents / 100).toString().replace(".", ",") : "");
        setClosingDay(accountToEdit.closing_day || 10);
        setDueDay(accountToEdit.due_day || 15);
      } else {
        resetForm();
      }
    }
  }, [isOpen]);

  // Calculate current invoice when editing a credit card
  useEffect(() => {
    if (isOpen && accountToEdit && accountToEdit.type === "CREDIT_CARD") {
      calculateCurrentInvoice();
    }
  }, [isOpen, accountToEdit]);

  async function calculateCurrentInvoice() {
    if (!accountToEdit) return;
    const supabase = createClient();
    // Buscar TODAS as transações (EXPENSE e INCOME) para calcular valor líquido
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", accountToEdit.id);
    if (!transactions) return;
    const cDay = accountToEdit.closing_day || 31;
    const todayInvoice = getTransactionInvoiceMonth(new Date().toISOString(), cDay);
    const invoiceTotal = transactions
      .filter(tx => {
        const txInv = getTransactionInvoiceMonth(tx.date, cDay);
        return txInv.year === todayInvoice.year && txInv.month === todayInvoice.month;
      })
      .reduce((sum, tx) => {
        if (tx.transaction_type === "EXPENSE") return sum + (tx.amount_cents || 0);
        if (tx.transaction_type === "INCOME") return sum - (tx.amount_cents || 0);
        return sum;
      }, 0);
    setCalculatedInvoice(invoiceTotal);
    setInvoiceMonthLabel(
      format(new Date(todayInvoice.year, todayInvoice.month, 1), "MMMM 'de' yyyy", { locale: ptBR })
    );
  }

  function resetForm() {
    setName("");
    setType("CHECKING");
    setBalance("");
    setColorHex("#7C3AED");
    setCreditLimit("");
    setClosingDay(10);
    setDueDay(15);
    setInvoiceRealValue("");
    setCalculatedInvoice(0);
    setSyncSuccess(false);
  }

  async function handleSyncInvoice() {
    if (!accountToEdit || !invoiceRealValue) return;
    setSyncLoading(true);
    const supabase = createClient();
    const realCents = Math.round(parseFloat(invoiceRealValue.replace(",", ".")) * 100);
    const difference = realCents - calculatedInvoice;
    if (difference === 0) {
      setSyncLoading(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      return;
    }
    const cDay = accountToEdit.closing_day || 31;
    const todayInvoice = getTransactionInvoiceMonth(new Date().toISOString(), cDay);
    // Data: dia do fechamento do mês anterior para cair na fatura correta
    const adjDate = new Date(todayInvoice.year, todayInvoice.month - 1, cDay);
    const { error } = await supabase.from("transactions").insert([{
      account_id: accountToEdit.id,
      category_id: null,
      amount_cents: Math.abs(difference),
      transaction_type: difference > 0 ? "EXPENSE" : "INCOME",
      date: adjDate.toISOString(),
      description: `Ajuste de Fatura \u2014 ${format(new Date(todayInvoice.year, todayInvoice.month, 1), "MMM/yy", { locale: ptBR })}`,
      source: "MANUAL",
      installment_current: 1,
      installment_total: 1,
      is_legacy_debt: false,
      is_paid: false,
    }]);
    if (!error) {
      setSyncSuccess(true);
      setInvoiceRealValue("");
      await calculateCurrentInvoice();
      router.refresh();
      setTimeout(() => setSyncSuccess(false), 3000);
    } else {
      console.error("Erro ao criar ajuste:", error);
      alert("Erro ao criar transação de ajuste.");
    }
    setSyncLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Sessão expirada.");
      setLoading(false);
      return;
    }

    if (!familyGroupId && !accountToEdit) {
      alert("Erro: ID do grupo familiar não encontrado. Tente atualizar a página.");
      setLoading(false);
      return;
    }

    const balanceCents = Math.round(parseFloat(balance.replace(",", ".")) * 100);
    const limitCents = creditLimit ? Math.round(parseFloat(creditLimit.replace(",", ".")) * 100) : 0;

    const payload: any = {
      name,
      type,
      balance_cents: balanceCents,
      color_hex: colorHex,
      credit_limit_cents: limitCents,
      closing_day: type === "CREDIT_CARD" ? closingDay : null,
      due_day: type === "CREDIT_CARD" ? dueDay : null,
    };

    let error;
    if (accountToEdit) {
      const { error: err } = await supabase.from("accounts").update(payload).eq("id", accountToEdit.id);
      error = err;
    } else {
      payload.family_group_id = familyGroupId;
      const { error: err } = await supabase.from("accounts").insert([payload]);
      error = err;
    }

    if (!error) {
      closeModal();
      router.refresh();
    } else {
      console.error("Erro Supabase:", error);
      alert("Erro ao salvar conta no banco de dados.");
    }
    setLoading(false);
  }

  const accountTypes = [
    { id: "CHECKING", label: "Corrente", icon: Wallet },
    { id: "SAVINGS", label: "Investimento", icon: Landmark },
    { id: "CREDIT_CARD", label: "Cartão", icon: CreditCard },
    { id: "CASH", label: "Dinheiro", icon: Banknote },
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
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {accountToEdit ? "Ajustar Conta" : "Nova Conta"}
                </h2>
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">Configuração de Ativo</p>
              </div>
              <button onClick={closeModal} className="text-white/20 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type Grid */}
              <div className="grid grid-cols-4 gap-2">
                {accountTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                      type === t.id ? "bg-white/10 border-white/20" : "bg-transparent border-white/5 opacity-40"
                    )}
                  >
                    <t.icon className="w-4 h-4 text-white" />
                    <span className="text-[8px] font-black uppercase tracking-tighter">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Identificação</label>
                  <input
                    placeholder="Ex: Nubank, Itaú..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-white/20 transition-all font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">
                    {type === "CREDIT_CARD" ? "Gasto Acumulado (Débito)" : "Saldo"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold">R$</span>
                    <input
                      placeholder="0,00"
                      value={type === "CREDIT_CARD" ? balance.replace("-", "") : balance}
                      onChange={(e) => setBalance(e.target.value)}
                      disabled={type === "CREDIT_CARD"}
                      className={cn(
                        "w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-white text-xl font-bold outline-none transition-all tabular-nums",
                        type === "CREDIT_CARD" ? "opacity-50 cursor-not-allowed border-violet-500/20" : "focus:border-white/20"
                      )}
                      required
                    />
                  </div>
                  {type === "CREDIT_CARD" && (
                    <p className="text-[9px] text-violet-400/60 font-bold uppercase tracking-tighter px-1">
                      Calculado automaticamente via transações
                    </p>
                  )}
                </div>

                {type === "CREDIT_CARD" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-white/2 rounded-3xl border border-white/5 space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Limite Total</label>
                      <input
                        placeholder="Ex: 5.000,00"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 py-2 text-white font-bold outline-none focus:border-violet-500/50"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Fechamento (Dia)</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={closingDay}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setClosingDay(val);
                            
                            // Cálculo automático: Fechamento + 7 dias
                            let calculatedDue = val + 7;
                            if (calculatedDue > 31) calculatedDue -= 31;
                            if (calculatedDue === 0) calculatedDue = 1;
                            setDueDay(calculatedDue);
                          }}
                          className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white font-bold outline-none tabular-nums no-spinner"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-widest px-1">Vencimento (Dia)</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={dueDay}
                          onChange={(e) => setDueDay(parseInt(e.target.value) || 1)}
                          className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white font-bold outline-none tabular-nums no-spinner"
                          required
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Sincronizar Fatura */}
                {type === "CREDIT_CARD" && accountToEdit && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-violet-500/5 rounded-3xl border border-violet-500/10 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Sincronizar Fatura</h4>
                        <p className="text-[9px] text-white/20 font-bold capitalize">{invoiceMonthLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Calculado</p>
                        <p className="text-sm font-bold text-white/60 tabular-nums">{formatCurrency(calculatedInvoice)}</p>
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold">R$</span>
                      <input
                        placeholder="Valor real da fatura"
                        value={invoiceRealValue}
                        onChange={(e) => { setInvoiceRealValue(e.target.value); setSyncSuccess(false); }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-white font-bold outline-none focus:border-violet-500/50 tabular-nums"
                      />
                    </div>

                    {invoiceRealValue && (() => {
                      const realCents = Math.round(parseFloat(invoiceRealValue.replace(",", ".")) * 100) || 0;
                      const diff = realCents - calculatedInvoice;
                      if (diff === 0) return (
                        <p className="text-[10px] font-bold text-emerald-400 text-center uppercase tracking-widest">✓ Valores conferem</p>
                      );
                      return (
                        <div className={cn(
                          "flex items-center justify-between p-3 rounded-xl border",
                          diff > 0 ? "bg-red-500/5 border-red-500/10" : "bg-emerald-500/5 border-emerald-500/10"
                        )}>
                          <div className="flex items-center gap-2">
                            {diff > 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-red-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                              {diff > 0 ? "Acréscimo" : "Pgto. Antecipado"}
                            </span>
                          </div>
                          <span className={cn("text-sm font-bold tabular-nums", diff > 0 ? "text-red-400" : "text-emerald-400")}>
                            {diff > 0 ? "+" : "-"} {formatCurrency(Math.abs(diff))}
                          </span>
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={handleSyncInvoice}
                      disabled={syncLoading || !invoiceRealValue || syncSuccess}
                      className={cn(
                        "w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        syncSuccess
                          ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                          : "bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 disabled:opacity-40"
                      )}
                    >
                      {syncLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : syncSuccess ? (
                        <><Check className="w-3.5 h-3.5" /> Sincronizado</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5" /> Sincronizar</>
                      )}
                    </button>
                  </motion.div>
                )}

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
                    disabled={loading}
                    type="submit"
                    className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-[0.98] shadow-xl"
                    style={{ backgroundColor: colorHex, color: '#fff' }}
                  >
                    {loading ? "Salvando..." : accountToEdit ? "Salvar" : "Criar Conta"}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
