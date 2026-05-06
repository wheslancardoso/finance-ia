"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { cn, formatCurrency } from "@/lib/utils";
import { CreditCard, Wallet, Banknote } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useAccountModal } from "@/context/AccountModalContext";
import { ActionMenu } from "./ActionMenu";

interface AccountCardProps {
  account: any;
}

export function AccountCard({ account }: AccountCardProps) {
  const { id, name, type, color_hex: colorHex, balance_cents: balance } = account;
  const router = useRouter();
  const { openEdit } = useAccountModal();
  const isCreditCard = type === "CREDIT_CARD";

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
      {/* Dynamic Glow background based on colorHex */}
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
          onEdit={() => {
            console.log("AccountCard: triggering openEdit for", account.id);
            openEdit(account);
          }}
          onDelete={handleDelete}
          className="relative z-10"
        />
      </div>

      <div className="space-y-1">
        <p className="text-white/40 text-sm font-medium">
          {isCreditCard ? "Limite Utilizado" : "Saldo Atual"}
        </p>
        <div className="flex items-baseline gap-2">
          <h2 className="text-3xl font-bold text-white tracking-tight tabular-nums">
            {formatCurrency(balance)}
          </h2>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex -space-x-2">
          <div 
            className="w-6 h-6 rounded-full border-2 border-black transition-colors" 
            style={{ backgroundColor: `${colorHex}40` }}
          />
        </div>
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
          Atualizado agora
        </span>
      </div>
    </GlassCard>
  );
}
