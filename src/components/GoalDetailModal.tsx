"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Calendar, Trash2, ArrowRight, Clock, Target, History } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { createPortal } from "react-dom";
import { ConfirmModal } from "./ConfirmModal";
import { StatusModal } from "./StatusModal";
import { formatCurrency, cn } from "@/lib/utils";
import { useGoalModal } from "@/context/GoalModalContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function GoalDetailModal() {
  const { isDetailOpen, closeModal, selectedGoal } = useGoalModal();
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; message: string; title: string; type: "success" | "error" }>({
    isOpen: false,
    message: "",
    title: "",
    type: "error"
  });
  const router = useRouter();

  useEffect(() => {
    if (isDetailOpen && selectedGoal) {
      fetchContributions();
    }
  }, [isDetailOpen, selectedGoal]);

  async function fetchContributions() {
    setLoading(true);
    const supabase = createClient();
    
    // Buscar transações que começam com "Aporte: " + nome da meta
    const { data, error } = await supabase
      .from("transactions")
      .select("*, account:accounts(name)")
      .ilike("description", `Aporte: ${selectedGoal.name}`)
      .order("date", { ascending: false });

    if (!error) {
      setContributions(data || []);
    }
    setLoading(false);
  }

  async function handleDeleteGoal() {
    setConfirmDeleteOpen(true);
  }

  async function onConfirmDelete() {
    
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", selectedGoal.id);

    if (!error) {
      closeModal();
      router.refresh();
    } else {
      setStatusModal({
        isOpen: true,
        title: "Erro ao Excluir",
        message: "Não foi possível remover este objetivo. Tente novamente em instantes.",
        type: "error"
      });
    }
    setDeleting(false);
  }

  const percentage = selectedGoal ? Math.min((selectedGoal.current_amount_cents / selectedGoal.target_amount_cents) * 100, 100) : 0;

  return (
    <>
    <AnimatePresence>
      {isDetailOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header com Gradiente da Meta */}
            <div className="relative p-8 pb-12 overflow-hidden shrink-0">
              <div 
                className="absolute inset-0 opacity-20 blur-[80px] pointer-events-none"
                style={{ backgroundColor: selectedGoal.color_hex }}
              />
              
              <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg"
                      style={{ backgroundColor: `${selectedGoal.color_hex}20`, color: selectedGoal.color_hex, borderColor: `${selectedGoal.color_hex}30` }}
                    >
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight">{selectedGoal.name}</h2>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Timeline de Realização</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteGoal();
                    }}
                    disabled={deleting}
                    className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      closeModal();
                    }}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Detail */}
              <div className="relative z-10 mt-8 grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Acumulado</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(selectedGoal.current_amount_cents)}</p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Meta Final</p>
                  <p className="text-xl font-bold text-white/60">{formatCurrency(selectedGoal.target_amount_cents)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Progresso</p>
                  <p className="text-xl font-black" style={{ color: selectedGoal.color_hex }}>{percentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Lista de Aportes - Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-4 h-4 text-white/20" />
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Histórico de Aportes</h3>
              </div>

              {loading ? (
                <div className="py-12 text-center text-white/20 font-bold uppercase tracking-widest animate-pulse">
                  Carregando registros...
                </div>
              ) : contributions.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <p className="text-white/20 font-bold uppercase tracking-widest text-xs">Nenhum aporte registrado ainda</p>
                  <p className="text-[10px] text-white/10 mt-2">Os depósitos aparecerão aqui conforme você poupar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contributions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="group p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/[0.05] hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Aporte via {tx.account?.name || 'Conta'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-white/20 font-bold uppercase">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(tx.date), "dd 'de' MMMM", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-400">+{formatCurrency(tx.amount_cents)}</p>
                        <p className="text-[9px] font-bold text-white/10 uppercase tracking-tighter">Confirmado</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / CTA */}
            <div className="p-8 bg-white/[0.02] border-t border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/20" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Criada em {format(new Date(selectedGoal.created_at), "dd/MM/yyyy")}
                </span>
              </div>
              
              {selectedGoal.deadline && (
                <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Prazo: </span>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">
                    {format(new Date(selectedGoal.deadline), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {typeof document !== "undefined" && createPortal(
      <>
        <ConfirmModal
          isOpen={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={onConfirmDelete}
          title="Excluir Objetivo"
          message="Tem certeza que deseja excluir este objetivo? Isso NÃO excluirá as transações de aporte já realizadas, mas a meta deixará de existir permanentemente."
          confirmText="Excluir"
          cancelText="Manter"
          variant="danger"
        />

        <StatusModal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
          title={statusModal.title}
          message={statusModal.message}
          type={statusModal.type}
        />
      </>,
      document.body
    )}
    </>
  );
}
