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
import { TransactionDeleteModal } from "./TransactionDeleteModal";
import { StatusModal } from "./StatusModal";
import { createPortal } from "react-dom";

interface TransactionItemProps {
  transaction: any;
}

export function TransactionItem({ transaction: tx }: TransactionItemProps) {
  const { 
    toggleTransactionPaid, 
    deleteTransaction, 
    deleteTransactionSeries, 
    updateGoalBalance, 
    goals,
    skipRecurringOccurrence,
    deleteRecurringTransaction
  } = useFinancialData();
  const { userId } = useAccountModal();
  const [isTimelineOpen, setIsTimelineOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [statusModal, setStatusModal] = React.useState<{ isOpen: boolean; message: string; title: string; type: "success" | "error" }>({
    isOpen: false,
    message: "",
    title: "",
    type: "success"
  });

  const router = useRouter();
  const { openEdit } = useTransactionModal();

  const isIncome = tx.transaction_type === "INCOME";
  const isInstallment = (tx.installment_total || 0) > 1;
  const isRecurring = tx.source === "RECURRING" || !!tx.source_metadata?.recurring_id;
  const recurringId = tx.source_metadata?.recurring_id;

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async (deleteType: "single" | "future" | "all") => {
    setIsDeleteModalOpen(false);
    
    // --- SINCRONIZAÇÃO COM METAS (Reversão de Aporte) ---
    if (tx.description?.startsWith("Aporte: ")) {
      const goalName = tx.description.replace("Aporte: ", "");
      const goal = goals.find((g: any) => g.name === goalName && g.user_id === userId);
      if (goal) {
        await updateGoalBalance(goal.id, -tx.amount_cents);
      }
    }
    
    try {
      if (isRecurring && recurringId) {
        if (deleteType === "single") {
          const monthKey = format(new Date(tx.date), "yyyy-MM");
          await skipRecurringOccurrence(recurringId, monthKey);
          await deleteTransaction(tx.id); // Remove a transação física gerada também
        } else if (deleteType === "future") {
          const supabase = createClient();
          await supabase
            .from("recurring_transactions")
            .update({ status: "inactive" })
            .eq("id", recurringId);
          await deleteTransaction(tx.id);
        } else if (deleteType === "all") {
          await deleteRecurringTransaction(recurringId);
        }
      } else if (isInstallment) {
        if (deleteType === "all") {
          await deleteTransactionSeries(tx.description, tx.installment_total || 0, tx.account_id);
        } else {
          await deleteTransaction(tx.id);
        }
      } else {
        await deleteTransaction(tx.id);
      }
      
      router.refresh();
    } catch (error) {
      console.error("Erro ao deletar:", error);
      setStatusModal({
        isOpen: true,
        title: "Erro na Transação",
        message: "Ocorreu um erro ao tentar excluir esta transação.",
        type: "error"
      });
    }
  };

  return (
    <>
      <GlassCard 
        data-testid={`transaction-item-${tx.id}`}
        className={cn(
          "p-3 md:p-4 flex items-center justify-between group hover:border-white/20 transition-all",
          isInstallment && "cursor-pointer",
          tx.is_paid && "opacity-50 grayscale-[0.5]"
        )}
        onClick={() => {
          if (isInstallment) setIsTimelineOpen(true);
        }}
      >
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <div className={cn(
            "w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 shrink-0",
            isIncome 
              ? "bg-green-500/10 border-green-500/20 text-green-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          )}>
            {isIncome ? <ArrowUpRight className="w-4 h-4 md:w-6 md:h-6" /> : <ArrowDownLeft className="w-4 h-4 md:w-6 md:h-6" />}
          </div>
          
          <div className="min-w-0 flex-1">
            <p className={cn("text-white font-semibold text-sm md:text-lg truncate", tx.is_paid && "line-through text-white/40")}>
              {tx.description}
            </p>
            <div className="flex flex-wrap items-center gap-x-1.5 md:gap-x-2 gap-y-1 mt-0.5">
              <span 
                className="text-[8px] md:text-[10px] px-1 md:px-2 py-0.5 rounded-full border font-bold uppercase tracking-tighter truncate max-w-[80px] md:max-w-none"
                style={{ 
                  backgroundColor: `${tx.category?.color_hex}10`,
                  borderColor: `${tx.category?.color_hex}30`,
                  color: tx.category?.color_hex
                }}
              >
                {tx.category?.name || "Sem Categoria"}
              </span>
              <span className="text-[8px] md:text-[10px] text-white/20 font-bold uppercase tracking-tighter truncate max-w-[60px] md:max-w-none">
                • {tx.account?.name}
              </span>
              {isInstallment && (
                <div className="flex items-center gap-1 px-1 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                  <Layers className="w-2 h-2 text-violet-400" />
                  <span className="text-[8px] font-bold text-violet-400 tracking-tighter">
                    {tx.installment_current}/{tx.installment_total}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-3">
          <div className="text-right">
            <p className={cn(
              "text-base md:text-xl font-bold tabular-nums",
              isIncome ? "text-green-400" : "text-white",
              tx.is_paid && "text-white/20"
            )}>
              {isIncome ? "+" : "-"} {isNaN(Number(tx.amount_cents)) ? "R$ ---" : formatCurrency(tx.amount_cents)}
            </p>
            <p className="text-[8px] md:text-[10px] text-white/20 font-medium">
              {format(new Date(tx.date), "dd/MM/yy", { locale: ptBR })}
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
                data-testid="toggle-paid-button"
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

      {typeof document !== "undefined" && (
        <>
          {createPortal(
            <TransactionDeleteModal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              onConfirm={confirmDelete}
              isInstallment={isInstallment}
              isRecurring={isRecurring}
              description={tx.description}
            />,
            document.body
          )}

          {createPortal(
            <StatusModal
              isOpen={statusModal.isOpen}
              onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
              title={statusModal.title}
              message={statusModal.message}
              type={statusModal.type}
            />,
            document.body
          )}
        </>
      )}
    </>
  );
}
