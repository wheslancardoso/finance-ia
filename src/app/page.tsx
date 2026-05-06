import { createClient } from "@/utils/supabase/server";
import RealtimeDashboard from "@/components/RealtimeDashboard";

export default async function Home() {
  const supabase = await createClient();
  
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);

  // Cast initial data to match the component's expectations
  const initialTransactions = (transactions || []).map((tx: any) => ({
    id: tx.id,
    created_at: tx.created_at,
    description: tx.description,
    amount: tx.amount || tx.amount_cents || 0,
    type: tx.type || "EXPENSE",
  }));

  // Buscar saldo real das contas
  const { data: accounts } = await supabase
    .from("accounts")
    .select("balance_cents");

  const initialBalance = accounts?.reduce((acc, curr) => acc + (curr.balance_cents || 0), 0) || 0;

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-white/40">Bem-vindo de volta ao seu centro de comando financeiro.</p>
      </header>

      <RealtimeDashboard 
        initialBalance={initialBalance} 
        initialTransactions={initialTransactions} 
      />
    </div>
  );
}
