"use client";

import React from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import GlassCard from "@/components/GlassCard";
import { 
  Calendar, 
  CreditCard, 
  Plus, 
  Zap, 
  PauseCircle, 
  PlayCircle, 
  Trash2,
  Utensils,
  Car,
  Gamepad,
  Activity,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Home,
  Heart,
  Tv,
  Wallet,
  Pencil
} from "lucide-react";
import { useSubscriptionModal } from "@/context/SubscriptionModalContext";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ConfirmModal } from "./ConfirmModal";
import { financialService } from "@/services/financialService";
import { createPortal } from "react-dom";
import { useState } from "react";

// Mapeamento de ícones de categorias
const ICON_MAP: Record<string, any> = {
  Utensils,
  Car,
  Gamepad,
  Activity,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Home,
  Heart,
  Tv,
  Wallet,
  Zap
};

function CategoryIcon({ name, fallback }: { name: string | null, fallback: string }) {
  const Icon = name ? ICON_MAP[name] : null;
  
  if (Icon) {
    return <Icon className="w-5 h-5 opacity-40" />;
  }

  // Se for um emoji ou string comum
  return <span className="text-xl">{fallback}</span>;
}

interface SubscriptionManagerProps {
  initialSubscriptions?: any[];
}

export function SubscriptionManager({ initialSubscriptions }: SubscriptionManagerProps) {
  const { recurringTransactions: contextSubs, refreshData } = useFinancialData();
  const { openModal } = useSubscriptionModal();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function toggleStatus(id: string, currentStatus: string) {
    await financialService.toggleRecurringStatus(id, currentStatus);
    await refreshData();
  }

  async function deleteSub() {
    if (!deleteId) return;
    await financialService.deleteRecurringTransaction(deleteId);
    setDeleteId(null);
    await refreshData();
  }

  const subscriptionsToDisplay = contextSubs.length > 0 ? contextSubs : (initialSubscriptions || []);
  const incomes = subscriptionsToDisplay.filter(s => s.transaction_type === 'INCOME');
  const expenses = subscriptionsToDisplay.filter(s => s.transaction_type === 'EXPENSE');

  const renderGrid = (subs: any[], title: string, colorClass: string, icon: any) => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white/5", colorClass)}>
          {React.createElement(icon, { className: "w-4 h-4" })}
        </div>
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/50">{title}</h3>
        <div className="h-[1px] flex-1 bg-white/5 ml-4" />
        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{subs.length} items</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subs.map((sub, idx) => (
          <GlassCard 
            key={sub.id || `sub-${idx}`} 
            data-testid={`subscription-card-${sub.id}`}
            className={cn(
            "p-6 group relative overflow-hidden transition-all hover:border-white/20",
            sub.status === "paused" && "opacity-50 grayscale",
            sub.transaction_type === 'INCOME' ? "hover:shadow-[0_0_40px_-15px_rgba(16,185,129,0.1)]" : "hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.1)]"
          )}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                  sub.transaction_type === 'INCOME' 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-white/5 border-white/10 text-white/60"
                )}>
                  <CategoryIcon 
                    name={sub.category?.icon_name} 
                    fallback={sub.transaction_type === 'INCOME' ? "💰" : "📦"} 
                  />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg leading-tight">{sub.description}</h4>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
                    {sub.category?.name || "Sem Categoria"} • {sub.transaction_type === 'INCOME' ? 'Receita' : 'Gasto'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal(sub)}
                  data-testid={`edit-subscription-${sub.id}`}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-right mb-6">
                <span className={cn(
                  "font-black text-2xl tabular-nums tracking-tighter",
                  sub.transaction_type === 'INCOME' ? "text-emerald-400" : "text-white"
                )}>
                  {sub.transaction_type === 'INCOME' ? "+" : ""}{formatCurrency(sub.amount_cents)}
                </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/2 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase">
                  <Calendar className="w-3 h-3" />
                  Próximo: {format(new Date(sub.next_date), "dd 'de' MMM", { locale: ptBR })}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase">
                  <CreditCard className="w-3 h-3" />
                  {sub.account?.name}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleStatus(sub.id, sub.status)}
                  data-testid={`toggle-status-${sub.id}`}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    sub.status === "active" 
                      ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" 
                      : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                  )}
                >
                  {sub.status === "active" ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  {sub.status === "active" ? "Pausar" : "Ativar"}
                </button>
                <button 
                  onClick={() => setDeleteId(sub.id)}
                  data-testid={`delete-subscription-${sub.id}`}
                  className="w-12 h-12 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-all border border-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}

        {title === "Gastos Fixos" && (
          <button 
            onClick={() => openModal()}
            className="p-8 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-4 text-white/10 hover:text-white/20 hover:border-white/10 transition-all group min-h-[280px]"
          >
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest">Novo Fluxo</p>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter">Fluxos Recorrentes</h1>
          <p className="text-white/40 font-bold text-xs uppercase tracking-[0.2em]">Gestão de Receitas e Gastos Fixos</p>
        </div>
        <button 
          onClick={() => openModal()}
          data-testid="add-subscription-button"
          className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-[22px] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
        >
          <Plus className="w-5 h-5" />
          Novo Fluxo
        </button>
      </header>

      {incomes.length > 0 && renderGrid(incomes, "Receitas Fixas", "text-emerald-400", TrendingUp)}
      {renderGrid(expenses, "Gastos Fixos", "text-violet-400", Zap)}

      {typeof document !== "undefined" && createPortal(
        <ConfirmModal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={deleteSub}
          title="Excluir Assinatura"
          message="Tem certeza que deseja excluir este fluxo recorrente? As transações futuras deixarão de ser geradas automaticamente."
          confirmText="Excluir"
          cancelText="Manter"
          variant="danger"
        />,
        document.body
      )}
    </div>
  );
}
