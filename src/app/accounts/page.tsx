import { createClient } from "@/utils/supabase/server";
import { AccountCard } from "@/components/AccountCard";
import { Plus } from "lucide-react";
import { AccountsHeader } from "@/components/AccountsHeader";

export default async function AccountsPage() {
  const supabase = await createClient();
  
  // Buscar contas do banco de dados
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  const hasAccounts = accounts && accounts.length > 0;

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-12">
      <AccountsHeader />

      {!hasAccounts ? (
        <div className="py-24 flex flex-col items-center text-center border-2 border-dashed border-white/5 rounded-[32px]">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
            <Plus className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Nenhuma conta cadastrada</h3>
          <p className="text-white/40 max-w-sm mb-8">
            Adicione sua primeira conta bancária ou carteira para começar a rastrear seu patrimônio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
            />
          ))}
        </div>
      )}
    </div>
  );
}
