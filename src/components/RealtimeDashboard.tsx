"use client";

import React, { useState, useMemo, useEffect } from "react";
import { format, isSameMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calculator, 
  History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Componentes
import { UnifiedSurvivalHeader } from "./dashboard/UnifiedSurvivalHeader";
import { BillCommitmentCard } from "./dashboard/BillCommitmentCard";
import { MonthNavigator } from "./MonthNavigator";
import SpendingSimulator from "./SpendingSimulator";
import { TransactionTimeline } from "./TransactionTimeline";
import { ProjectedTimeline } from "./ProjectedTimeline";
import { MonthlyConsolidatedExcel } from "./dashboard/MonthlyConsolidatedExcel";
import { SpendingCapacity } from "./SpendingCapacity";
import { QuickSyncModal } from "./QuickSyncModal";

// Hooks
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useFinancialData } from "@/context/FinancialDataContext";

interface RealtimeDashboardProps {
  initialBalance: number;
  initialTransactions: any[];
  initialBudgets: any[];
  initialRecurring: any[];
  lastFutureTransactionDate?: string | null;
  accounts: any[];
}

export default function RealtimeDashboard({ 
  initialBudgets,
  lastFutureTransactionDate
}: RealtimeDashboardProps) {
  const [targetDate, setTargetDate] = useState<Date>(new Date());
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedAccount] = useState<any>(null);
  const [activeSimulations, setActiveSimulations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"timeline" | "summary">("summary");
  
  const { 
    accounts: liveAccounts, 
    monthTransactions: liveMonthTransactions,
    recentTransactions: liveRecentTransactions,
    budgets: liveBudgets,
    recurringTransactions,
    futureTransactions
  } = useFinancialData();

  // Usar dados live se disponíveis, senão inicial
  const isCurrentMonth = isSameMonth(targetDate, new Date());
  const displayTransactions = isCurrentMonth 
    ? (liveMonthTransactions.length > 0 ? liveMonthTransactions : liveRecentTransactions)
    : [];

  const displayBudgets = liveBudgets.length > 0 ? liveBudgets : initialBudgets;

  // Cálculo de Projeção
  const monthOffset = useMemo(() => {
    const today = startOfMonth(new Date());
    const target = startOfMonth(targetDate);
    const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
    return Math.max(0, months);
  }, [targetDate]);

  const { 
    monthlyOutlook, 
    debtExit, 
    isCrisisMode 
  } = useFinancialAnalysis(monthOffset, activeSimulations);

  const isFuture = monthOffset > 0;

  // Transações projetadas para a Timeline
  const projectionTransactions = useMemo(() => {
    if (!isFuture) return [];
    const targetMonth = startOfMonth(targetDate);
    
    // Transações futuras agendadas
    const filteredFuture = futureTransactions.filter(t => isSameMonth(new Date(t.date), targetMonth));
    
    // Transações virtuais baseadas em recorrentes
    const virtualRecurring = recurringTransactions
      .filter(r => r.status === 'active')
      .map(r => ({
        id: `virtual-${r.id}`,
        description: r.description,
        amount_cents: r.amount_cents,
        transaction_type: r.transaction_type,
        date: targetMonth.toISOString(),
        category: r.category_id
      }));

    return [...filteredFuture, ...virtualRecurring];
  }, [isFuture, targetDate, futureTransactions, recurringTransactions]);

  // Preparar dados para o Resumo Excel
  const consolidatedItems = useMemo(() => {
    const transactionsToUse = isFuture ? projectionTransactions : displayTransactions;
    
    return transactionsToUse.map((t: any) => ({
      name: t.description,
      value: t.amount_cents,
      type: t.transaction_type as "INCOME" | "EXPENSE",
      category: typeof t.category === 'object' ? t.category?.name : (t.category || "Geral"),
      isInstallment: (t as any).installment_total > 1,
      isBudget: (t as any).isBudget,
      isGoal: (t as any).isGoal
    }));
  }, [isFuture, projectionTransactions, displayTransactions]);

  const totalIncome = useMemo(() => 
    consolidatedItems.filter((i: any) => i.type === "INCOME").reduce((sum: number, i: any) => sum + i.value, 0)
  , [consolidatedItems]);

  const totalExpenses = useMemo(() => 
    consolidatedItems.filter((i: any) => i.type === "EXPENSE").reduce((sum: number, i: any) => sum + i.value, 0)
  , [consolidatedItems]);

  const handleSimulate = (sim: any) => {
    setActiveSimulations(sim ? [sim] : []);
  };

  const jumpToDebtExit = () => {
    if (debtExit.exitDate) {
      setTargetDate(debtExit.exitDate);
    }
  };

  useEffect(() => {
    (window as any).jumpToDebtExit = jumpToDebtExit;
    return () => {
      delete (window as any).jumpToDebtExit;
    };
  }, [debtExit.exitDate]);

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto px-4 md:px-8">
      
      {/* ROW 1 — Header Principal, full width */}
      <UnifiedSurvivalHeader 
        monthOffset={monthOffset} 
        targetDate={targetDate}
        activeSimulations={activeSimulations}
        onJumpToDebtExit={jumpToDebtExit}
        debtExitDate={debtExit.exitDate}
      />

      {/* ROW 2 — Três cards compactos em linha */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        <BillCommitmentCard 
          immediateCardDebt={monthlyOutlook.immediateCardDebt}
          upcomingCardDebt={monthlyOutlook.upcomingCardDebt}
          scheduledExpenses={monthlyOutlook.scheduledOnly}
          budgetReserves={monthlyOutlook.budgetReserves}
          totalPlanned={monthlyOutlook.plannedExpenses}
          isCrisis={isCrisisMode}
        />
        
        <MonthNavigator 
          selectedDate={targetDate}
          onDateChange={setTargetDate}
          lastFutureTransactionDate={lastFutureTransactionDate}
        />

        <SpendingSimulator 
          onSimulate={handleSimulate} 
        />
      </div>

      {/* ROW 3 — Timeline/Resumo full width */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setActiveTab("summary")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "summary" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "text-white/40 hover:text-white/60"
              )}
            >
              <Calculator className="w-3 h-3" />
              Resumo Consolidado
            </button>
            <button 
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "timeline" ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "text-white/40 hover:text-white/60"
              )}
            >
              <History className="w-3 h-3" />
              Linha do Tempo
            </button>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
              {isFuture ? "Projeção de Fluxo" : "Movimentações Reais"}
            </p>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
                  <ProjectedTimeline transactions={projectionTransactions as any} />
                ) : (
                  <TransactionTimeline transactions={displayTransactions} />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ROW 4 — Budget grid, full width */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(displayBudgets || []).map((budget, i) => (
          <SpendingCapacity 
            key={budget.id ? budget.id : `budget-grid-${i}`}
            category={budget.category_id || 'Geral'}
            spent={budget.spent_cents || 0}
            limit={budget.amount_cents}
          />
        ))}
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
