"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format, startOfMonth, addMonths, isSameMonth } from "date-fns";
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
import CopilotChatPanel from "./dashboard/CopilotChatPanel";

// Hooks
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { useStartingBalanceOverrides } from "@/hooks/useStartingBalanceOverrides";
import { useFinancialData } from "@/context/FinancialDataContext";
import { getTransactionImpactDate, isRecurringExpired, calculateLoanInstallment } from "@/domain/financial/financial-logic";

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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  
  const { 
    accounts: liveAccounts, 
    monthTransactions: liveMonthTransactions,
    recentTransactions: liveRecentTransactions,
    budgets: liveBudgets,
    goals,
    recurringTransactions,
    futureTransactions,
    allTransactions: liveAllTransactions,
    invoices: liveInvoices
  } = useFinancialData();

  // Usar dados live se disponíveis, senão inicial
  const today = startOfMonth(new Date());
  const isCurrentMonth = isSameMonth(targetDate, today);
  const isPast = targetDate < today && !isSameMonth(targetDate, today);

  const displayTransactions = useMemo(() => {
    if (isCurrentMonth) {
      return liveMonthTransactions.length > 0 ? liveMonthTransactions : liveRecentTransactions;
    }
    if (isPast) {
      const targetMonth = startOfMonth(targetDate);
      return (liveAllTransactions || []).filter(t => isSameMonth(new Date(t.date), targetMonth));
    }
    return [];
  }, [isCurrentMonth, isPast, targetDate, liveMonthTransactions, liveRecentTransactions, liveAllTransactions]);

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
    isCrisisMode,
    startingBalanceCents,
    accumulatedBalanceCents
  } = useFinancialAnalysis(monthOffset, activeSimulations);

  const { overrides, saveOverride, removeOverride } = useStartingBalanceOverrides();
  const monthKey = format(startOfMonth(targetDate), "yyyy-MM");
  const hasOverride = overrides && overrides[monthKey] !== undefined;

  const isFuture = monthOffset > 0;

  // Transações virtuais de simulação para o mês atual ou projetado
  const simulationTransactions = useMemo(() => {
    const targetMonth = startOfMonth(targetDate);
    
    return activeSimulations.flatMap((sim, simIdx) => {
      const installments = sim.installments || 1;
      
      let monthlyAmount = Math.round(sim.amount_cents / installments);
      if (sim.isLoan || (sim.interestRate && sim.interestRate > 0 && sim.type === "INCOME")) {
        if (sim.customInstallmentCents !== undefined && sim.customInstallmentCents > 0) {
          monthlyAmount = sim.customInstallmentCents;
        } else {
          const rate = (sim.interestRate && sim.interestRate > 0) ? sim.interestRate : 9.53;
          monthlyAmount = calculateLoanInstallment(sim.amount_cents, rate, installments);
        }
      } else if (sim.customInstallmentCents !== undefined && sim.customInstallmentCents > 0) {
        monthlyAmount = sim.customInstallmentCents;
      }

      const results = [];
      const startOffset = sim.startMonthOffset ?? 0;
      const isSimLoan = sim.isLoan || (sim.interestRate && sim.interestRate > 0 && sim.type === "INCOME");

      for (let i = 0; i < installments; i++) {
        // Para empréstimos, as parcelas correm com 1 mês de atraso (começam no mês seguinte)
        const simDate = addMonths(new Date(), startOffset + i + (isSimLoan ? 1 : 0));
        
        if (isSameMonth(simDate, targetMonth)) {
          const cleanDesc = (sim.description || 'Compra').startsWith("Simulado: ")
            ? (sim.description || 'Compra').replace("Simulado: ", "")
            : (sim.description || 'Compra');

          results.push({
            id: `sim-tx-${simIdx}-${i}`,
            description: `Simulado: ${cleanDesc} (${i + 1}/${installments})`,
            amount_cents: monthlyAmount,
            transaction_type: isSimLoan ? ("EXPENSE" as const) : (sim.type as "INCOME" | "EXPENSE"),
            date: simDate.toISOString(),
            category: "Simulação"
          });
        }
      }

      // Empréstimo no mês de início (mês 0) injeta receita de capital
      if (isSimLoan) {
        const injectionDate = addMonths(new Date(), startOffset);
        if (isSameMonth(injectionDate, targetMonth)) {
          const cleanDesc = (sim.description || 'Compra').startsWith("Simulado: ")
            ? (sim.description || 'Compra').replace("Simulado: ", "")
            : (sim.description || 'Compra');

          results.push({
            id: `sim-tx-income-${simIdx}`,
            description: `Simulado: Injeção ${cleanDesc}`,
            amount_cents: sim.amount_cents,
            transaction_type: "INCOME" as const,
            date: injectionDate.toISOString(),
            category: "Simulação"
          });
        }
      }

      return results;
    });
  }, [activeSimulations, targetDate]);

  // Transações projetadas para a Timeline
  const projectionTransactions = useMemo(() => {
    if (!isFuture) return [];
    const targetMonth = startOfMonth(targetDate);
    
    // Transações futuras agendadas alocadas corretamente na data do vencimento do cartão
    const filteredFuture = futureTransactions.filter(t => {
      const impactDate = getTransactionImpactDate(t, liveAccounts);
      return isSameMonth(impactDate, targetMonth);
    });
    
    // Transações virtuais baseadas em recorrentes
    const monthKey = format(targetMonth, "yyyy-MM");
    const virtualRecurring = recurringTransactions
      .filter(r => r.status === 'active' && !isRecurringExpired(r.description, monthKey))
      .map(r => ({
        id: `virtual-${r.id}`,
        description: r.description,
        amount_cents: r.amount_cents,
        transaction_type: r.transaction_type,
        date: targetMonth.toISOString(),
        category: r.category_id,
        source_metadata: { recurring_id: r.id }
      }));

    return [...filteredFuture, ...virtualRecurring, ...simulationTransactions];
  }, [isFuture, targetDate, futureTransactions, recurringTransactions, liveAccounts, simulationTransactions]);

  // Preparar dados para o Resumo Excel
  const consolidatedItems = useMemo(() => {
    const creditCardAccountIds = new Set(
      liveAccounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id)
    );

    const transactionsToUse = isFuture ? projectionTransactions : displayTransactions;
    
    // Filtrar transações de cartão de crédito para evitar double-counting com as faturas
    let filteredTransactions = transactionsToUse.filter((t: any) => 
      !t.account_id || !creditCardAccountIds.has(t.account_id)
    );

    // Deduplicar transações físicas/projetadas por recurring_id para evitar double-counting
    const seenRecurringIds = new Set<string>();
    filteredTransactions = filteredTransactions.filter((t: any) => {
      const recId = t.source_metadata?.recurring_id || t.source_metadata?.['recurring_id'];
      if (recId) {
        if (seenRecurringIds.has(recId)) {
          return false;
        }
        seenRecurringIds.add(recId);
      }
      return true;
    });
    
    const baseItems = filteredTransactions.map((t: any) => ({
      name: t.description,
      value: t.amount_cents,
      type: t.transaction_type as "INCOME" | "EXPENSE",
      category: typeof t.category === 'object' ? t.category?.name : (t.category || "Geral"),
      isInstallment: (t as any).installment_total > 1,
      isBudget: (t as any).isBudget,
      isGoal: (t as any).isGoal
    }));

    // No presente, as simulações não vêm do banco, então injetamos separadamente na planilha
    const simItems = !isFuture
      ? simulationTransactions.map((t: any) => ({
          name: t.description,
          value: t.amount_cents,
          type: t.transaction_type,
          category: t.category,
          isInstallment: false,
          isBudget: false,
          isGoal: false
        }))
      : [];

    const items = [...baseItems, ...simItems];

    // Injetar faturas de cartão de crédito projetadas para o mês correspondente
    // de forma a sincronizar a planilha de gastos com o saldo final projetado
    const targetMonth = startOfMonth(targetDate);
    const targetMonthStr = format(targetMonth, "yyyy-MM");
    
    const bills = liveAccounts
      .filter(a => a.type === "CREDIT_CARD")
      .map(a => {
        let billAmount = 0;
        if (monthOffset === 0) {
          if (a.closed_invoice_month === targetMonthStr) {
            billAmount += Number(a.closed_invoice_cents) || 0;
          }
          if (a.open_invoice_month === targetMonthStr) {
            billAmount += Number(a.open_invoice_cents) || 0;
          }
          
          // Evitar duplicidade: se já há uma transação na lista com essa descrição
          const hasTx = items.some(item => 
            item.type === "EXPENSE" && 
            item.name.toLowerCase().includes(a.name.toLowerCase()) && 
            item.name.toLowerCase().includes("fatura")
          );
          if (hasTx) billAmount = 0;
        } else {
          // Em meses futuros, usar a fatura real (credit_card_invoices) como fonte de verdade.
          // A soma de transações individuais pode divergir da fatura real (juros, arredondamentos,
          // transações INCOME no mesmo cartão que invertem o total indevidamente).
          const cardInvoices = (liveInvoices || []).filter(inv => 
            inv.account_id === a.id && 
            inv.reference_month === targetMonthStr &&
            (inv.status === 'OPEN' || inv.status === 'CLOSED')
          );
          
          if (cardInvoices.length > 0) {
            // Fonte de verdade: fatura real registrada no banco
            billAmount = cardInvoices.reduce((sum, inv) => sum + (Number(inv.amount_cents) || 0), 0);
          } else {
            // Fallback: somar transações com impactDate quando não há fatura registrada
            const consolidatedTx = [
              ...(futureTransactions || []),
              ...(liveAllTransactions || [])
            ];
            const uniqueTx = Array.from(new Map(consolidatedTx.map(t => [t.id, t])).values());
            billAmount = uniqueTx
              .filter(t => {
                if (t.account_id !== a.id) return false;
                const impactDate = getTransactionImpactDate(t, liveAccounts);
                return t.transaction_type === "EXPENSE" && isSameMonth(impactDate, targetMonth);
              })
              .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
          }
        }
        
        if (billAmount <= 0) return null;
        
        return {
          name: `Fatura ${a.name}`,
          value: billAmount,
          type: "EXPENSE" as const,
          category: "Cartão de Crédito",
          isInstallment: false,
          isBudget: false,
          isGoal: false
        };
      })
      .filter(Boolean) as any[];

    const baseItemsList = [...items, ...bills];

    // Calcular o saldo bruto intermediário antes das provisões
    const baseIncome = baseItemsList
      .filter(i => i.type === "INCOME")
      .reduce((sum, i) => sum + i.value, 0);
    const baseExpenses = baseItemsList
      .filter(i => i.type === "EXPENSE")
      .reduce((sum, i) => sum + i.value, 0);

    let tempBalance = startingBalanceCents + baseIncome - baseExpenses;

    // Injetar provisões de orçamento
    const budgetItems = (liveBudgets || []).map(b => {
      const reserve = monthOffset === 0
        ? Math.max(0, (b.amount_cents || 0) - (b.spent_cents || 0))
        : (b.amount_cents || 0);
      
      if (reserve <= 0) return null;

      return {
        name: `Reserva: ${b.category_id || 'Geral'}`,
        value: reserve,
        type: "EXPENSE" as const,
        category: "Orçamento",
        isBudget: true,
        isInstallment: false,
        isGoal: false
      };
    }).filter(Boolean) as any[];

    // Deduzir os orçamentos do saldo temporário
    const totalBudgetsReserve = budgetItems.reduce((sum, item) => sum + item.value, 0);
    tempBalance -= totalBudgetsReserve;

    // Injetar provisões de metas
    const goalItems: any[] = [];
    const netLiquidityCents = monthlyOutlook.projectedNetLiquidity ?? 0;
    if (netLiquidityCents >= 0 && tempBalance >= 0) {
      const activeGoals = (goals || []).filter(g => g.status === "active" || g.status === "ACTIVE");
      const sortedGoals = [...activeGoals].sort((a, b) => (a.priority || 999) - (b.priority || 999));
      
      for (const g of sortedGoals) {
        const contribution = Number(g.monthly_contribution_cents) || 0;
        if (contribution <= 0) continue;
        
        if (tempBalance >= contribution) {
          goalItems.push({
            name: `Aporte Meta: ${g.name}`,
            value: contribution,
            type: "EXPENSE" as const,
            category: "Metas",
            isBudget: false,
            isInstallment: false,
            isGoal: true
          });
          tempBalance -= contribution;
        } else {
          break;
        }
      }
    }

    return [...baseItemsList, ...budgetItems, ...goalItems];
  }, [isFuture, projectionTransactions, displayTransactions, simulationTransactions, targetDate, monthOffset, liveAccounts, futureTransactions, liveAllTransactions, liveBudgets, goals, startingBalanceCents, monthlyOutlook.projectedNetLiquidity, liveInvoices]);

  const totalIncome = useMemo(() => 
    consolidatedItems.filter((i: any) => i.type === "INCOME").reduce((sum: number, i: any) => sum + i.value, 0)
  , [consolidatedItems]);

  const totalExpenses = useMemo(() => 
    consolidatedItems.filter((i: any) => i.type === "EXPENSE").reduce((sum: number, i: any) => sum + i.value, 0)
  , [consolidatedItems]);

  const handleSimulate = useCallback((sims: any[] | null) => {
    setActiveSimulations(sims || []);
  }, []);

  // Calcula a data da última dívida (transação futura mais distante)
  const lastDebtExitDate = useMemo(() => {
    if (!futureTransactions || futureTransactions.length === 0) return null;
    const dates = futureTransactions.map(t => new Date(t.date).getTime());
    return new Date(Math.max(...dates));
  }, [futureTransactions]);

  const jumpToDebtExit = useCallback(() => {
    const target = lastDebtExitDate || debtExit.exitDate;
    if (target) {
      console.log("🚀 Jumping to debt exit date:", target);
      setTargetDate(new Date(target));
    }
  }, [lastDebtExitDate, debtExit.exitDate]);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-transparent">
        <div className="w-8 h-8 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col xl:flex-row items-stretch min-h-screen bg-transparent overflow-hidden">
      {/* Lado Esquerdo: Área do Dashboard com Encolhimento Suave */}
      <div className={cn(
        "flex-1 space-y-3 md:space-y-6 pb-20 mx-auto transition-all duration-500 w-full px-2 md:px-4",
        isCopilotOpen 
          ? "xl:max-w-none border-r border-white/5" 
          : "max-w-[1600px] xl:px-8"
      )}>
        
        {/* ROW 1 — Header Principal, full width */}
        <UnifiedSurvivalHeader 
          monthOffset={monthOffset} 
          targetDate={targetDate}
          activeSimulations={activeSimulations}
          onJumpToDebtExit={jumpToDebtExit}
          debtExitDate={lastDebtExitDate || debtExit.exitDate}
          isCopilotOpen={isCopilotOpen}
          onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
        />

        {/* ROW 2 — Painel Unificado de Controle Temporal (Máquina do Tempo) */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-2xl flex flex-col lg:flex-row gap-6 lg:items-start items-stretch">
          <div className="flex-1 min-w-0">
            <MonthNavigator 
              selectedDate={targetDate}
              onDateChange={setTargetDate}
              lastFutureTransactionDate={lastFutureTransactionDate}
              debtExitDate={lastDebtExitDate || (debtExit.exitDate && debtExit.monthsToExit > 0 ? debtExit.exitDate : null)}
            />
          </div>
          <div className="hidden lg:block w-px bg-white/5 self-stretch" />
          <div className="flex-1 min-w-0">
            <SpendingSimulator 
              onSimulate={handleSimulate} 
              targetDate={targetDate}
            />
          </div>
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
                aria-label="Timeline"
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
                    balance={startingBalanceCents + totalIncome - totalExpenses}
                    startingBalance={startingBalanceCents}
                    items={consolidatedItems}
                    monthName={format(targetDate, "MMMM 'de' yyyy", { locale: ptBR })}
                    hasStartingBalanceOverride={hasOverride}
                    onUpdateStartingBalance={(cents) => {
                      if (cents === null) {
                        removeOverride(monthKey);
                      } else {
                        saveOverride(monthKey, cents);
                      }
                    }}
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

        {/* ROW 4 — Budget grid, full width (Responsividade sob Modo Copiloto) */}
        <div className={cn(
          "grid gap-4 md:gap-6",
          isCopilotOpen 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3" 
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        )}>
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

      {/* Lado Direito: Painel do Copilot Fixo e Independente com Gaveta Deslizante Premium */}
      <AnimatePresence>
        {isCopilotOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed xl:sticky top-0 right-0 bottom-0 z-40 w-full md:w-[420px] xl:w-[420px] 2xl:w-[480px] h-screen border-l border-white/5 bg-transparent flex-shrink-0"
          >
            <CopilotChatPanel 
              isCopilotOpen={isCopilotOpen}
              onToggleCopilot={() => setIsCopilotOpen(false)}
              monthOffset={monthOffset}
              targetDate={targetDate}
              onSimulate={handleSimulate}
              activeSimulations={activeSimulations}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
