import { createClient } from "@/utils/supabase/server";
import { TransactionsContent } from "@/components/TransactionsContent";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const familyGroupId = await getFamilyGroup();

  if (!familyGroupId) return null;

  // 1. Buscar Estado Financeiro Completo via RPC v3
  const { data: financialState } = await supabase.rpc('get_financial_state_v3', {
    p_family_group_id: familyGroupId,
    p_target_month: new Date().toISOString()
  });

  if (!financialState) {
    return <div>Erro ao carregar estado financeiro.</div>;
  }

  const accounts = financialState.accounts || [];
  const transactions = financialState.recent_transactions || [];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      <TransactionsContent 
        initialTransactions={transactions || []} 
        accounts={accounts || []} 
      />
    </div>
  );
}

