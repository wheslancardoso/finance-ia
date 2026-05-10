"use client";

import React, { useState, useMemo } from "react";
import { SpendingCapacity } from "./SpendingCapacity";
import { TransactionTimeline } from "./TransactionTimeline";
import { MonthNavigator } from "./MonthNavigator";
import SpendingSimulator from "./SpendingSimulator";
import { getProjectedDetails, ProjectedTransaction } from "@/utils/finance-projections";
import { ProjectedTimeline } from "./ProjectedTimeline";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, History, Zap, ShieldCheck, AlertCircle, AlertTriangle } from "lucide-react";
import { addDays, addMonths, endOfMonth, differenceInDays, isSameMonth, startOfMonth } from "date-fns";
import { QuickSyncModal } from "./QuickSyncModal";
import { cn } from "@/lib/utils";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { DashboardStatsGrid } from "./dashboard/DashboardStatsGrid";

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
  const { 
    accounts: liveAccounts, 
    recentTransactions: liveRecentTransactions,
    monthTransactions: liveMonthTransactions,
    monthlyIncomeCents,
    fixedExpensesCents,
    recurringIncomeCents,
    recurringExpensesCents,
    currentMonthExpensesCents,
    accumulatedBalanceCents,
    extraIncomeCents,
    healthScore,
    recurringTransactions: liveRecurring,
    budgets: liveBudgets,
    transactions: allTransactions,
    scheduledIncomeCents,
    scheduledExpensesCents,
    cardDebtImpactCents,
    totalConsolidatedDebtCents
  } = useFinancialData();

  // Usar dados live se disponíveis, senão inicial
  const displayAccounts = liveAccounts.length > 0 ? liveAccounts : accounts;
  const isCurrentMonth = isSameMonth(targetDate, new Date());
  const displayTransactions = isCurrentMonth 
    ? (liveMonthTransactions.length > 0 ? liveMonthTransactions : liveRecentTransactions)
    : [];

  console.log(`[Dashboard] View: ${isCurrentMonth ? 'Current' : 'Future/Past'}, Transactions: ${displayTransactions.length}, MonthTx: ${liveMonthTransactions.length}, RecentTx: ${liveRecentTransactions.length}`);

  const displayRecurring = liveRecurring.length > 0 ? liveRecurring : initialRecurring;
  const displayBudgets = liveBudgets.length > 0 ? liveBudgets : initialBudgets;

  const currentBalance = useMemo(() => {
    return displayAccounts
      .filter((a: any) => a.type !== "CREDIT_CARD")
      .reduce((sum: number, a: any) => sum + (a.balance_cents || 0), 0);
  }, [displayAccounts]);

  const handleQuickSync = (account: any) => {
    setSelectedAccount(account);
    setSyncModalOpen(true);
  };

  // 1. Cálculo da Projeção (Viagem no Tempo por Meses)
  const projection = useMemo(() => {
    const formattedBudgets = (displayBudgets || []).map(b => ({
      amount_cents: b.amount_cents || 0,
      spent_this_month: b.spent_cents || 0,
      category: b.category_id || 'general'
    }));

    const formattedRecurring = (displayRecurring || []).map(r => ({
      ...r,
      amount_cents: r.amount_cents || 0,
      transaction_type: r.transaction_type as "INCOME" | "EXPENSE",
      frequency: (r.frequency || 'monthly') as any,
    }));

    return getProjectedDetails(currentBalance, targetDate, formattedRecurring, formattedBudgets, displayAccounts);
  }, [currentBalance, displayRecurring, targetDate, displayBudgets, displayAccounts]);

  const projectedBalance = projection.totalBalance;

  const { monthlyOutlook, netLiquidityCents } = useFinancialAnalysis();

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
            <DashboardHeader 
              isFuture={isFuture} 
              targetDate={targetDate} 
              projectedBalance={projectedBalance} 
              balanceDifference={balanceDifference} 
            />

            {/* Centro de Comando: Liquidez Real vs Dívida */}
            {!isFuture && <DashboardStatsGrid />}
            
            {/* Health Score & Action Recommendations */}
            {!isFuture && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-3xl p-5 border border-white/10 flex items-center gap-4 group hover:bg-white/10 transition-all">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black",
                    (healthScore > 70 && netLiquidityCents >= 0) ? "bg-emerald-500/20 text-emerald-400" : 
                    (healthScore > 40 && netLiquidityCents >= 0) ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {healthScore}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Saúde Financeira</p>
                    <p className={cn(
                      "text-sm font-black",
                      (healthScore > 70 && netLiquidityCents >= 0) ? "text-emerald-400" : 
                      (healthScore > 40 && netLiquidityCents >= 0) ? "text-amber-400" : "text-red-400"
                    )}>
                      {netLiquidityCents < 0 ? "Em Recuperação" : (healthScore > 70 ? "Excelente" : healthScore > 40 ? "Atenção" : "Crítico")}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white/5 rounded-3xl p-5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Capacidade de Gasto</p>
                      <p className="text-sm font-black text-white">{formatCurrency(monthlyOutlook.balanceAtMonthEnd)} disponíveis</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={cn(
                        "w-1.5 h-6 rounded-full transition-colors",
                        (i * 20) <= healthScore ? "bg-emerald-400" : "bg-white/10"
                      )} />
                    ))}
                  </div>
                </div>
              </div>
            )}

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
            <div className="flex flex-wrap gap-4 pt-6 border-t border-white/5">
              {!isFuture ? (
                <>
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


                </>
              ) : (
                <>
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all",
                    projectedBalance >= 0 ? "bg-emerald-500/5 border-emerald-500/10" : "bg-red-500/5 border-red-500/10"
                  )}>
                    {projectedBalance >= 0 ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    <div>
                      <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Liquidez Projetada</p>
                      <p className={cn(
                        "text-sm font-black",
                        projectedBalance >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {formatCurrency(projectedBalance)}
                      </p>
                    </div>
                  </div>

                  {projectedBalance < 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border bg-amber-500/5 border-amber-500/10 animate-pulse">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <div>
                        <p className="text-[9px] font-black text-amber-400/40 uppercase tracking-widest">Ação Recomendada</p>
                        <p className="text-sm font-black text-amber-400">
                          Poupar {formatCurrency(Math.abs(projectedBalance))} para equilibrar
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Month Navigator */}
        <MonthNavigator 
          selectedDate={targetDate}
          onDateChange={setTargetDate}
          lastFutureTransactionDate={lastFutureTransactionDate}
        />
      </div>

      {/* Coluna Direita: Insights + Recentes */}
      <div className="lg:col-span-4 space-y-8">
        <SpendingSimulator />
        
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
              <TransactionTimeline transactions={displayTransactions} />
            )}
          </div>
        </div>
      </div>

      {/* Budget Grid */}
      <div className="lg:col-span-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(displayBudgets || []).map((budget, i) => (
            <SpendingCapacity 
              key={budget.id || i}
              category={budget.category_id || 'Geral'}
              spent={budget.spent_cents || 0}
              limit={budget.amount_cents || 0}
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
