"use client";

import { useEffect, useState, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import { Wallet, Receipt, ArrowUpRight, ArrowDownLeft, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { SpendingChart } from "@/components/SpendingChart";
import { SpendingCapacity } from "@/components/SpendingCapacity";
import { TimeTravelSlider } from "@/components/TimeTravelSlider";
import { calculateProjectedBalance } from "@/utils/finance-projections";
import { addDays } from "date-fns";

interface Transaction {
  id: string;
  created_at: string;
  description: string;
  amount: number;
  type: string;
}

interface Budget {
  category: string;
  spent: number;
  limit: number;
}

interface RecurringItem {
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  next_date: string;
}

interface RealtimeDashboardProps {
  initialBalance: number;
  initialTransactions: Transaction[];
  initialBudgets: Budget[];
  initialRecurring: RecurringItem[];
}

export default function RealtimeDashboard({
  initialBalance,
  initialTransactions,
  initialBudgets,
  initialRecurring,
}: RealtimeDashboardProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [budgets] = useState<Budget[]>(initialBudgets);
  const [recurring] = useState<RecurringItem[]>(initialRecurring);
  
  // Estado para a Viagem no Tempo
  const [travelDays, setTravelDays] = useState(0);

  // Cálculo do Saldo Projetado
  const displayedBalance = useMemo(() => {
    if (travelDays === 0) return balance;
    
    return calculateProjectedBalance(
      balance,
      addDays(new Date(), travelDays),
      recurring,
      budgets.map(b => ({ amount_cents: b.limit, spent_this_month: b.spent }))
    );
  }, [balance, travelDays, recurring, budgets]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime_dashboard_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTx = payload.new as any;
            const formattedTx: Transaction = {
              id: newTx.id,
              created_at: newTx.created_at,
              description: newTx.description,
              amount: newTx.amount_cents || 0,
              type: newTx.transaction_type,
            };

            setTransactions((prev) => [formattedTx, ...prev].slice(0, 3));
            
            const amount = formattedTx.amount;
            const type = formattedTx.type.toUpperCase();
            if (type === "INCOME") {
              setBalance((prev) => prev + amount);
            } else {
              setBalance((prev) => prev - amount);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="z-10 w-full space-y-8 pb-20">
      {/* 1. Time Travel Slider - DESTAQUE */}
      <TimeTravelSlider currentDays={travelDays} onDateChange={setTravelDays} />

      {/* 2. Card de Saldo Central */}
      <GlassCard className="flex flex-col gap-8 relative overflow-hidden">
        {travelDays > 0 && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-pulse" />
        )}
        
        <div className="flex flex-col items-center gap-6">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner transition-all duration-500",
            travelDays > 0 
              ? "bg-violet-500/20 border-violet-500/40 text-violet-400" 
              : "bg-white/10 border-white/20 text-white"
          )}>
            {travelDays > 0 ? <Zap className="w-8 h-8" /> : <Wallet className="w-8 h-8" />}
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-white/60 text-sm font-medium tracking-wider uppercase">
              {travelDays > 0 ? "Saldo Projetado" : "Saldo Disponível"}
            </p>
            <h1 className={cn(
              "text-5xl font-bold tracking-tight tabular-nums transition-all duration-500",
              travelDays > 0 ? "text-violet-400 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]" : "text-white"
            )}>
              {formatCurrency(displayedBalance)}
            </h1>
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <div className="px-2">
            <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
              Tendência de Gastos
            </span>
          </div>
          <SpendingChart />
        </div>
      </GlassCard>

      {/* 3. Seção de Capacidade de Gasto */}
      {budgets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest">
              Vesper Intelligence: Limites Ativos
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {budgets.map((budget, index) => (
              <SpendingCapacity
                key={index}
                category={budget.category}
                spent={budget.spent}
                limit={budget.limit}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. Atividade Recente */}
      <GlassCard className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-white/80 font-medium">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <h2 className="uppercase text-xs font-bold tracking-widest text-white/40">Atividade Recente</h2>
            </div>
            <span className="text-[10px] text-green-400/80 flex items-center gap-1 font-bold uppercase tracking-tighter">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Feed
            </span>
          </div>

          <div className="grid gap-3">
            {transactions.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/40 text-sm italic">
                  Aguardando movimentações...
                </p>
              </div>
            ) : (
              transactions.map((tx) => {
                const isIncome = tx.type?.toUpperCase() === "INCOME";
                return (
                  <div
                    key={tx.id}
                    className="group bg-white/2 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-white/5 hover:border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border",
                        isIncome 
                          ? "bg-green-500/10 border-green-500/20 text-green-400" 
                          : "bg-red-500/10 border-red-500/20 text-red-400"
                      )}>
                        {isIncome ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium line-clamp-1">{tx.description}</p>
                        <p className="text-white/40 text-[10px] font-bold uppercase" suppressHydrationWarning>
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <p className={cn(
                      "font-bold tabular-nums",
                      isIncome ? "text-green-400" : "text-white"
                    )}>
                      {isIncome ? "+" : "-"} {formatCurrency(tx.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="w-full flex justify-end text-[10px] text-white/5 font-bold uppercase tracking-widest">
          v0.3.0-alpha
        </div>
      </GlassCard>
    </div>
  );
}
