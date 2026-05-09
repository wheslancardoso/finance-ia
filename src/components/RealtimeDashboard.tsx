"use client";

import React, { useState, useMemo } from "react";
import { SpendingCapacity } from "./SpendingCapacity";
import { TransactionTimeline } from "./TransactionTimeline";
import { MonthNavigator } from "./MonthNavigator";
import { getProjectedDetails, ProjectedTransaction } from "@/utils/finance-projections";
import { ProjectedTimeline } from "./ProjectedTimeline";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, History, Zap, ShieldCheck, AlertCircle } from "lucide-react";
import { addDays, addMonths, endOfMonth, differenceInDays, isSameMonth, startOfMonth } from "date-fns";
import { QuickSyncModal } from "./QuickSyncModal";
import { cn } from "@/lib/utils";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";

interface RealtimeDashboardProps {
  initialBalance: number;
  initialTransactions: any[];
  initialBudgets: any[];
  initialRecurring: any[];
  lastFutureTransactionDate?: string | null;
  accounts: any[];
}

export default function RealtimeDashboard({ 
  initialBalance, 
  initialTransactions, 
  initialBudgets,
  initialRecurring,
  lastFutureTransactionDate,
  accounts
}: RealtimeDashboardProps) {
  const [targetDate, setTargetDate] = useState<Date>(startOfMonth(new Date()));
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const { accounts: liveAccounts } = useFinancialData();

  const handleQuickSync = (account: any) => {
    setSelectedAccount(account);
    setSyncModalOpen(true);
  };

  // 1. Cálculo da Projeção (Viagem no Tempo por Meses)
  const projection = useMemo(() => {
    const formattedBudgets = initialBudgets.map(b => ({
      amount_cents: b.limit,
      spent_this_month: b.spent,
      category: b.category
    }));
    return getProjectedDetails(initialBalance, targetDate, initialRecurring || [], formattedBudgets);
  }, [initialBalance, initialRecurring, targetDate, initialBudgets]);

  const projectedBalance = projection.totalBalance;

  // 2. Visão Prática: "Quanto me sobra este mês?"
  const monthlyOutlook = useMemo(() => {
    const now = new Date();
    const endOfCurrentMonth = endOfMonth(now);
    
    // --- PARCELAS FUTURAS DESTE MÊS (transações agendadas até fim do mês) ---
    const futureThisMonth = (initialRecurring || [])
      .filter(item => {
        if ((item as any).frequency !== "once") return false;
        const d = new Date(item.next_date);
        const isCreditCard = accounts.find(a => a.id === (item as any).account_id)?.type === "CREDIT_CARD";
        return d > now && d <= endOfCurrentMonth && !isCreditCard;
      })
      .reduce((sum, item) => {
        if (item.transaction_type === "EXPENSE") return sum + item.amount_cents;
        if (item.transaction_type === "INCOME") return sum - item.amount_cents;
        return sum;
      }, 0);

    // --- RECORRENTES até fim do mês ---
    let recurringThisMonth = 0;
    (initialRecurring || []).filter(item => (item as any).frequency !== "once").forEach(item => {
      // Evitar contagem dupla: Se a recorrente for em cartão, ela já vai aparecer na fatura aberta/fechada conforme o tempo passa
      const isCreditCard = accounts.find(a => a.id === (item as any).account_id)?.type === "CREDIT_CARD";
      if (isCreditCard) return;

      const occDate = new Date(item.next_date);
      // Se a próxima data é neste mês (mesmo que já tenha passado), nós a contabilizamos como um compromisso do mês atual
      // a menos que já tenha passado para o mês que vem (o que o sistema faz automaticamente após o pagamento/vencimento)
      if (occDate <= endOfCurrentMonth) {
        if (item.transaction_type === "EXPENSE") recurringThisMonth += item.amount_cents;
        else if (item.transaction_type === "INCOME") recurringThisMonth -= item.amount_cents;
      }
    });

    // --- TOTAL DE DÍVIDA NOS CARTÕES ---
    const todayDay = new Date().getDate();
    const cardBreakdown = liveAccounts
      .filter((a: any) => a.type === "CREDIT_CARD")
      .reduce((acc: any, a: any) => {
        const cardClosingDay = a.closing_day || 31;
        
        if (todayDay >= cardClosingDay) {
          // Caso 1: A fatura deste mês já FECHOU. 
          // O que está 'fechado' vence agora (Imediato). 
          // O que está 'aberto' já é para o mês que vem (Próxima).
          acc.immediate += Math.max(0, a.closed_invoice_cents || 0);
          acc.upcoming += Math.max(0, a.open_invoice_cents || 0);
        } else {
          // Caso 2: A fatura deste mês ainda está ABERTA.
          // O que está 'aberto' vence ainda este mês (Imediato).
          // O que está 'fechado' é do mês passado (deve estar pago, mas se não estiver, é Imediato).
          acc.immediate += Math.max(0, a.open_invoice_cents || 0) + Math.max(0, a.closed_invoice_cents || 0);
          acc.upcoming += 0; 
        }
        return acc;
      }, { immediate: 0, upcoming: 0 });

    const plannedExpenses = futureThisMonth + recurringThisMonth + cardBreakdown.immediate + cardBreakdown.upcoming;
    const scheduledOnly = futureThisMonth + recurringThisMonth;
    const sobraLivre = initialBalance - plannedExpenses;
    
    return {
      balanceAtMonthEnd: sobraLivre,
      plannedExpenses,
      immediateCardDebt: cardBreakdown.immediate,
      upcomingCardDebt: cardBreakdown.upcoming,
      scheduledOnly,
      isHealthy: sobraLivre >= 0
    };
  }, [initialBalance, initialRecurring, liveAccounts, accounts]);

  const isFuture = !isSameMonth(targetDate, new Date());
  const balanceDifference = projectedBalance - initialBalance;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Coluna Esquerda: Header + Slider */}
      <div className="lg:col-span-8 space-y-8">
        {/* Header: Liquidez Atual */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 relative overflow-hidden group">
          <div className={cn(
            "absolute -top-24 -left-24 w-64 h-64 blur-[100px] rounded-full transition-colors duration-1000",
            isFuture ? "bg-violet-600/20" : "bg-emerald-600/10"
          )} />
          
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/40 font-bold text-xs uppercase tracking-[0.2em]">
                  <Wallet className="w-4 h-4" />
                  {isFuture ? `Projeção para ${format(targetDate, "MMMM", { locale: ptBR })}` : "Liquidez Atual"}
                </div>
                <motion.h1 
                  key={projectedBalance}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "text-6xl md:text-7xl font-black tracking-tighter tabular-nums",
                    isFuture ? "text-violet-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]" : "text-white"
                  )}
                >
                  {formatCurrency(projectedBalance)}
                </motion.h1>
              </div>

              {isFuture && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-sm",
                    balanceDifference >= 0 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}
                >
                  {balanceDifference >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {formatCurrency(Math.abs(balanceDifference))}
                </motion.div>
              )}
            </div>

            {/* Quick Account Sync Bar */}
            {!isFuture && (
              <div className="flex flex-wrap gap-3">
                {accounts.filter(a => a.type !== "CREDIT_CARD").map(acc => (
                  <button 
                    key={acc.id}
                    onClick={() => handleQuickSync(acc)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color_hex }} />
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors">{acc.name}</span>
                    <span className="text-[10px] font-black text-white tabular-nums">{formatCurrency(acc.balance_cents)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Practical Insights Bar */}
            {!isFuture && (
              <div className="flex flex-wrap gap-4 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 bg-white/2 px-4 py-3 rounded-2xl border border-white/5 group relative cursor-help">
                  <ArrowDownRight className="w-4 h-4 text-red-400/60" />
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Gastos Previstos</p>
                    <p className="text-sm font-bold text-white/80">{formatCurrency(monthlyOutlook.plannedExpenses)}</p>
                  </div>
                  
                  {/* Tooltip Breakdown */}
                  <div className="absolute bottom-full left-0 mb-4 w-64 p-4 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40 uppercase font-bold">Dívida Imediata (Faturas)</span>
                        <span className="text-xs font-bold text-red-400">{formatCurrency(monthlyOutlook.immediateCardDebt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40 uppercase font-bold">Agendados (Pix/Débito)</span>
                        <span className="text-xs font-bold text-violet-400">{formatCurrency(monthlyOutlook.scheduledOnly)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40 uppercase font-bold">Próxima Fatura (Abertas)</span>
                        <span className="text-xs font-bold text-amber-400">{formatCurrency(monthlyOutlook.upcomingCardDebt)}</span>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] text-white/60 uppercase font-black">Total</span>
                        <span className="text-sm font-black text-white">{formatCurrency(monthlyOutlook.plannedExpenses)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all",
                  monthlyOutlook.isHealthy ? "bg-emerald-500/5 border-emerald-500/10" : "bg-red-500/5 border-red-500/10"
                )}>
                  {monthlyOutlook.isHealthy ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Sobra Livre</p>
                    <p className={cn(
                      "text-sm font-black",
                      monthlyOutlook.isHealthy ? "text-emerald-400" : "text-red-400"
                    )}>
                      {formatCurrency(monthlyOutlook.balanceAtMonthEnd)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Month Navigator */}
        <MonthNavigator 
          selectedDate={targetDate}
          onDateChange={setTargetDate}
          lastFutureTransactionDate={lastFutureTransactionDate}
        />
      </div>

      {/* Coluna Direita: Recentes — não ultrapassa o fim do Slider */}
      <div className="lg:col-span-4">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 flex flex-col overflow-hidden shadow-2xl max-h-[calc(100vh-200px)] lg:max-h-none lg:h-fit">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest">
              {isFuture ? (
                <>
                  <Zap className="w-4 h-4 text-violet-400" />
                  Previsão {format(targetDate, "MMM/yy", { locale: ptBR })}
                </>
              ) : (
                <>
                  <History className="w-4 h-4 text-white/20" />
                  Recentes
                </>
              )}
            </h3>
            {!isFuture && (
              <button className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors">
                Ver Tudo
              </button>
            )}
          </div>

          {isFuture && (
            <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest mb-1">Receitas</p>
                <p className="text-sm font-bold text-emerald-400">
                  {formatCurrency(projection.transactions.filter(t => t.transaction_type === "INCOME").reduce((s, t) => s + t.amount_cents, 0))}
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Despesas</p>
                <p className="text-sm font-bold text-white/80">
                  {formatCurrency(projection.transactions.filter(t => t.transaction_type === "EXPENSE").reduce((s, t) => s + t.amount_cents, 0))}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-y-auto custom-scrollbar pr-2 -mr-2 max-h-[500px]">
            {isFuture ? (
              <ProjectedTimeline transactions={projection.transactions} />
            ) : (
              <TransactionTimeline transactions={initialTransactions} />
            )}
          </div>
        </div>
      </div>

      {/* Budget Grid */}
      <div className="lg:col-span-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialBudgets.map((budget, i) => (
            <SpendingCapacity 
              key={i}
              category={budget.category}
              spent={budget.spent}
              limit={budget.limit}
            />
          ))}
        </div>
      </div>

      {selectedAccount && (
        <QuickSyncModal 
          isOpen={syncModalOpen}
          onClose={() => setSyncModalOpen(false)}
          account={selectedAccount}
        />
      )}
    </div>
  );
}
