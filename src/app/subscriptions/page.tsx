import { createClient } from "@/utils/supabase/server";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import GlassCard from "@/components/GlassCard";
import { Zap, Bell, CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { SubscriptionManager } from "@/components/SubscriptionManager";
import { SyncFamilyGroup } from "@/components/SyncFamilyGroup";
import { RecurringTransaction } from "@/context/FinancialDataContext";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const familyGroupId = await getFamilyGroup();

  if (!familyGroupId) return null;

  // 1. Buscar Estado Financeiro Completo via RPC v3
  const { data: financialState } = await supabase.rpc('get_financial_state_v3', {
    p_family_group_id: familyGroupId
  });

  if (!financialState) {
    return <div>Erro ao carregar estado financeiro.</div>;
  }

  const subscriptions: RecurringTransaction[] = financialState.recurring_transactions || [];

  const activeSubs = subscriptions?.filter((s: RecurringTransaction) => s.status === "active") || [];
  
  const totalExpenses = activeSubs
    .filter((s: RecurringTransaction) => s.transaction_type === "EXPENSE")
    .reduce((acc: number, curr: RecurringTransaction) => acc + curr.amount_cents, 0);

  const totalIncomes = activeSubs
    .filter((s: RecurringTransaction) => s.transaction_type === "INCOME")
    .reduce((acc: number, curr: RecurringTransaction) => acc + curr.amount_cents, 0);

  const committedBalance = totalIncomes - totalExpenses;
  const nextBilling = activeSubs.find((s: RecurringTransaction) => s.transaction_type === "EXPENSE");

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-12">
      <SyncFamilyGroup familyGroupId={familyGroupId} />
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-8 space-y-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Zap className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Saldo Livre Estimado</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(committedBalance)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Após todos os custos fixos</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-violet-500/20 bg-violet-500/5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total de Gastos Fixos</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(totalExpenses)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">De {activeSubs.filter((s: RecurringTransaction) => s.transaction_type === 'EXPENSE').length} fontes</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-white/10 bg-white/5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/40">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Receita Recorrente</p>
            <h2 className="text-3xl font-black text-emerald-400 tabular-nums">+{formatCurrency(totalIncomes)}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">Salário e outros fixos</p>
          </div>
        </GlassCard>
      </div>

      <SubscriptionManager initialSubscriptions={subscriptions || []} />
    </div>
  );
}
