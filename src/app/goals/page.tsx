import { createClient } from "@/utils/supabase/server";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { Target, Plus, ShieldCheck, Plane, Car, Home as HomeIcon, Sparkles } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import GlassCard from "@/components/GlassCard";
import Link from "next/link";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const familyGroupId = await getFamilyGroup();

  if (!familyGroupId) {
    return <div>Erro ao carregar seu grupo familiar.</div>;
  }

  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("family_group_id", familyGroupId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-bold text-violet-500 uppercase tracking-[0.3em]">Ambições</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white">Suas Metas</h2>
          <p className="text-white/40 font-medium">Transformando saldo em conquistas reais.</p>
        </div>
        
        <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-2 group active:scale-95">
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Novo Objetivo
        </button>
      </header>

      {(!goals || goals.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/10">
            <Target className="w-10 h-10 text-white/20" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Nenhuma meta ativa</h3>
            <p className="text-white/40 max-w-xs mx-auto">
              Defina seu primeiro objetivo para começar a visualizar o futuro do seu dinheiro.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {goals.map((goal) => {
            const percentage = Math.min((goal.current_amount_cents / goal.target_amount_cents) * 100, 100);
            const remaining = goal.target_amount_cents - goal.current_amount_cents;
            
            return (
              <div key={goal.id} className="group relative">
                <GlassCard className="h-full flex flex-col gap-8 transition-all hover:border-white/20">
                  <div className="flex items-start justify-between">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner"
                      style={{ backgroundColor: `${goal.color_hex}15`, color: goal.color_hex }}
                    >
                      <Sparkles className="w-7 h-7" />
                    </div>
                    {goal.deadline && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Prazo Estimado</p>
                        <p className="text-xs font-bold text-white/60">
                          {new Date(goal.deadline).toLocaleDateString("pt-BR", { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white tracking-tight">{goal.name}</h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white font-bold">{formatCurrency(goal.current_amount_cents)}</span>
                      <span className="text-white/20 text-xs">de {formatCurrency(goal.target_amount_cents)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        style={{ width: `${percentage}%`, backgroundColor: goal.color_hex }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span style={{ color: goal.color_hex }}>{percentage.toFixed(1)}% Completo</span>
                      <span className="text-white/20">Faltam {formatCurrency(remaining)}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <button className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors">
                      Detalhes
                    </button>
                    <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest transition-all">
                      Aportar
                    </button>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
