import { createClient } from "@/utils/supabase/server";
import { TransactionItem } from "@/components/TransactionItem";
import GlassCard from "@/components/GlassCard";
import { formatCurrency, cn } from "@/lib/utils";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft,
  Calendar as CalendarIcon
} from "lucide-react";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const familyGroupId = await getFamilyGroup();

  // 1. Buscar IDs das contas do grupo
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("family_group_id", familyGroupId);

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

  // Agrupar transações por data
  const groupedTransactions: Record<string, any[]> = {};
  
  transactions?.forEach((tx) => {
    const date = new Date(tx.date).toLocaleDateString("pt-BR", { 
      day: "2-digit", 
      month: "long", 
      year: "numeric" 
    });
    if (!groupedTransactions[date]) {
      groupedTransactions[date] = [];
    }
    groupedTransactions[date].push(tx);
  });

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-white">Histórico</h2>
          <p className="text-white/40 font-medium">Acompanhe cada centavo que entra e sai.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-violet-400 transition-colors" />
            <input 
              placeholder="Buscar transação..."
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all w-64"
            />
          </div>
          <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="space-y-12">
        {Object.entries(groupedTransactions).map(([date, txs]) => (
          <div key={date} className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <CalendarIcon className="w-4 h-4 text-violet-400" />
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">{date}</h3>
            </div>

            <div className="grid gap-3">
              {txs.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>
          </div>
        ))}

        {(transactions?.length === 0 || !transactions) && (
          <div className="py-24 text-center space-y-4">
             <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-white/10" />
             </div>
             <h3 className="text-white font-medium text-xl">Nenhuma transação encontrada</h3>
             <p className="text-white/40 max-w-xs mx-auto">
                Parece que você ainda não registrou nada. Use o botão "+" para começar!
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
