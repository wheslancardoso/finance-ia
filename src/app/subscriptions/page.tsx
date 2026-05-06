import { createClient } from "@/utils/supabase/server";
import { getFamilyGroup } from "@/utils/supabase/auth-helpers";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import GlassCard from "@/components/GlassCard";
import { Zap, Bell, CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { SubscriptionManager } from "@/components/SubscriptionManager";

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const familyGroupId = await getFamilyGroup();

  const { data: subscriptions } = await supabase
    .from("recurring_transactions")
    .select(`
      *,
      categories(name, icon),
      accounts(name, color_hex)
    `)
    .eq("family_group_id", familyGroupId)
    .eq("transaction_type", "EXPENSE")
    .order("next_date", { ascending: true });

  const activeSubscriptions = subscriptions?.filter(s => s.status === "active") || [];
  const totalMonthly = activeSubscriptions.reduce((acc, curr) => {
    if (curr.frequency === "monthly") return acc + curr.amount_cents;
    if (curr.frequency === "weekly") return acc + (curr.amount_cents * 4);
    if (curr.frequency === "yearly") return acc + (curr.amount_cents / 12);
    return acc + curr.amount_cents;
  }, 0);

  const nextBilling = activeSubscriptions[0];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-12">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-8 space-y-4 border-violet-500/20 bg-violet-500/5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <Zap className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Custo Fixo Mensal</p>
            <h2 className="text-3xl font-black text-white tabular-nums">{formatCurrency(totalMonthly)}</h2>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4 border-amber-500/20 bg-amber-500/5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Próximo Vencimento</p>
            <h2 className="text-3xl font-black text-white">
              {nextBilling ? format(new Date(nextBilling.next_date), "dd/MM") : "--/--"}
            </h2>
            <p className="text-[10px] text-white/20 font-bold uppercase truncate">{nextBilling?.description || "Nenhuma pendência"}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Serviços Ativos</p>
            <h2 className="text-3xl font-black text-white">{activeSubscriptions.length}</h2>
            <p className="text-[10px] text-white/20 font-bold uppercase">De {subscriptions?.length || 0} cadastrados</p>
          </div>
        </GlassCard>
      </div>

      <SubscriptionManager initialSubscriptions={subscriptions || []} />
    </div>
  );
}
