import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { GoalsManager } from "@/components/GoalsManager";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = await getUserId();

  if (!userId) {
    return (
      <div className="p-12 text-center text-white/40 font-bold uppercase tracking-widest">
        Erro ao carregar seu perfil.
      </div>
    );
  }

  // 1. Buscar Estado Financeiro Completo via RPC v5
  const { data: financialState } = await supabase.rpc('get_financial_state_v5', {
    p_user_id: userId
  });

  if (!financialState) {
    return (
      <div className="p-12 text-center text-white/40 font-bold uppercase tracking-widest">
        Erro ao carregar estado financeiro.
      </div>
    );
  }

  const goals = financialState.goals || [];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      <GoalsManager initialGoals={goals || []} />
    </div>
  );
}
