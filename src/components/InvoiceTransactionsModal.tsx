"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, ShoppingBag, Calendar, Tag } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialData } from "@/context/FinancialDataContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InvoiceTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
  accountName: string;
  invoiceMonth: string;
  invoiceAmountCents: number;
}

export function InvoiceTransactionsModal({
  isOpen,
  onClose,
  invoiceId,
  accountName,
  invoiceMonth,
  invoiceAmountCents
}: InvoiceTransactionsModalProps) {
  const { allTransactions } = useFinancialData();

  // Filtrar as transações vinculadas a esta fatura
  const invoiceTransactions = React.useMemo(() => {
    if (!invoiceId) return [];
    return (allTransactions || []).filter(t => t.invoice_id === invoiceId);
  }, [allTransactions, invoiceId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key={`invoice-transactions-modal-content-${invoiceId || "default"}`} className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            data-testid="invoice-transactions-modal"
            className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/10 blur-[80px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Detalhes da Fatura</span>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-violet-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {accountName} <span className="text-white/30 font-medium">({invoiceMonth})</span>
                  </h2>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="text-white/20 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/5"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Panel */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-6 shrink-0 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Valor da Fatura</span>
                <span className="text-2xl font-black text-amber-500 tabular-nums">
                  {formatCurrency(invoiceAmountCents)}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Transações</span>
                <span className="text-sm font-black text-white/60 tabular-nums">
                  {invoiceTransactions.length} item(ns)
                </span>
              </div>
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-2 max-h-[45vh] custom-scrollbar">
              {invoiceTransactions.length > 0 ? (
                invoiceTransactions.map((tx, index) => {
                  let formattedDate = "---";
                  if (tx.date) {
                    try {
                      formattedDate = format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR });
                    } catch (e) {
                      formattedDate = "";
                    }
                  }

                  const isInstallment = tx.installment_total && tx.installment_total > 1;

                  return (
                    <motion.div
                      key={tx.id || `invoice-tx-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-white/40 shrink-0">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white/80 truncate block">{tx.description}</span>
                            {isInstallment && (
                              <span className="px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[8px] font-black uppercase tracking-widest text-violet-400">
                                {tx.installment_current}/{tx.installment_total}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-[9px] font-bold text-white/20 uppercase tracking-wider">
                              <Calendar className="w-2.5 h-2.5" />
                              {formattedDate}
                            </span>
                            {tx.category_name && (
                              <>
                                <span className="text-white/10 text-[9px]">•</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold text-white/20 uppercase tracking-wider">
                                  <Tag className="w-2.5 h-2.5" />
                                  {tx.category_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-sm font-black text-white/80 tabular-nums ml-4 shrink-0">
                        {formatCurrency(tx.amount_cents)}
                      </span>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-white/10 mb-3" />
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Nenhuma compra listada</p>
                  <p className="text-[9px] font-bold text-white/15 max-w-[200px] leading-relaxed">
                    Não encontramos transações vinculadas a este ID de fatura no banco de dados.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-white/5 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/95 active:scale-[0.98] transition-all shadow-xl"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
