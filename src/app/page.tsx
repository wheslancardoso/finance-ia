import { createClient } from "@/utils/supabase/server";
import RealtimeDashboard from "@/components/RealtimeDashboard";
import { getUserId } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth } from "date-fns";
import { SyncUser } from "@/components/SyncUser";
import SurvivalHUD from "@/components/SurvivalHUD";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = await getUserId();

  if (!userId) {
    return <div>Erro ao carregar seu perfil.</div>;
  }

  // 1. Buscar Estado Financeiro Completo via RPC v5
  const { data: financialState } = await supabase.rpc('get_financial_state_v5', {
    p_user_id: userId,
    p_target_month: new Date().toISOString()
  });

  if (!financialState) {
    return <div>Erro ao carregar estado financeiro.</div>;
  }

  const {
    accounts = [],
    recent_transactions = [],
    budgets: budgetsData = [],
    recurring_transactions = [],
    month_transactions = [],
    categories = []
  } = financialState;

  // 2. Mapear dados para o Dashboard
  const initialBalance = accounts
    .filter((a: any) => a.type !== "CREDIT_CARD")
    .reduce((acc: number, curr: any) => acc + (curr.balance_cents || 0), 0);

  const initialTransactions = recent_transactions.map((tx: any) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amount: tx.amount_cents || 0,
    type: tx.transaction_type || "EXPENSE",
    installment_current: tx.installment_current,
    installment_total: tx.installment_total,
    category: tx.category,
    account: tx.account,
  }));

  const budgets = budgetsData.map((b: any) => {
    const totalSpent = month_transactions
      .filter((s: any) => s.category_id === b.category_id && s.transaction_type === "EXPENSE")
      .reduce((acc: number, curr: any) => acc + (curr.amount_cents || 0), 0);

    return {
      category: categories.find((c: any) => c.id === b.category_id)?.name || "Categoria",
      spent: totalSpent,
      limit: b.amount_cents,
    };
  });

  const projectionItems = [
    // Transações futuras agendadas (is_paid = false)
    ...recent_transactions
      .filter((t: any) => new Date(t.date) > new Date() && !t.is_paid)
      .map((ft: any) => ({
        id: ft.id,
        description: ft.description,
        amount_cents: ft.amount_cents,
        transaction_type: ft.transaction_type,
        frequency: "once" as const,
        next_date: ft.date,
        account_id: ft.account_id
      })),
    // Recorrências ativas
    ...recurring_transactions
      .filter((r: any) => r.status === 'active')
      .map((r: any) => ({
        id: r.id,
        description: r.description,
        amount_cents: r.amount_cents,
        transaction_type: r.transaction_type,
        frequency: r.frequency,
        next_date: r.next_date,
        account_id: r.account_id
      }))
  ];

  const lastFutureDate = projectionItems.length 
    ? projectionItems.sort((a, b) => new Date(b.next_date).getTime() - new Date(a.next_date).getTime())[0].next_date 
    : null;


  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <SyncUser userId={userId} />
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-white/40">Bem-vindo de volta ao Centro de Comando.</p>
      </header>

      <SurvivalHUD />

      <RealtimeDashboard
        initialBalance={initialBalance}
        initialTransactions={initialTransactions}
        initialBudgets={budgets}
        initialRecurring={projectionItems as any}
        lastFutureTransactionDate={lastFutureDate}
        accounts={accounts || []}
      />
    </div>
  );
}
