"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { cn, formatCurrency } from "@/lib/utils";
import { CreditCard, Wallet, Banknote, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";

interface AccountCardProps {
  name: string;
  type: string;
  balance: number;
  colorHex: string;
  currencyCode?: string;
}

export function AccountCard({ name, type, balance, colorHex }: AccountCardProps) {
  const isCreditCard = type === "CREDIT_CARD";

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
        <button className="text-white/20 hover:text-white/60 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
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
          {/* Mock avatars for shared accounts or status dots */}
          <div className="w-6 h-6 rounded-full border-2 border-black bg-violet-500/20" />
        </div>
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
          Atualizado agora
        </span>
      </div>
    </GlassCard>
  );
}
