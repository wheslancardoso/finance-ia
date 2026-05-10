"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { formatCurrency, cn, getTransactionInvoiceMonth } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, ArrowDownLeft, Layers, Check, Calendar, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ActionMenu } from "./ActionMenu";
import { InstallmentTimelineModal } from "./InstallmentTimelineModal";

interface TransactionItemProps {
  transaction: any;
}

export function TransactionItem({ transaction: tx }: TransactionItemProps) {
  const { toggleTransactionPaid } = useFinancialData();
  const [isTimelineOpen, setIsTimelineOpen] = React.useState(false);
  const router = useRouter();
  const { openEdit } = useTransactionModal();
  const isIncome = tx.transaction_type === "INCOME";
  const isInstallment = tx.installment_total && tx.installment_total > 1;

  async function handleDelete() {
    const isGroup = isInstallment && confirm("Deseja excluir TODAS as parcelas desta compra? Clique em 'Cancelar' para excluir apenas esta parcela.");
    
    if (!confirm(isGroup ? "Tem certeza que deseja excluir toda a série?" : "Tem certeza que deseja excluir esta transação?")) return;

    const supabase = createClient();

    // Lógica de Reversão de Aporte
    if (tx.description.startsWith("Aporte: ")) {
      const goalName = tx.description.replace("Aporte: ", "");
      
      const { userId } = useAccountModal();
      
      // Buscar a meta pelo nome dentro do grupo familiar
      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("name", goalName)
        .eq("user_id", userId)
        .maybeSingle();

      if (goalData) {
        // Diminuir o valor da meta
        const newTotal = (goalData.current_amount_cents || 0) - tx.amount_cents;
        await supabase
          .from("goals")
          .update({ current_amount_cents: Math.max(0, newTotal) })
          .eq("id", goalData.id);
        
        console.log(`REVERSÃO: Meta '${goalName}' atualizada para ${newTotal}`);
      }
    }
    
    let query = supabase.from("transactions").delete();
    
    if (isGroup) {
      query = query
        .eq("description", tx.description)
        .eq("installment_total", tx.installment_total)
        .eq("account_id", tx.account_id);
    } else {
      query = query.eq("id", tx.id);
    }

    const { error } = await query;

    if (!error) {
      router.refresh();
    } else {
      alert("Erro ao excluir transação");
    }
  }

  return (
    <>
      <GlassCard 
        className={cn(
          "p-4 flex items-center justify-between group hover:border-white/20 transition-all",
          isInstallment && "cursor-pointer",
          tx.is_paid && "opacity-50 grayscale-[0.5]"
        )}
        onClick={() => {
          if (isInstallment) setIsTimelineOpen(true);
        }}
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
            <p className={cn("text-white font-semibold text-lg", tx.is_paid && "line-through text-white/40")}>
              {tx.description}
            </p>
            <div className="flex items-center gap-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-tighter"
                style={{ 
                  backgroundColor: `${tx.category?.color_hex}10`,
                  borderColor: `${tx.category?.color_hex}30`,
                  color: tx.category?.color_hex
                }}
              >
                {tx.category?.name || "Sem Categoria"}
              </span>
              <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">
                • {tx.account?.name}
              </span>
              {isInstallment && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                  <Layers className="w-2 h-2 text-violet-400" />
                  <span className="text-[9px] font-bold text-violet-400 tracking-tighter">
                    {tx.installment_current}/{tx.installment_total}
                  </span>
                </div>
              )}
              {tx.ai_log_id && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20" title="Processado via IA (WhatsApp)">
                  <Zap className="w-2 h-2 text-emerald-400 fill-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-400 tracking-tighter">IA</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={cn(
              "text-xl font-bold tabular-nums",
              isIncome ? "text-green-400" : "text-white",
              tx.is_paid && "text-white/20"
            )}>
              {isIncome ? "+" : "-"} {formatCurrency(tx.amount_cents)}
            </p>
            <p className="text-[10px] text-white/20 font-medium">
              {format(new Date(tx.date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* Botão de Quitar */}
            {!isIncome && (
              <button
                onClick={async () => {
                  await toggleTransactionPaid(tx.id, tx.is_paid || false);
                  router.refresh();
                }}
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all border shrink-0",
                  tx.is_paid 
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                    : "bg-white/5 border-white/10 text-white/10 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5"
                )}
                title={tx.is_paid ? "Marcar como não pago" : "Marcar como pago"}
              >
                <Check className={cn("w-5 h-5 transition-transform", tx.is_paid && "scale-110")} />
              </button>
            )}

            {/* Action Menu */}
            <ActionMenu 
              onEdit={async () => {
                console.log("TransactionItem: triggering openEdit for", tx.id);
                if (isInstallment && tx.installment_current !== 1) {
                  const supabase = createClient();
                  const { data, error } = await supabase
                    .from("transactions")
                    .select("*, category:categories(*), account:accounts(*)")
                    .eq("description", tx.description)
                    .eq("installment_total", tx.installment_total)
                    .eq("account_id", tx.account_id)
                    .eq("installment_current", 1)
                    .single();
                  
                  if (!error && data) {
                    openEdit(data);
                    return;
                  }
                }
                openEdit(tx);
              }}
              onDelete={handleDelete}
              className="relative z-10"
            />
          </div>
        </div>
      </GlassCard>

      <InstallmentTimelineModal 
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        transaction={tx}
      />
    </>
  );
}
