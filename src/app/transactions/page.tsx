"use client";

import { TransactionsContent } from "@/components/TransactionsContent";
import { useFinancialData } from "@/context/FinancialDataContext";

export default function TransactionsPage() {
  const { recentTransactions, accounts, loading } = useFinancialData();

  if (loading && recentTransactions.length === 0) {
    return (
      <div className="p-8 md:p-12 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      <TransactionsContent 
        initialTransactions={recentTransactions || []} 
        accounts={accounts || []} 
      />
    </div>
  );
}

