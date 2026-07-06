"use client";

import { AccountCard } from "@/components/AccountCard";
import { Plus, TrendingUp, TrendingDown, Landmark } from "lucide-react";
import { AccountsHeader } from "@/components/AccountsHeader";
import { useFinancialData } from "@/context/FinancialDataContext";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function AccountsPage() {
  const { accounts, loading } = useFinancialData();
  const hasAccounts = accounts.length > 0;

  const assetsAccounts = accounts.filter(a => a.type !== "CREDIT_CARD");
  const liabilitiesAccounts = accounts.filter(a => a.type === "CREDIT_CARD");

  const totalAssets = assetsAccounts.reduce((sum, a) => sum + (Number(a.balance_cents) || 0), 0);
  const totalLiabilities = liabilitiesAccounts.reduce(
    (sum, a) => sum + (a.total_debt_cents ?? Math.abs(a.balance_cents || 0)),
    0
  );
  const netAssets = totalAssets - totalLiabilities;

  return (
    <div className="px-4 pb-4 pt-0 md:p-12 max-w-7xl mx-auto w-full space-y-8 md:space-y-12">
      <AccountsHeader />

      {loading ? (
        <div className="py-24 flex flex-col items-center text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin mb-4" />
          <p className="text-white/40 text-sm">Carregando contas...</p>
        </div>
      ) : !hasAccounts ? (
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
        <div className="space-y-8 md:space-y-12">
          {/* Sumário de Patrimônio Líquido */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ativos */}
            <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[30px] rounded-full pointer-events-none" />
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Total de Ativos</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-emerald-400 tabular-nums">{formatCurrency(totalAssets)}</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase mt-1">Saldos bancários e aportes</p>
            </div>

            {/* Dívidas */}
            <div className="bg-red-500/[0.03] border border-red-500/10 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-[30px] rounded-full pointer-events-none" />
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Dívida em Cartões</span>
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <h3 className="text-2xl font-black text-red-400 tabular-nums">{formatCurrency(totalLiabilities)}</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase mt-1">Limite utilizado e faturas</p>
            </div>

            {/* Patrimônio Líquido */}
            <div className={cn(
              "border rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl",
              netAssets >= 0 ? "bg-violet-500/[0.03] border-violet-500/10" : "bg-red-950/20 border-red-900/30"
            )}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 blur-[30px] rounded-full pointer-events-none" />
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Patrimônio Líquido</span>
                <Landmark className={cn("w-4 h-4", netAssets >= 0 ? "text-violet-400" : "text-red-400")} />
              </div>
              <h3 className={cn(
                "text-2xl font-black tabular-nums",
                netAssets >= 0 ? "text-white" : "text-red-400"
              )}>{formatCurrency(netAssets)}</h3>
              <p className="text-[10px] text-white/30 font-bold uppercase mt-1">Ativos menos Passivos</p>
            </div>
          </div>

          {/* Seção 1 — Ativos */}
          {assetsAccounts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  Contas Correntes e Investimentos ({assetsAccounts.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {assetsAccounts.map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            </div>
          )}

          {/* Seção 2 — Passivos */}
          {liabilitiesAccounts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  Cartões de Crédito e Obrigações ({liabilitiesAccounts.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {liabilitiesAccounts.map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
