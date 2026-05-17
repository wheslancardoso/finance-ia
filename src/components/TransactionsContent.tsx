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
  LayoutGrid,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionsContentProps {
  initialTransactions: any[];
  accounts: any[];
}

export function TransactionsContent({ initialTransactions, accounts: serverAccounts }: TransactionsContentProps) {
  const { accounts: contextAccounts, transactions: monthTransactions, loading } = useFinancialData();
  const { openAdd } = useTransactionModal();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !hasFetchedOnce) {
      setHasFetchedOnce(true);
    }
  }, [loading, hasFetchedOnce]);

  const [localTransactions, setLocalTransactions] = useState(initialTransactions);

  // Sincronizar com props iniciais se mudarem
  React.useEffect(() => {
    if (initialTransactions) {
      setLocalTransactions(initialTransactions);
    }
  }, [initialTransactions]);

  // Usar as contas do contexto se disponíveis (pois têm o cálculo da fatura)
  const accounts = contextAccounts.length > 0 ? contextAccounts : serverAccounts;

  // Efeito para sincronizar transações (exclusão e atualização)
  React.useEffect(() => {
    if (monthTransactions && localTransactions && hasFetchedOnce) {
      const currentMonthMap = new Map(monthTransactions.map(t => [t.id, t]));
      const now = new Date();
      const isCurrentMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      };

      setLocalTransactions(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        
        // 1. Atualizar transações existentes e manter transações de outros meses
        let hasChanges = false;
        const updated = prevArray.map(tx => {
          if (!isCurrentMonth(tx.date)) return tx;
          
          const latest = currentMonthMap.get(tx.id);
          if (!latest) return tx; // Vai ser removido no filter abaixo

          // Merge profundo: monthTransactions do contexto não carrega JOIN com accounts/categories.
          // Preservamos esses objetos do tx original (que veio de /api/transactions com SELECT completo).
          // Sem isso, account?.type e account?.closing_day ficam undefined, quebrando o
          // agrupamento por fatura dos cartões de crédito.
          const merged = {
            ...latest,
            account: (latest.account && latest.account.type) ? latest.account : tx.account,
            category: latest.category ?? tx.category,
          };

          if (JSON.stringify({ ...latest, account: undefined, category: undefined }) !==
              JSON.stringify({ ...tx,     account: undefined, category: undefined })) {
            hasChanges = true;
            return merged;
          }
          return tx;
        });

        // 2. Remover o que sumiu do contexto (apenas para o mês atual)
        const currentMonthIds = new Set(monthTransactions.map(t => t.id));
        const filtered = updated.filter(tx => {
          if (!isCurrentMonth(tx.date)) return true;
          return currentMonthIds.has(tx.id);
        });

        if (filtered.length !== prevArray.length) hasChanges = true;

        return hasChanges ? filtered : prev;
      });
    }
  }, [monthTransactions, hasFetchedOnce]);
  
  const filteredTransactions = useMemo(() => {
    const transactionsArray = Array.isArray(localTransactions) ? localTransactions : [];
    const filtered = transactionsArray.filter(tx => {
      const matchesAccount = !selectedAccountId || tx.account_id === selectedAccountId;
      const matchesSearch = !searchQuery || 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesAccount && matchesSearch;
    });

    return filtered;
  }, [localTransactions, selectedAccountId, searchQuery]);

  // Agrupar transações por data ou fatura
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredTransactions.forEach((tx) => {
      const isCredit = tx.account?.type === "CREDIT_CARD";
      let groupKey: string;

      if (isCredit) {
        const inv = getTransactionInvoiceMonth(tx.date, tx.account?.closing_day);
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
    <div className="space-y-6 md:space-y-8 overflow-x-hidden">
      {/* Account Selector Strip */}
      <div className="flex gap-3 overflow-x-auto pb-2 md:pb-4 scrollbar-hide">
        <button
          onClick={() => setSelectedAccountId(null)}
          className={cn(
            "flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all",
            !selectedAccountId 
              ? "bg-violet-500/20 border-violet-500/40 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.15)]" 
              : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20"
          )}
          data-testid="account-filter-all"
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
              data-testid={`account-filter-${acc.id}`}
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
                "text-[10px] md:text-xs font-black tabular-nums truncate w-full mt-0.5",
                isSelected ? "text-white" : "text-white/60"
              )}>
                {isCredit ? (() => {
                  const closedAmount = acc.closed_invoice_cents || 0;
                  const openAmount = acc.open_invoice_cents || 0;
                  const showClosed = closedAmount > 0;
                  const label = showClosed ? "Fechada" : "Aberta";
                  const amountStr = formatCurrency(showClosed ? closedAmount : openAmount);
                  return (
                    <span className="flex items-center gap-1">
                      <span className="opacity-40 hidden xs:inline">{label}:</span>
                      <span>{amountStr}</span>
                    </span>
                  );
                })() : formatCurrency(acc.balance_cents || 0)}
              </p>
            </button>
          );
        })}
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {selectedAccountId ? accounts.find(a => a.id === selectedAccountId)?.name : "Histórico"}
          </h2>
          <p className="text-[11px] md:text-sm text-white/40 font-medium">
            {filteredTransactions.length} transações encontradas.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative group flex-1 md:flex-none">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-white/20 group-focus-within:text-violet-400 transition-colors" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              data-testid="transaction-search-input"
              className="bg-white/5 border border-white/10 rounded-2xl py-2.5 md:py-3 pl-9 md:pl-10 pr-4 text-xs md:text-sm text-white outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all w-full md:w-64"
            />
          </div>
          <button className="p-2.5 md:p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all shrink-0">
            <Filter className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button 
            onClick={() => openAdd(selectedAccountId)}
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white p-2.5 md:px-5 md:py-3 rounded-2xl font-semibold transition-all shadow-lg shadow-violet-600/20 active:scale-95 shrink-0"
            data-testid="add-transaction-button"
          >
            <Plus className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline">Nova Transação</span>
          </button>
        </div>
      </header>

      {/* Transactions List */}
      <div className="space-y-8 md:space-y-12 min-h-[400px]">
        <AnimatePresence>
          {Object.entries(groupedTransactions).map(([date, txs]) => (
            <motion.div 
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 px-2 min-w-0">
                <CalendarIcon className="w-4 h-4 text-violet-400 shrink-0" />
                <h3 className="text-[10px] md:text-xs font-bold text-white/30 uppercase tracking-[0.1em] md:tracking-[0.2em] truncate">
                  {date}
                </h3>
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
