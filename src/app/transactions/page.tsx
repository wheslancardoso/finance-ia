import { createClient } from "@/utils/supabase/server";
import { TransactionsContent } from "@/components/TransactionsContent";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const familyGroupId = await getFamilyGroup();

  if (!familyGroupId) return null;

  // 1. Buscar Contas do grupo (com detalhes para o filtro)
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type, balance_cents, color_hex")
    .eq("family_group_id", familyGroupId)
    .order("name");

  const accountIds = accounts?.map(a => a.id) || [];

  // 2. Buscar transações vinculadas a essas contas
  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      *,
      categories (name, color_hex, icon_name),
      accounts (name, color_hex)
    `)
    .in("account_id", accountIds)
    .order("date", { ascending: false });

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      <TransactionsContent 
        initialTransactions={transactions || []} 
        accounts={accounts || []} 
      />
    </div>
  );
}

