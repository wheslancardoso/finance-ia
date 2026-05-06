"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { Wallet, Receipt, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { SpendingChart } from "@/components/SpendingChart";

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
            
            // Atualização simples do saldo para novas transações
            const amount = formattedTx.amount;
            const type = formattedTx.type.toUpperCase();
            if (type === "INCOME") {
              setBalance((prev) => prev + amount);
            } else {
              setBalance((prev) => prev - amount);
            }
          } 
          
          else if (payload.eventType === "DELETE") {
            const oldTx = payload.old as any;
            setTransactions((prev) => prev.filter(tx => tx.id !== oldTx.id));
            // O saldo total é atualizado via router.refresh() que já está nos componentes de exclusão
          }

          else if (payload.eventType === "UPDATE") {
            const updatedTx = payload.new as any;
            setTransactions((prev) => prev.map(tx => 
              tx.id === updatedTx.id 
                ? { ...tx, description: updatedTx.description, amount: updatedTx.amount_cents, type: updatedTx.transaction_type }
                : tx
            ));
            // O saldo total é atualizado via router.refresh() que já está nos componentes de edição
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="z-10 w-full space-y-8">
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

        {/* Transactions Area */}
        <div className="space-y-4 px-2">
          <div className="flex items-center justify-between text-white/80 font-medium">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <h2>Atividade Recente</h2>
            </div>
            <span className="text-[10px] text-green-400/80 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              Live
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

        {/* Visual Trend Section */}
        <div className="pt-4 space-y-4">
          <div className="px-2">
            <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
              Tendência de Gastos
            </span>
          </div>
          <SpendingChart />
        </div>

        <div className="w-full flex justify-end text-[10px] text-white/10 font-bold uppercase tracking-widest px-2">
          v0.2.5-beta
        </div>
      </GlassCard>
    </div>
  );
}
