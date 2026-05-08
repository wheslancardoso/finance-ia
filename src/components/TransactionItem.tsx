"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, ArrowDownLeft, Layers } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { ActionMenu } from "./ActionMenu";
import { InstallmentTimelineModal } from "./InstallmentTimelineModal";

interface TransactionItemProps {
  transaction: any;
}

export function TransactionItem({ transaction: tx }: TransactionItemProps) {
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
      
      const { familyGroupId } = useAccountModal();
      
      // Buscar a meta pelo nome dentro do grupo familiar
      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("name", goalName)
        .eq("family_group_id", familyGroupId)
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
          isInstallment && "cursor-pointer"
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
              {isInstallment && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                  <Layers className="w-2 h-2 text-violet-400" />
                  <span className="text-[9px] font-bold text-violet-400 tracking-tighter">
                    {tx.installment_current}/{tx.installment_total}
                  </span>
                </div>
              )}
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
              {format(new Date(tx.date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Action Menu */}
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu 
              onEdit={async () => {
                console.log("TransactionItem: triggering openEdit for", tx.id);
                if (isInstallment && tx.installment_current !== 1) {
                  const supabase = createClient();
                  const { data, error } = await supabase
                    .from("transactions")
                    .select("*, categories(*), accounts(*)")
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
