"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { Wallet, Receipt, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";

interface Transaction {
  id: string;
  created_at: string;
  description: string;
  amount: number; // usually amount_cents in payload
  type: string; // INCOME, EXPENSE, TRANSFER, etc.
}

interface RealtimeDashboardProps {
  initialBalance: number;
  initialTransactions: Transaction[];
}

export default function RealtimeDashboard({
  initialBalance,
  initialTransactions,
}: RealtimeDashboardProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime_transactions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const newTx = payload.new as any;
          
          // Map payload fields to our Transaction interface if necessary
          // Supabase usually returns exact column names
          const formattedTx: Transaction = {
            id: newTx.id,
            created_at: newTx.created_at,
            description: newTx.description,
            amount: newTx.amount || newTx.amount_cents || 0,
            type: newTx.type,
          };

          // Update transactions list (keep max 3)
          setTransactions((prev) => [formattedTx, ...prev].slice(0, 3));

          // Update balance
          const amount = formattedTx.amount;
          const type = formattedTx.type.toUpperCase();

          if (type === "INCOME") {
            setBalance((prev) => prev + amount);
          } else if (type === "EXPENSE" || type === "TRANSFER") {
            setBalance((prev) => prev - amount);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="z-10 w-full max-w-lg px-6">
      <GlassCard className="flex flex-col gap-8">
        {/* Header & Balance */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-white/60 text-sm font-medium tracking-wider uppercase">
              Saldo Disponível
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-white tabular-nums">
              {formatCurrency(balance)}
            </h1>
          </div>
        </div>

        <div className="w-full h-[1px] bg-white/10" />

        {/* Transactions Area */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/80 font-medium">
            <Receipt className="w-4 h-4" />
            <h2>Transações Recentes</h2>
          </div>

          <div className="grid gap-3">
            {transactions.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/40 text-sm italic">
                  Nenhuma transação encontrada. Mande um recibo!
                </p>
              </div>
            ) : (
              transactions.map((tx) => {
                const isIncome = tx.type.toUpperCase() === "INCOME";
                return (
                  <div
                    key={tx.id}
                    className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors hover:bg-white/10"
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
                        <p className="text-white/40 text-xs" suppressHydrationWarning>
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <p className={cn(
                      "font-semibold tabular-nums",
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

        <div className="w-full flex justify-between items-center text-xs">
          <span className="flex items-center gap-1.5 text-green-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live Update Active
          </span>
          <span className="text-white/40">v0.2.0-beta</span>
        </div>
      </GlassCard>
    </div>
  );
}
