"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import GlassCard from "@/components/GlassCard";
import { Calendar, CreditCard, Plus, Zap, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { useSubscriptionModal } from "@/context/SubscriptionModalContext";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface SubscriptionManagerProps {
  initialSubscriptions: any[];
}

export function SubscriptionManager({ initialSubscriptions }: SubscriptionManagerProps) {
  const { openModal } = useSubscriptionModal();
  const router = useRouter();

  async function toggleStatus(id: string, currentStatus: string) {
    const supabase = createClient();
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await supabase.from("recurring_transactions").update({ status: newStatus }).eq("id", id);
    router.refresh();
  }

  async function deleteSub(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta assinatura?")) return;
    const supabase = createClient();
    await supabase.from("recurring_transactions").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter">Fluxos Recorrentes</h1>
          <p className="text-white/40 font-bold text-xs uppercase tracking-[0.2em]">Gestão de Receitas e Gastos Fixos</p>
        </div>
        <button 
          onClick={openModal}
          className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-[22px] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
        >
          <Plus className="w-5 h-5" />
          Novo Fluxo
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialSubscriptions.map((sub) => (
          <GlassCard key={sub.id} className={cn(
            "p-6 group relative overflow-hidden transition-all hover:border-white/20",
            sub.status === "paused" && "opacity-50 grayscale"
          )}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 text-xl bg-white/5">
                  {sub.categories?.icon || (sub.transaction_type === 'INCOME' ? "💰" : "📦")}
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg leading-tight">{sub.description}</h4>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
                    {sub.categories?.name} • {sub.transaction_type === 'INCOME' ? 'Receita' : 'Gasto'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={cn(
                  "font-black text-lg tabular-nums",
                  sub.transaction_type === 'INCOME' ? "text-emerald-400" : "text-white"
                )}>
                  {sub.transaction_type === 'INCOME' ? "+" : ""}{formatCurrency(sub.amount_cents)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/2 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase">
                  <Calendar className="w-3 h-3" />
                  Próximo: {format(new Date(sub.next_date), "dd 'de' MMM", { locale: ptBR })}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase">
                  <CreditCard className="w-3 h-3" />
                  {sub.accounts?.name}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleStatus(sub.id, sub.status)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
                >
                  {sub.status === "active" ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  {sub.status === "active" ? "Pausar" : "Ativar"}
                </button>
                <button 
                  onClick={() => deleteSub(sub.id)}
                  className="w-12 h-12 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-all border border-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}

        <button 
          onClick={openModal}
          className="p-8 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-4 text-white/10 hover:text-white/20 hover:border-white/10 transition-all group"
        >
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest">Novo Fluxo</p>
        </button>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
