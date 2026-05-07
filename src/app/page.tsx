import { createClient } from "@/utils/supabase/server";
import RealtimeDashboard from "@/components/RealtimeDashboard";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { startOfMonth } from "date-fns";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const familyGroupId = await getFamilyGroup();

  if (!familyGroupId) {
    return <div>Erro ao carregar seu grupo familiar.</div>;
  }

  // 1. Buscar contas do grupo (incluindo cartões)
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, balance_cents, type, color_hex")
    .eq("family_group_id", familyGroupId);

  const accountIds = accounts?.map(a => a.id) || [];
  
  const initialBalance = accounts?.filter(a => a.type !== "CREDIT_CARD")
    .reduce((acc, curr) => acc + (curr.balance_cents || 0), 0) || 0;

  // 2. Buscar transações recentes
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .in("account_id", accountIds)
    .lte("date", new Date().toISOString())
    .order("date", { ascending: false })
    .limit(3);

  const initialTransactions = (transactions || []).map((tx: any) => ({
    id: tx.id,
    created_at: tx.date || tx.created_at,
    description: tx.description,
    amount: tx.amount_cents || 0,
    type: tx.transaction_type || "EXPENSE",
  }));

  // 3. Buscar Orçamentos e Gastos Reais
  const monthStart = startOfMonth(new Date()).toISOString();
  
  const { data: budgetsData } = await supabase
    .from("budgets")
    .select(`
      amount_cents,
      category_id,
      categories (name)
    `)
    .eq("family_group_id", familyGroupId);

  const { data: spentData } = await supabase
    .from("transactions")
    .select("category_id, amount_cents")
    .in("account_id", accountIds)
    .eq("transaction_type", "EXPENSE")
    .gte("date", monthStart)
    .lte("date", new Date().toISOString());

  const budgets = (budgetsData || []).map(b => {
    const totalSpent = (spentData || [])
      .filter(s => s.category_id === b.category_id)
      .reduce((acc, curr) => acc + (curr.amount_cents || 0), 0);
    
    return {
      category: (b.categories as any)?.name || "Categoria",
      spent: totalSpent,
      limit: b.amount_cents,
    };
  });

  // 4. Buscar Transações Futuras e Recorrentes (Para o Time Travel)
  const { data: futureTransactions } = await supabase
    .from("transactions")
    .select("amount_cents, transaction_type, date")
    .in("account_id", accountIds)
    .gt("date", new Date().toISOString())
    .order("date", { ascending: true });

  // Encontrar a data da última transação futura (Fim das Dívidas)
  const lastFutureDate = futureTransactions?.length 
    ? futureTransactions[futureTransactions.length - 1].date 
    : null;

  const { data: recurring } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("family_group_id", familyGroupId)
    .eq("status", "active");

  const projectionItems = [
    ...(futureTransactions || []).map(ft => ({
      amount_cents: ft.amount_cents,
      transaction_type: ft.transaction_type,
      frequency: "once" as any,
      next_date: ft.date
    })),
    ...(recurring || []).map(r => ({
      amount_cents: r.amount_cents,
      transaction_type: r.transaction_type,
      frequency: r.frequency,
      next_date: r.next_date
    }))
  ];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-white/40">Bem-vindo de volta ao Centro de Comando.</p>
      </header>

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
