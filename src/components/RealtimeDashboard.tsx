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
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, History, Zap, ShieldCheck, AlertCircle, AlertTriangle, Calculator } from "lucide-react";
import { addDays, addMonths, endOfMonth, differenceInDays, isSameMonth, startOfMonth } from "date-fns";
import { QuickSyncModal } from "./QuickSyncModal";
import { cn } from "@/lib/utils";
import { useFinancialData } from "@/context/FinancialDataContext";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { UnifiedSurvivalHeader } from "./dashboard/UnifiedSurvivalHeader";
import { WeeklySurvivalCard } from "./dashboard/WeeklySurvivalCard";
import { MonthlyConsolidatedExcel } from "./dashboard/MonthlyConsolidatedExcel";
import { BillCommitmentCard } from "./dashboard/BillCommitmentCard";

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
  const [activeSimulations, setActiveSimulations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"timeline" | "summary">("summary");
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
    totalConsolidatedDebtCents,
    futureTransactions
  } = useFinancialData();

  // Usar dados live se disponíveis, senão inicial
  const displayAccounts = liveAccounts.length > 0 ? liveAccounts : accounts;
  const isCurrentMonth = isSameMonth(targetDate, new Date());
  const displayTransactions = isCurrentMonth 
    ? (liveMonthTransactions.length > 0 ? liveMonthTransactions : liveRecentTransactions)
    : [];


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

    return getProjectedDetails(currentBalance, targetDate, formattedRecurring, formattedBudgets, displayAccounts, futureTransactions, activeSimulations);
  }, [currentBalance, displayRecurring, targetDate, displayBudgets, displayAccounts, activeSimulations]);

  const monthOffset = useMemo(() => {
    const today = startOfMonth(new Date());
    const target = startOfMonth(targetDate);
    const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
    return Math.max(0, months);
  }, [targetDate]);
  const { 
    monthlyOutlook, 
    netLiquidityCents, 
    debtExit, 
    weeklySurvival, 
    isCrisisMode 
  } = useFinancialAnalysis(monthOffset, activeSimulations);

  const isFuture = monthOffset > 0;

  const handleSimulate = React.useCallback((sim: any) => {
    setActiveSimulations(sim ? [sim] : []);
  }, []);

  // Preparar dados para o Resumo Excel
  const consolidatedItems = useMemo(() => {
    const transactionsToUse = isFuture ? projection.transactions : displayTransactions;
    
    return transactionsToUse.map(t => ({
      name: t.description,
      value: t.amount_cents,
      type: t.transaction_type as "INCOME" | "EXPENSE",
      category: typeof t.category === 'object' ? t.category?.name : (t.category || "Geral"),
      isInstallment: (t as any).installment_total > 1,
      isBudget: (t as any).isBudget,
      isGoal: (t as any).isGoal
    }));
  }, [isFuture, projection.transactions, displayTransactions]);

  const totalIncome = useMemo(() => 
    consolidatedItems.filter(i => i.type === "INCOME").reduce((sum, i) => sum + i.value, 0)
  , [consolidatedItems]);

  const totalExpenses = useMemo(() => 
    consolidatedItems.filter(i => i.type === "EXPENSE").reduce((sum, i) => sum + i.value, 0)
  , [consolidatedItems]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start pb-20">
      {/* Coluna Esquerda: Header + Navigator */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* NOVO CABEÇALHO UNIFICADO */}
        <UnifiedSurvivalHeader 
          monthOffset={monthOffset} 
          targetDate={targetDate}
          activeSimulations={activeSimulations}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
           <div className="h-full">
             <BillCommitmentCard 
                immediateCardDebt={monthlyOutlook.immediateCardDebt}
                upcomingCardDebt={monthlyOutlook.upcomingCardDebt}
                scheduledExpenses={monthlyOutlook.scheduledOnly}
                budgetReserves={monthlyOutlook.budgetReserves}
                totalPlanned={monthlyOutlook.plannedExpenses}
                isCrisis={isCrisisMode}
             />
           </div>
           
           <div className="h-full">
             <MonthNavigator 
              selectedDate={targetDate}
              onDateChange={setTargetDate}
              lastFutureTransactionDate={lastFutureTransactionDate}
            />
           </div>
        </div>
      </div>

      {/* Coluna Direita: Insights + Recentes */}
      <div className="lg:col-span-4 space-y-8">
          <SpendingSimulator 
            onSimulate={handleSimulate} 
          />
        
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 flex flex-col overflow-hidden shadow-2xl max-h-[calc(100vh-200px)] lg:max-h-none lg:h-fit">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setActiveTab("summary")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "summary" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "text-white/40 hover:text-white/60"
                )}
              >
                <Calculator className="w-3 h-3" />
                Resumo
              </button>
              <button 
                onClick={() => setActiveTab("timeline")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "timeline" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "text-white/40 hover:text-white/60"
                )}
              >
                <History className="w-3 h-3" />
                Timeline
              </button>
            </div>
            {!isFuture && activeTab === "timeline" && (
              <button className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors">
                Ver Tudo
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="overflow-y-auto custom-scrollbar pr-2 -mr-2 max-h-[500px]"
            >
              {activeTab === "summary" ? (
                <MonthlyConsolidatedExcel 
                  income={totalIncome}
                  expenses={totalExpenses}
                  balance={totalIncome - totalExpenses}
                  items={consolidatedItems}
                  monthName={format(targetDate, "MMMM 'de' yyyy", { locale: ptBR })}
                />
              ) : (
                isFuture ? (
                  <ProjectedTimeline transactions={projection.transactions} />
                ) : (
                  <TransactionTimeline transactions={displayTransactions} />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Budget Grid */}
      <div className="lg:col-span-12 mt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(displayBudgets || []).map((budget, i) => (
            <SpendingCapacity 
              key={budget.id ? budget.id : `budget-grid-${i}`}
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
