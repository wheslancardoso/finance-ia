import { createClient } from "@/utils/supabase/server";
import RealtimeDashboard from "@/components/RealtimeDashboard";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Buscar o grupo familiar do usuário
  let { data: familyMember } = await supabase
    .from("family_members")
    .select("family_group_id")
    .eq("user_id", user.id)
    .single();

  let familyGroupId = familyMember?.family_group_id;

  // 2. Se não tiver grupo, criar um inicial
  if (!familyGroupId) {
    // Criar o grupo
    const { data: newGroup, error: groupError } = await supabase
      .from("family_groups")
      .insert({ name: "Minha Família" })
      .select()
      .single();

    if (!groupError && newGroup) {
      familyGroupId = newGroup.id;
      // Vincular o usuário como admin
      await supabase
        .from("family_members")
        .insert({
          family_group_id: familyGroupId,
          user_id: user.id,
          role: "admin"
        });
    }
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
