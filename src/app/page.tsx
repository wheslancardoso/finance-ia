import { createClient } from "@/utils/supabase/server";
import RealtimeDashboard from "@/components/RealtimeDashboard";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";

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

  // 3. Buscar contas do grupo
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, balance_cents")
    .eq("family_group_id", familyGroupId);

  const accountIds = accounts?.map(a => a.id) || [];
  const initialBalance = accounts?.reduce((acc, curr) => acc + (curr.balance_cents || 0), 0) || 0;

  // 4. Buscar transações vinculadas às contas do grupo
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false })
    .limit(3);

  const initialTransactions = (transactions || []).map((tx: any) => ({
    id: tx.id,
    created_at: tx.created_at,
    description: tx.description,
    amount: tx.amount_cents || 0,
    type: tx.transaction_type || "EXPENSE",
  }));

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-white/40">Bem-vindo de volta, {user.email?.split("@")[0]}.</p>
      </header>

      <RealtimeDashboard 
        initialBalance={initialBalance} 
        initialTransactions={initialTransactions} 
      />
    </div>
  );
}
