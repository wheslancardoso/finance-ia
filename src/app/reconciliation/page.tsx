import React from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ReconciliationClient } from "@/components/reconciliation/ReconciliationClient";

export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Busca as contas para o seletor
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id);

  // Busca as transações recentes (últimos 45 dias)
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 45);
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', pastDate.toISOString())
    .order('date', { ascending: false });

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 lg:p-12 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Auditoria Mensal</h1>
          <p className="text-sm font-medium text-white/40 mt-1">Sincronize o saldo do seu banco com o aplicativo</p>
        </div>

        <ReconciliationClient 
          initialAccounts={accounts || []} 
          initialTransactions={transactions || []} 
        />
      </div>
    </div>
  );
}
