"use client";

import { AccountCard } from "@/components/AccountCard";
import { Plus } from "lucide-react";
import { AccountsHeader } from "@/components/AccountsHeader";
import { useFinancialData } from "@/context/FinancialDataContext";

export default function AccountsPage() {
  const { accounts, loading } = useFinancialData();
  const hasAccounts = accounts.length > 0;

  return (
    <div className="px-4 pb-4 pt-0 md:p-12 max-w-7xl mx-auto w-full space-y-6 md:space-y-12">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
