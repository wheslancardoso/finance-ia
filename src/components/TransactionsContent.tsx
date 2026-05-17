"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { format, addMonths } from "date-fns";
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
  const [selectedInvoiceKey, setSelectedInvoiceKey] = useState<string | null>(null);

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !hasFetchedOnce) {
      setHasFetchedOnce(true);
    }
  }, [loading, hasFetchedOnce]);

  const [localTransactions, setLocalTransactions] = useState(initialTransactions);

  // Sincronizar com props iniciais apenas se os dados reais mudarem (ex: Server Actions / router.refresh)
  // Isso evita o loop de reset infinito que desfazia o sync, mas permite a UI reagir a mutações externas.
  React.useEffect(() => {
    if (initialTransactions) {
      setLocalTransactions(prev => {
        if (!prev || JSON.stringify(prev) !== JSON.stringify(initialTransactions)) {
          return initialTransactions;
        }
        return prev;
      });
    }
  }, [initialTransactions]);

  // Usar as contas do contexto se disponíveis (pois têm o cálculo da fatura)
  const accounts = contextAccounts.length > 0 ? contextAccounts : serverAccounts;

  // Efeito para sincronizar transações (exclusão e atualização)
  React.useEffect(() => {
    if (monthTransactions && localTransactions && hasFetchedOnce) {
      const currentMonthMap = new Map(monthTransactions.map(t => [t.id, t]));
      setLocalTransactions(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        
        // 1. Atualizar transações locais com os dados mais recentes vindos do contexto do mês.
        // A deleção não é feita por diffing aqui, pois monthTransactions omite parcelas de cartão
        // que fecharam para o mês seguinte. A deleção real já é gerenciada por router.refresh() 
        // nas ações do sistema, que re-alimenta initialTransactions.
        let hasChanges = false;
        const updated = prevArray.map(tx => {
          const latest = currentMonthMap.get(tx.id);
          if (!latest) return tx; // Mantém transações de outros meses/faturas intactas

          // Merge profundo: monthTransactions do contexto não carrega JOIN com accounts/categories.
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

        return hasChanges ? updated : prev;
      });
    }
  }, [monthTransactions, hasFetchedOnce]);
  
  const activeAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [selectedAccountId, accounts]);

  const isCreditSelected = activeAccount?.type === "CREDIT_CARD";

  // Gera a lista de faturas/meses disponíveis para o cartão selecionado
  const invoiceMonths = useMemo(() => {
    if (!selectedAccountId || !isCreditSelected) return [];
    
    const closingDay = activeAccount?.closing_day || 10;
    const monthsMap = new Map<string, { year: number; month: number; key: string; label: string }>();
    
    const now = new Date();
    // Gerar 2 meses anteriores, mês atual e 6 meses futuros
    for (let i = -2; i <= 6; i++) {
      const d = addMonths(now, i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = format(d, "MMM'/'yy", { locale: ptBR });
      monthsMap.set(key, { year: y, month: m, key, label });
    }

    // Adicionar outros meses reais das transações cadastradas no cartão
    const txsArray = Array.isArray(localTransactions) ? localTransactions : [];
    txsArray.forEach(tx => {
      if (tx.account_id === selectedAccountId) {
        const inv = getTransactionInvoiceMonth(tx.date, closingDay);
        const key = `${inv.year}-${String(inv.month + 1).padStart(2, '0')}`;
        if (!monthsMap.has(key)) {
          const d = new Date(inv.year, inv.month, 1);
          const label = format(d, "MMM'/'yy", { locale: ptBR });
          monthsMap.set(key, { year: inv.year, month: inv.month, key, label });
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => {
      return new Date(a.year, a.month, 1).getTime() - new Date(b.year, b.month, 1).getTime();
    });
  }, [selectedAccountId, activeAccount, localTransactions, isCreditSelected]);

  // Calcula o valor total de faturas para cada mês do seletor
  const invoiceTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    if (!selectedAccountId || !isCreditSelected) return totals;

    const txsArray = Array.isArray(localTransactions) ? localTransactions : [];
    const cardTxs = txsArray.filter(tx => tx.account_id === selectedAccountId);

    invoiceMonths.forEach(im => {
      const totalCents = cardTxs
        .filter(tx => {
          const inv = getTransactionInvoiceMonth(tx.date, activeAccount?.closing_day);
          return inv.year === im.year && inv.month === im.month;
        })
        .reduce((sum, tx) => sum + (tx.amount_cents || 0), 0);
      totals[im.key] = totalCents;
    });

    return totals;
  }, [selectedAccountId, isCreditSelected, localTransactions, invoiceMonths, activeAccount]);

  // Atualiza a fatura ativa por padrão para a fatura aberta do ciclo
  useEffect(() => {
    if (selectedAccountId && isCreditSelected && invoiceMonths.length > 0) {
      const now = new Date();
      const closingDay = activeAccount?.closing_day || 10;
      // Se já passou do dia de fechamento deste mês, a fatura aberta por padrão é a do mês que vem (Junho)
      const isAfterClosing = now.getDate() >= closingDay;
      const defaultDate = isAfterClosing ? addMonths(now, 1) : now;
      const defaultKey = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}`;
      
      const exists = invoiceMonths.some(im => im.key === defaultKey);
      if (exists) {
        setSelectedInvoiceKey(defaultKey);
      } else {
        setSelectedInvoiceKey(invoiceMonths[2]?.key || invoiceMonths[0]?.key);
      }
    } else {
      setSelectedInvoiceKey(null);
    }
  }, [selectedAccountId, isCreditSelected, invoiceMonths, activeAccount]);

  const filteredTransactions = useMemo(() => {
    const transactionsArray = Array.isArray(localTransactions) ? localTransactions : [];
    const filtered = transactionsArray.filter(tx => {
      const matchesAccount = !selectedAccountId || tx.account_id === selectedAccountId;
      const matchesSearch = !searchQuery || 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesInvoice = !selectedAccountId || !isCreditSelected || !selectedInvoiceKey || (() => {
        const [yStr, mStr] = selectedInvoiceKey.split("-");
        const y = parseInt(yStr);
        const m = parseInt(mStr) - 1;
        const inv = getTransactionInvoiceMonth(tx.date, tx.account?.closing_day || activeAccount?.closing_day);
        return inv.year === y && inv.month === m;
      })();

      return matchesAccount && matchesSearch && matchesInvoice;
    });

    return filtered;
  }, [localTransactions, selectedAccountId, searchQuery, selectedInvoiceKey, isCreditSelected, activeAccount]);

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
      {/* Painel da Fatura Premium - Exibido apenas para Cartões de Crédito */}
      <AnimatePresence>
        {isCreditSelected && activeAccount && selectedInvoiceKey && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-2xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row gap-6 items-center justify-between group"
          >
            {/* Luz Neon no fundo baseada na cor do cartão */}
            <div 
              className="absolute -right-32 -top-32 w-64 h-64 blur-[100px] rounded-full opacity-20 pointer-events-none transition-all duration-700" 
              style={{ backgroundColor: activeAccount.color_hex }}
            />

            <div className="flex flex-col md:flex-row gap-6 items-center w-full md:w-auto">
              <div 
                className="w-16 h-16 rounded-[24px] flex items-center justify-center border shadow-2xl shrink-0 transition-transform duration-500 group-hover:scale-105"
                style={{ 
                  backgroundColor: `${activeAccount.color_hex}15`,
                  borderColor: `${activeAccount.color_hex}30`,
                  color: activeAccount.color_hex 
                }}
              >
                <CreditCard className="w-8 h-8" />
              </div>

              <div className="text-center md:text-left space-y-1.5 min-w-0">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                  Fatura do Cartão • {activeAccount.name}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                  <h2 
                    data-testid="invoice-total-value"
                    className="text-3xl md:text-4xl font-black text-white tracking-tight tabular-nums leading-none"
                  >
                    {formatCurrency(invoiceTotals[selectedInvoiceKey] || 0)}
                  </h2>
                  <span 
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0",
                      (() => {
                        const [yStr, mStr] = selectedInvoiceKey.split("-");
                        const y = parseInt(yStr);
                        const m = parseInt(mStr) - 1;
                        const now = new Date();
                        const currentYear = now.getFullYear();
                        const currentMonth = now.getMonth();
                        
                        if (y < currentYear || (y === currentYear && m < currentMonth)) {
                          return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                        }
                        return "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse";
                      })()
                    )}
                  >
                    {(() => {
                      const [yStr, mStr] = selectedInvoiceKey.split("-");
                      const y = parseInt(yStr);
                      const m = parseInt(mStr) - 1;
                      const now = new Date();
                      const currentYear = now.getFullYear();
                      const currentMonth = now.getMonth();
                      
                      if (y < currentYear || (y === currentYear && m < currentMonth)) {
                        return "FECHADA";
                      }
                      return "ABERTA";
                    })()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-[9px] font-black text-white/30 uppercase tracking-widest pt-1">
                  <span>
                    Fechamento: <strong className="text-white/60 font-black">
                      {(() => {
                        const [yStr, mStr] = selectedInvoiceKey.split("-");
                        const y = parseInt(yStr);
                        const m = parseInt(mStr) - 1;
                        const closingDate = new Date(y, m - 1, activeAccount.closing_day || 10);
                        return format(closingDate, "dd 'de' MMM", { locale: ptBR });
                      })()}
                    </strong>
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10 hidden sm:inline" />
                  <span>
                    Vencimento: <strong className="text-white/60 font-black">
                      {(() => {
                        const [yStr, mStr] = selectedInvoiceKey.split("-");
                        const y = parseInt(yStr);
                        const m = parseInt(mStr) - 1;
                        const dueDate = new Date(y, m, activeAccount.due_day || 17);
                        return format(dueDate, "dd 'de' MMMM", { locale: ptBR });
                      })()}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center md:justify-start">
              {invoiceMonths.map((im) => {
                const isChipSelected = selectedInvoiceKey === im.key;
                const valueCents = invoiceTotals[im.key] || 0;
                
                return (
                  <button
                    key={im.key}
                    onClick={() => setSelectedInvoiceKey(im.key)}
                    className={cn(
                      "relative flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl border transition-all text-center min-w-[76px]",
                      isChipSelected
                        ? "bg-white/10 border-white/20 text-white shadow-lg"
                        : "bg-white/2 border-white/5 text-white/40 hover:bg-white/5 hover:border-white/10 hover:text-white/70"
                    )}
                  >
                    <span className="text-[9px] font-black uppercase tracking-wider">{im.label}</span>
                    <span className={cn(
                      "text-[8px] font-bold tabular-nums mt-0.5",
                      isChipSelected ? "text-violet-300" : "text-white/30"
                    )}>
                      {valueCents > 0 ? formatCurrency(valueCents) : "R$ 0,00"}
                    </span>
                    {isChipSelected && (
                      <motion.div 
                        layoutId="active-invoice-chip"
                        className="absolute inset-0 rounded-2xl border border-violet-500/30 bg-violet-600/5 shadow-[0_0_15px_rgba(139,92,246,0.15)] pointer-events-none"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
