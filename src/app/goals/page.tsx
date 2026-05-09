import { createClient } from "@/utils/supabase/server";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { GoalsManager } from "@/components/GoalsManager";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const familyGroupId = await getFamilyGroup();

  if (!familyGroupId) {
    return (
      <div className="p-12 text-center text-white/40 font-bold uppercase tracking-widest">
        Erro ao carregar seu grupo familiar.
      </div>
    );
  }

  // 1. Buscar Estado Financeiro Completo via RPC v3
  const { data: financialState } = await supabase.rpc('get_financial_state_v3', {
    p_family_group_id: familyGroupId
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
