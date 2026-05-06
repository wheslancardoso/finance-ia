import { createClient } from "@/utils/supabase/server";
import { AccountCard } from "@/components/AccountCard";
import { Plus } from "lucide-react";

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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-white">Minhas Contas</h2>
          <p className="text-white/40 font-medium">Gerencie seus ativos e cartões em um só lugar.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-semibold transition-all shadow-lg shadow-violet-600/20 active:scale-95">
          <Plus className="w-5 h-5" />
          Nova Conta
        </button>
      </header>

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
              name={acc.name}
              type={acc.type}
              balance={acc.balance_cents}
              colorHex={acc.color_hex}
            />
          ))}
        </div>
      )}
    </div>
  );
}
