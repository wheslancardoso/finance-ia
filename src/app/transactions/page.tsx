"use client";

import { useEffect, useState } from "react";
import { TransactionsContent } from "@/components/TransactionsContent";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useAccountModal } from "@/context/AccountModalContext";

export default function TransactionsPage() {
  const { accounts, loading: contextLoading } = useFinancialData();
  const { userId } = useAccountModal();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/transactions?user_id=${userId}&limit=500`);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (err) {
        console.error("Erro ao buscar transações:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [userId]);

  if ((loading || contextLoading) && transactions.length === 0) {
    return (
      <div className="p-6 md:p-12 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full overflow-x-hidden">
      <TransactionsContent 
        initialTransactions={transactions || []} 
        accounts={accounts || []} 
      />
    </div>
  );
}

