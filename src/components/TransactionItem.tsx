"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { ActionMenu } from "./ActionMenu";

interface TransactionItemProps {
  transaction: any;
}

export function TransactionItem({ transaction: tx }: TransactionItemProps) {
  const router = useRouter();
  const { openEdit } = useTransactionModal();
  const isIncome = tx.transaction_type === "INCOME";

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", tx.id);

    if (!error) {
      router.refresh();
    } else {
      alert("Erro ao excluir transação");
    }
  }

  return (
    <GlassCard 
      className="p-4 flex items-center justify-between group hover:border-white/20 transition-all"
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105",
          isIncome 
            ? "bg-green-500/10 border-green-500/20 text-green-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
          {isIncome ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
        </div>
        
        <div>
          <p className="text-white font-semibold text-lg">{tx.description}</p>
          <div className="flex items-center gap-2">
            <span 
              className="text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-tighter"
              style={{ 
                backgroundColor: `${tx.categories?.color_hex}10`,
                borderColor: `${tx.categories?.color_hex}30`,
                color: tx.categories?.color_hex
              }}
            >
              {tx.categories?.name || "Sem Categoria"}
            </span>
            <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
              • {tx.accounts?.name}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className={cn(
            "text-xl font-bold tabular-nums",
            isIncome ? "text-green-400" : "text-white"
          )}>
            {isIncome ? "+" : "-"} {formatCurrency(tx.amount_cents)}
          </p>
          <p className="text-[10px] text-white/20 font-medium">
            {new Date(tx.date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Action Menu */}
        <ActionMenu 
          onEdit={() => {
            console.log("TransactionItem: triggering openEdit for", tx.id);
            openEdit(tx);
          }}
          onDelete={handleDelete}
          className="relative z-10"
        />
      </div>
    </GlassCard>
  );
}
