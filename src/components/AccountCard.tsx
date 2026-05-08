"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { cn, formatCurrency } from "@/lib/utils";
import { CreditCard, Wallet, Banknote, CalendarDays } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useAccountModal } from "@/context/AccountModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ActionMenu } from "./ActionMenu";

interface AccountCardProps {
  account: any;
}

export function AccountCard({ account: initialAccount }: AccountCardProps) {
  const { accounts } = useFinancialData();
  const liveAccount = accounts.find(a => a.id === initialAccount.id) || initialAccount;
  
  const { 
    id, 
    name, 
    type, 
    color_hex: colorHex, 
    balance_cents: balance, 
    credit_limit_cents: limit,
    closing_day,
    due_day,
    current_invoice_cents
  } = liveAccount;

  const router = useRouter();
  const { openEdit } = useAccountModal();
  const isCreditCard = type === "CREDIT_CARD";

  // No caso de cartão, o 'balance' representa o gasto acumulado (fatura)
  const spent = Math.abs(balance);
  const available = (limit || 0) - spent;
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

  async function handleDelete() {
    if (!confirm(`Tem certeza que deseja excluir a conta "${name}"? Todas as transações vinculadas serão apagadas.`)) return;

    const supabase = createClient();
    const { error } = await supabase.from("accounts").delete().eq("id", id);

    if (!error) {
      router.refresh();
    } else {
      alert("Erro ao excluir conta");
    }
  }

  return (
    <GlassCard className="relative overflow-hidden group">
      <div 
        className="absolute -top-12 -right-12 w-24 h-24 blur-[60px] opacity-20 transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: colorHex }}
      />

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/10"
            style={{ backgroundColor: `${colorHex}15` }}
          >
            {isCreditCard ? (
              <CreditCard className="w-6 h-6" style={{ color: colorHex }} />
            ) : type === "CASH" ? (
              <Banknote className="w-6 h-6" style={{ color: colorHex }} />
            ) : (
              <Wallet className="w-6 h-6" style={{ color: colorHex }} />
            )}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg leading-none mb-1">{name}</h3>
            <span className="text-white/40 text-xs uppercase tracking-widest font-medium">
              {type === "CHECKING" ? "Conta Corrente" : 
               type === "SAVINGS" ? "Investimento" : 
               type === "CREDIT_CARD" ? "Cartão de Crédito" : "Dinheiro"}
            </span>
          </div>
        </div>
        
        <ActionMenu 
          onEdit={() => openEdit(liveAccount)}
          onDelete={handleDelete}
          className="relative z-10"
        />
      </div>

      <div className="space-y-4">
        {isCreditCard ? (() => {
          const today = new Date().getDate();
          const isClosed = today >= (closing_day || 31);
          const invoiceAmount = isClosed 
            ? (liveAccount.closed_invoice_cents || 0) 
            : (liveAccount.open_invoice_cents || 0);
          const invoiceMonth = isClosed
            ? (liveAccount.closed_invoice_month || "---")
            : (liveAccount.open_invoice_month || "---");
          
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isClosed ? "bg-red-400" : "bg-emerald-400 animate-pulse"
                )} />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                  Fatura {isClosed ? "Fechada" : "Aberta"} — {invoiceMonth}
                </p>
              </div>
              <h2 className="text-3xl font-bold tracking-tight tabular-nums text-amber-500">
                {formatCurrency(invoiceAmount)}
              </h2>
            </div>
          );
        })() : (
          <div className="space-y-1">
            <p className="text-white/40 text-sm font-medium">Saldo Atual</p>
            <h2 className="text-3xl font-bold tracking-tight tabular-nums text-white">
              {formatCurrency(balance)}
            </h2>
          </div>
        )}

        {isCreditCard && limit > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
              <span>Limite Utilizado</span>
              <span>{percentage.toFixed(0)}%</span>
            </div>
            <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full rounded-full bg-violet-500 transition-all duration-1000"
                style={{ width: `${percentage}%`, backgroundColor: colorHex }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium text-white/20">
              <span>Disponível: {formatCurrency(available)}</span>
              <span>Total: {formatCurrency(limit)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
        {isCreditCard ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Fecha dia</span>
              <span className="text-xs font-bold text-white/60">{closing_day || "--"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Vence dia</span>
              <span className="text-xs font-bold text-white/60">{due_day || "--"}</span>
            </div>
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex }} />
        )}
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
          Vesper Sync
        </span>
      </div>
    </GlassCard>
  );
}
