"use client";

import React, { useState, useMemo } from "react";
import { TransactionItem } from "./TransactionItem";
import GlassCard from "./GlassCard";
import { formatCurrency, cn, getTransactionInvoiceMonth } from "@/lib/utils";
import { 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  CreditCard,
  Wallet,
  LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialData } from "@/context/FinancialDataContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionsContentProps {
  initialTransactions: any[];
  accounts: any[];
}

export function TransactionsContent({ initialTransactions, accounts: serverAccounts }: TransactionsContentProps) {
  const { accounts: contextAccounts } = useFinancialData();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Usar as contas do contexto se disponíveis (pois têm o cálculo da fatura)
  const accounts = contextAccounts.length > 0 ? contextAccounts : serverAccounts;

  const filteredTransactions = useMemo(() => {
    return initialTransactions.filter(tx => {
      const matchesAccount = !selectedAccountId || tx.account_id === selectedAccountId;
      const matchesSearch = !searchQuery || 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesAccount && matchesSearch;
    });
  }, [initialTransactions, selectedAccountId, searchQuery]);

  // Agrupar transações por data ou fatura
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredTransactions.forEach((tx) => {
      const isCredit = tx.accounts?.type === "CREDIT_CARD";
      let groupKey: string;

      if (isCredit) {
        const inv = getTransactionInvoiceMonth(tx.date, tx.accounts?.closing_day);
        groupKey = `Fatura de ${format(new Date(inv.year, inv.month, 1), "MMMM 'de' yyyy", { locale: ptBR })}`;
      } else {
        groupKey = format(new Date(tx.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  return (
    <div className="space-y-8">
      {/* Account Selector Strip */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <button
          onClick={() => setSelectedAccountId(null)}
          className={cn(
            "flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all",
            !selectedAccountId 
              ? "bg-violet-500/20 border-violet-500/40 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.15)]" 
              : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wider">Tudo</span>
        </button>

        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          const isCredit = acc.type === "CREDIT_CARD";
          
          return (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={cn(
                "flex-shrink-0 flex flex-col min-w-[140px] p-3 rounded-2xl border transition-all text-left group",
                isSelected
                  ? "bg-white/10 border-white/30 text-white shadow-xl"
                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center border"
                  style={{ 
                    backgroundColor: `${acc.color_hex}20`,
                    borderColor: `${acc.color_hex}40`,
                    color: acc.color_hex 
                  }}
                >
                  {isCredit ? <CreditCard className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                </div>
                {isSelected && (
                   <motion.div 
                    layoutId="active-indicator"
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]"
                   />
                )}
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest truncate w-full opacity-40">
                {acc.name}
              </p>
              <p className={cn(
                "text-xs font-black tabular-nums truncate w-full mt-0.5",
                isSelected ? "text-white" : "text-white/60"
              )}>
                {isCredit 
                  ? `${(acc.closed_invoice_cents || 0) > 0 ? "Fechada" : "Aberta"}: ` 
                  : ""}
                {formatCurrency(isCredit ? (acc.current_invoice_cents || 0) : (acc.balance_cents || 0))}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search and Filters Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            {selectedAccountId ? accounts.find(a => a.id === selectedAccountId)?.name : "Histórico"}
          </h2>
          <p className="text-white/40 font-medium">
            {filteredTransactions.length} transações encontradas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-violet-400 transition-colors" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar transação..."
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all w-64"
            />
          </div>
          <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Transactions List */}
      <div className="space-y-12 min-h-[400px]">
        <AnimatePresence mode="popLayout">
          {Object.entries(groupedTransactions).map(([date, txs]) => (
            <motion.div 
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 px-2">
                <CalendarIcon className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">{date}</h3>
              </div>

              <div className="grid gap-3">
                {txs.map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredTransactions.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center space-y-4"
          >
             <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-white/10" />
             </div>
             <h3 className="text-white font-medium text-xl">Nenhuma transação encontrada</h3>
             <p className="text-white/40 max-w-xs mx-auto">
                Tente ajustar os filtros ou buscar por outro termo.
             </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
