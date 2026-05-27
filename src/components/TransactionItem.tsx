"use client";

import React from "react";
import GlassCard from "./GlassCard";
import { formatCurrency, cn, getTransactionInvoiceMonth } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, ArrowDownLeft, Layers, Calendar, Zap, CreditCard, Wallet } from "lucide-react";
import { motion } from "framer-motion";
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

  const catColor = tx.category?.color_hex || (isIncome ? "#10b981" : "#a1a1aa");
  const isCredit = tx.account?.type === "CREDIT_CARD";

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
          "p-3.5 md:p-4.5 flex items-center justify-between group rounded-[2rem] border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent hover:bg-white/[0.04] hover:border-white/10 hover:shadow-2xl transition-all duration-300 relative overflow-hidden",
          isInstallment && "cursor-pointer",
          tx.is_paid && "bg-white/[0.005] border-white/2 opacity-40 hover:opacity-75"
        )}
        onClick={() => {
          if (isInstallment) setIsTimelineOpen(true);
        }}
        actions={
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
            className="absolute top-1.5 right-1.5 z-20"
          />
        }
      >
        <div className="flex items-center gap-3 md:gap-4.5 min-w-0 flex-1 relative z-10">
          {/* Caixa de ícone estilizada dinâmica */}
          <div 
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-105 shrink-0"
            style={{
              backgroundColor: `${catColor}12`,
              borderColor: `${catColor}30`,
              color: catColor
            }}
          >
            {isIncome ? (
              <ArrowUpRight className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 transition-transform duration-300 group-hover:rotate-45" />
            ) : isInstallment ? (
              <Layers className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 text-violet-400" />
            ) : isRecurring ? (
              <Zap className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 text-blue-400 animate-pulse" />
            ) : (
              <ArrowDownLeft className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:translate-y-0.5" />
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-white font-bold text-sm md:text-base tracking-tight truncate transition-all duration-300", 
              tx.is_paid && "line-through text-white/30"
            )}>
              {tx.description?.replace(/\s*\[[Vv]ence:\s*\d{4}-\d{2}\]/, "")}
            </p>
            
            {/* Chips de Badges Premium */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span 
                className="text-[8px] md:text-[9px] px-2 py-0.5 rounded-lg border font-black uppercase tracking-widest truncate max-w-[85px] md:max-w-none transition-colors"
                style={{ 
                  backgroundColor: `${catColor}10`,
                  borderColor: `${catColor}20`,
                  color: catColor
                }}
              >
                {tx.category?.name || "Sem Categoria"}
              </span>

              <span 
                className="text-[8px] md:text-[9px] px-2 py-0.5 rounded-lg border font-black uppercase tracking-widest bg-white/[0.02] border-white/5 text-white/40 flex items-center gap-1 shrink-0"
              >
                {isCredit ? (
                  <CreditCard className="w-2.5 h-2.5 text-violet-400 opacity-80" />
                ) : (
                  <Wallet className="w-2.5 h-2.5 text-emerald-400 opacity-80" />
                )}
                {tx.account?.name}
              </span>

              {isInstallment && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
                  <Layers className="w-2.5 h-2.5" />
                  <span className="text-[8px] md:text-[9px] font-black tracking-wider">
                    {tx.installment_current}/{tx.installment_total}
                  </span>
                </div>
              )}

              {isRecurring && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                  <Zap className="w-2.5 h-2.5 animate-pulse" />
                  <span className="text-[8px] md:text-[9px] font-black tracking-wider uppercase">
                    Fixo
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6 shrink-0 ml-3 relative z-10">
          <div className="text-right space-y-0.5">
            <p className={cn(
              "text-base md:text-lg font-black tabular-nums tracking-tight transition-all duration-300",
              isIncome ? "text-emerald-400" : "text-white/90",
              tx.is_paid && "text-white/20 line-through opacity-40"
            )}>
              {isIncome ? "+" : "-"} {isNaN(Number(tx.amount_cents)) ? "R$ ---" : formatCurrency(tx.amount_cents)}
            </p>
            <p className="text-[8px] md:text-[9px] text-white/20 font-black uppercase tracking-widest">
              {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}
            </p>
          </div>

          <div className="flex items-center gap-2 md:gap-3" onClick={(e) => e.stopPropagation()}>
            {!isIncome && tx.transaction_type !== "TRANSFER" && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  await toggleTransactionPaid(tx.id, tx.is_paid || false);
                  router.refresh();
                }}
                data-testid="toggle-paid-button"
                className={cn(
                  "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all border-2 shrink-0 relative overflow-hidden",
                  tx.is_paid 
                    ? "bg-gradient-to-br from-emerald-400 to-teal-600 border-transparent text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                    : "bg-white/[0.01] border-white/10 text-transparent hover:border-emerald-500/50 hover:bg-emerald-500/5"
                )}
                title={tx.is_paid ? "Marcar como não pago" : "Marcar como pago"}
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={cn(
                    "w-4.5 h-4.5 md:w-5.5 md:h-5.5 transition-colors z-10 relative",
                    tx.is_paid ? "text-[#0d0d0d]" : "text-transparent"
                  )}
                >
                  <motion.path
                    d="M20 6 9 17l-5-5"
                    initial={false}
                    animate={{ pathLength: tx.is_paid ? 1 : 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 20,
                      duration: 0.3
                    }}
                  />
                </svg>
              </motion.button>
            )}
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
