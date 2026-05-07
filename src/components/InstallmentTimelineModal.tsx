"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Circle, Clock, CreditCard, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

interface InstallmentTransaction {
  id: string;
  date: string;
  amount_cents: number;
  installment_current: number;
  installment_total: number;
  description: string;
}

interface InstallmentTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
}

export function InstallmentTimelineModal({ isOpen, onClose, transaction }: InstallmentTimelineModalProps) {
  const [installments, setInstallments] = useState<InstallmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && transaction) {
      loadInstallments();
    }
  }, [isOpen, transaction]);

  const loadInstallments = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Busca todas as transações que parecem fazer parte do mesmo grupo
    // Idealmente usaríamos installment_group_id, mas vamos usar fallback por enquanto
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("description", transaction.description)
      .eq("installment_total", transaction.installment_total)
      .eq("account_id", transaction.account_id || transaction.account?.id)
      .order("installment_current", { ascending: false });

    if (data) {
      setInstallments(data as any[]);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-violet-400" />
                  <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Detalhes do Parcelamento</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{transaction.description}</h2>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <div className="flex items-center gap-6 text-white/40">
              <div className="flex flex-col">
                <span className="text-[8px] font-bold uppercase tracking-widest mb-1">Valor da Parcela</span>
                <span className="text-sm font-bold text-white">
                  {formatCurrency(transaction.amount_cents || transaction.amount)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-bold uppercase tracking-widest mb-1">Total da Compra</span>
                <span className="text-sm font-bold text-white/60">
                  {formatCurrency((transaction.amount_cents || transaction.amount || 0) * (transaction.installment_total || 1))}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline Body */}
          <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="relative space-y-8">
                {/* Vertical Line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-white/5" />

                {installments.map((inst, idx) => {
                  const isPast = inst.installment_current < transaction.installment_current;
                  const isCurrent = inst.installment_current === transaction.installment_current;
                  const isFuture = inst.installment_current > transaction.installment_current;

                  return (
                    <div key={inst.id} className="relative pl-10">
                      {/* Timeline Dot */}
                      <div className={cn(
                        "absolute left-0 top-1 w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-500",
                        isPast ? "bg-emerald-500/20 border-emerald-500/50" : 
                        isCurrent ? "bg-violet-500 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.5)]" : 
                        "bg-white/5 border-white/10"
                      )}>
                        {isPast ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                         isCurrent ? <Clock className="w-4 h-4 text-white animate-pulse" /> :
                         <Circle className="w-3 h-3 text-white/20" />}
                      </div>

                      <div className={cn(
                        "p-4 rounded-2xl border transition-all duration-300",
                        isCurrent ? "bg-white/10 border-white/10 scale-[1.02]" : "bg-white/[0.02] border-white/5 opacity-50"
                      )}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            isCurrent ? "text-violet-400" : "text-white/40"
                          )}>
                            Parcela {inst.installment_current}/{inst.installment_total}
                          </span>
                          <span className="text-xs font-bold text-white/60">
                            {format(new Date(inst.date), "MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] text-white/20 font-medium">
                            Vencimento estimado: {format(new Date(inst.date), "dd/MM/yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-white/5 border-t border-white/5 flex justify-center">
            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">
              Vesper Intelligence • Cronograma de Pagamentos
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
