"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Palette, Landmark, CreditCard, CalendarDays, Banknote, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { useAccountModal } from "@/context/AccountModalContext";

export function AddAccountModal() {
  const { isOpen, accountToEdit, closeModal } = useAccountModal();
  const router = useRouter();
  const pathname = usePathname();
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

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setBalance((accountToEdit.balance_cents / 100).toString());
        setColorHex(accountToEdit.color_hex);
        setCreditLimit(accountToEdit.credit_limit_cents ? (accountToEdit.credit_limit_cents / 100).toString() : "");
        setClosingDay(accountToEdit.closing_day || 10);
        setDueDay(accountToEdit.due_day || 15);
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
    setCreditLimit("");
    setClosingDay(10);
    setDueDay(15);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const { data: familyMember } = await supabase
      .from("family_members")
      .select("family_group_id")
      .eq("user_id", user.id)
      .single();

    if (!familyMember) {
      alert("Erro ao identificar seu grupo familiar.");
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
      const { error: err } = await supabase
        .from("accounts")
        .update(payload)
        .eq("id", accountToEdit.id);
      error = err;
    } else {
      payload.family_group_id = familyMember.family_group_id;
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
    { id: "CHECKING", label: "Corrente", icon: Wallet, desc: "Dia a dia" },
    { id: "SAVINGS", label: "Investimento", icon: Landmark, desc: "Seu futuro" },
    { id: "CREDIT_CARD", label: "Cartão", icon: CreditCard, desc: "Limite" },
    { id: "CASH", label: "Dinheiro", icon: Banknote, desc: "Espécie" },
  ];

  const MiniCalendarSelector = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</label>
        <span className="text-[10px] font-black text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-md border border-violet-400/20">Dia {value}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 p-2 bg-white/[0.02] border border-white/5 rounded-2xl">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            className={cn(
              "h-7 w-full rounded-lg text-[10px] font-bold transition-all flex items-center justify-center",
              value === day 
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/40 scale-110 z-10" 
                : "text-white/20 hover:text-white/60 hover:bg-white/5"
            )}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );

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
            className="relative w-full max-w-lg bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Top Glow Accent */}
            <div 
              className="absolute top-0 left-0 w-full h-[2px] opacity-50"
              style={{ background: `linear-gradient(90deg, transparent, ${colorHex}, transparent)` }}
            />

            <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {accountToEdit ? "Ajustar Ativo" : "Novo Ativo"}
                </h2>
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">Configuração de Ativo Vesper</p>
              </div>
              <button onClick={closeModal} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 pb-4">
              {/* Type Selection Grid */}
              <div className="grid grid-cols-4 gap-3">
                {accountTypes.map((t) => {
                  const isActive = type === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={cn(
                        "relative flex flex-col items-center gap-3 p-4 rounded-[28px] border transition-all duration-500",
                        isActive 
                          ? "bg-white/10 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                          : "bg-transparent border-white/5 opacity-40 hover:opacity-100"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-white/60")} style={isActive ? { color: colorHex } : {}} />
                      <span className={cn("text-[9px] font-bold uppercase tracking-tight", isActive ? "text-white" : "text-white/40")}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-6">
                <div className="grid gap-5">
                  <div className="relative group">
                    <label className="absolute -top-2.5 left-5 bg-[#0A0A0A] px-2 text-[9px] font-black text-white/20 uppercase tracking-widest group-focus-within:text-violet-400 transition-colors z-10">Nome da Conta</label>
                    <input
                      placeholder="Ex: Nubank Principal"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] py-5 px-6 text-white text-lg font-medium outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-white/5"
                      required
                    />
                  </div>

                  <div className="relative group">
                    <label className="absolute -top-2.5 left-5 bg-[#0A0A0A] px-2 text-[9px] font-black text-white/20 uppercase tracking-widest group-focus-within:text-violet-400 transition-colors z-10">
                      {type === "CREDIT_CARD" ? "Fatura Atual" : "Saldo em Conta"}
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-6 text-xl font-bold text-white/10">R$</span>
                      <input
                        placeholder="0,00"
                        value={balance}
                        onChange={(e) => setBalance(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] py-6 pl-16 pr-6 text-white text-3xl font-black outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-white/5 tabular-nums"
                        required
                      />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {type === "CREDIT_CARD" && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-8 p-6 bg-white/[0.03] rounded-[32px] border border-white/10"
                    >
                      <div className="relative group">
                        <label className="absolute -top-2.5 left-5 bg-[#0e0e0e] px-2 text-[9px] font-black text-violet-400/40 uppercase tracking-widest z-10">Limite de Crédito</label>
                        <input
                          placeholder="Ex: 5000,00"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                          className="w-full bg-transparent border-b border-white/10 py-4 px-2 text-white font-bold outline-none focus:border-violet-500/50 transition-all placeholder:text-white/5"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-8">
                        <MiniCalendarSelector label="Dia de Fechamento" value={closingDay} onChange={setClosingDay} />
                        <MiniCalendarSelector label="Dia de Vencimento" value={dueDay} onChange={setDueDay} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-[22px] p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-white/10 shadow-lg" style={{ backgroundColor: colorHex }}>
                        <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{colorHex}</span>
                    </div>
                    <Palette className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" />
                  </div>
                  
                  <button
                    disabled={loading}
                    type="submit"
                    className="flex-[2] relative group overflow-hidden rounded-[22px] py-5 transition-all active:scale-[0.98] shadow-2xl"
                  >
                    <div className="absolute inset-0 transition-all duration-500 group-hover:brightness-125" style={{ backgroundColor: colorHex }} />
                    <span className="relative text-white font-black text-xs uppercase tracking-[0.4em]">
                      {loading ? "Salvando..." : "Finalizar Ativo"}
                    </span>
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
