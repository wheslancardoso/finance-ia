import { createClient } from "@/utils/supabase/server";
import { TransactionsContent } from "@/components/TransactionsContent";
import { getUserId } from "@/utils/supabase/auth-helpers";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const userId = await getUserId();

  if (!userId) return null;

  // 1. Buscar Estado Financeiro Completo via RPC v5
  const { data: financialState } = await supabase.rpc('get_financial_state_v5', {
    p_user_id: userId,
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

