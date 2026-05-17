"use client";

import { useEffect, useState } from "react";
import { TransactionsContent } from "@/components/TransactionsContent";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useAccountModal } from "@/context/AccountModalContext";
import { db } from "@/lib/db";

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
        } else {
          console.warn("⚠️ API de transações retornou erro. Buscando do Dexie local...");
          const localData = await db.transactions
            .where('user_id')
            .equals(userId)
            .toArray();
          
          const localCategories = await db.categories.where('user_id').equals(userId).toArray();
          const localAccounts = await db.accounts.where('user_id').equals(userId).toArray();
          
          const catMap = new Map(localCategories.map(c => [c.id, c]));
          const accMap = new Map(localAccounts.map(a => [a.id, a]));
          
          const mappedData = localData.map((t: any) => ({
            ...t,
            category: catMap.get(t.category_id),
            account: accMap.get(t.account_id),
            category_name: t.category_name || catMap.get(t.category_id)?.name,
            category_type: t.category_type || catMap.get(t.category_id)?.type,
          }));

          mappedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(mappedData as any);
        }
      } catch (err) {
        console.error("Erro ao buscar transações, tentando Dexie local:", err);
        try {
          const localData = await db.transactions
            .where('user_id')
            .equals(userId)
            .toArray();
          
          const localCategories = await db.categories.where('user_id').equals(userId).toArray();
          const localAccounts = await db.accounts.where('user_id').equals(userId).toArray();
          
          const catMap = new Map(localCategories.map(c => [c.id, c]));
          const accMap = new Map(localAccounts.map(a => [a.id, a]));
          
          const mappedData = localData.map((t: any) => ({
            ...t,
            category: catMap.get(t.category_id),
            account: accMap.get(t.account_id),
            category_name: t.category_name || catMap.get(t.category_id)?.name,
            category_type: t.category_type || catMap.get(t.category_id)?.type,
          }));

          mappedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(mappedData as any);
        } catch (dexieErr) {
          console.error("Critical: Dexie fallback failed:", dexieErr);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [userId]);

  if ((loading || contextLoading) && transactions.length === 0) {
    return (
      <div className="p-4 md:p-12 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-0 md:p-12 max-w-7xl mx-auto w-full overflow-x-hidden">
      <TransactionsContent 
        initialTransactions={transactions || []} 
        accounts={accounts || []} 
      />
    </div>
  );
}

