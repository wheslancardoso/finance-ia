
import { useMemo, useCallback } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { financialService } from "@/services/financialService";
import { useStartingBalanceOverrides } from "./useStartingBalanceOverrides";
import { addMonths, startOfMonth, format } from "date-fns";
import { 
  calculateNetLiquidity, 
  calculateMonthlyOutlook, 
  calculateTotalConsolidatedDebt,
  calculateAccumulatedBalance,
  calculateRealCycleLiquidity,
  calculateLoanInstallment,
  type MonthlyOutlook,
  calculateDebtExitProjection,
  type DebtExitProjection,
  calculateWeeklySurvival,
  type WeeklySurvival,
  calculateGoalProjections,
  type GoalProjection,
  simulateDetailedImpact,
  type SimulationDetailedResult,
  calculateAdvancedProjection,
  type Simulation,
  generateCashFlowStatement,
  type CashFlowStatement,
  calculateSimulationImpactForMonth,
  deduplicateTransactions
} from "@/domain/financial/financial-logic";
import type { MonthClosing } from "@/hooks/useMonthClosing";

export type { SimulationDetailedResult, MonthlyOutlook, DebtExitProjection, GoalProjection, CashFlowStatement };

export interface FinancialAnalysis {
  netLiquidityCents: number;
  totalConsolidatedDebtCents: number;
  accumulatedBalanceCents: number;
  startingBalanceCents: number;
  reconciliationAdjustmentCents: number;
  checkingBalanceCents: number;
  creditCardUsedCents: number;
  monthlyOutlook: MonthlyOutlook;
  healthScore: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  isSurvivalMode: boolean;
  isCrisisMode: boolean;
  debtExit: DebtExitProjection;
  weeklySurvival: WeeklySurvival;
  goalProjections: GoalProjection[];
  cashFlowStatement: CashFlowStatement;
  simulateDetailedImpact: (
    amountCents: number, 
    installments: number, 
    type?: "EXPENSE" | "INCOME",
    loanInstallmentCents?: number,
    loanInstallmentsCount?: number
  ) => SimulationDetailedResult;
  analyzeSimulationIA: (simulation: any) => Promise<string>;
  solveFinancialDilemma: (dilemmaText: string) => Promise<{ advice: string; simulations: any[] }>;
  optimizeSweepIA: () => Promise<{ advice: string; suggested_simulation: any }>;
  consultJarvisIA: (simulation?: any) => Promise<{ advice: string; suggested_loan_amount_cents: number; loan_verdict: string; postponement_tips: string[] }>;
}

/**
 * Hook de "Ponte de Dados": Consolida a inteligência financeira do sistema.
 * Use este hook em qualquer página ou componente para obter diagnósticos consistentes.
 */
export function useFinancialAnalysis(monthOffset: number = 0, activeSimulations: Simulation[] = [], monthClosing?: MonthClosing | null): FinancialAnalysis {
  const { 
    accounts, 
    scheduledIncomeCents, 
    scheduledExpensesCents, 
    budgets,
    goals,
    recurringIncomeCents,
    recurringExpensesCents,
    healthScore,
    monthTransactions,
    futureTransactions,
    recurringTransactions,
    survivalReserveCents,
    weeklyLimitOverrideCents,
    allTransactions,
    invoices
  } = useFinancialData();

  const netLiquidity = useMemo(() => calculateNetLiquidity(accounts), [accounts]);
  const consolidatedDebt = useMemo(() => calculateTotalConsolidatedDebt(accounts), [accounts]);
  const currentAssets = useMemo(() => calculateAccumulatedBalance(accounts), [accounts]);

  // Liquidez de Ciclo Real: Saldo - Dívidas - Despesas Pendentes de Maio
  const realCycleLiquidity = useMemo(() => 
    calculateRealCycleLiquidity({
      accounts,
      currentMonthTransactions: monthTransactions
    }), [accounts, monthTransactions]);

  const consolidatedTransactions = useMemo(() => 
    deduplicateTransactions([futureTransactions, allTransactions]),
    [futureTransactions, allTransactions]
  );
  const { overrides } = useStartingBalanceOverrides();

  const startingBalanceCents = useMemo(() => {
    const targetDate = addMonths(new Date(), monthOffset);
    const monthKey = format(targetDate, "yyyy-MM");

    if (monthOffset === 0) {
      const creditCardAccountIds = new Set(
        accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id)
      );

      const paidIncomeThisMonth = (monthTransactions || [])
        .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const paidExpenseThisMonth = (monthTransactions || [])
        .filter(t => t.transaction_type === "EXPENSE" && t.is_paid === true && !creditCardAccountIds.has(t.account_id))
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const paidTransferThisMonth = (monthTransactions || [])
        .filter(t => t.transaction_type === "TRANSFER" && t.is_paid === true)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const calculated = currentAssets - paidIncomeThisMonth + paidExpenseThisMonth + paidTransferThisMonth;
      
      let finalStartingBalance = calculated;
      if (overrides && overrides[monthKey] !== undefined) {
        finalStartingBalance = overrides[monthKey];
      } else {
        const prevMonthKey = format(addMonths(targetDate, -1), "yyyy-MM");
        if (overrides && overrides[prevMonthKey] !== undefined) {
          finalStartingBalance = overrides[prevMonthKey];
        } else if (monthClosing && monthClosing.total_balance_cents !== undefined) {
           // We do not have previous monthClosing easily here because monthClosing is passed as prop
           // The overrides is the most reliable way since we fetch all of them
        }
      }

      return finalStartingBalance;
    }
    if (monthOffset < 0) {
      // SSOT: Usar month_closing selado quando disponível
      if (monthClosing && monthClosing.total_balance_cents !== undefined) {
        // O starting balance de um mês passado é o closing do mês ANTERIOR a ele.
        // Mas para simplificar, usamos o total_balance_cents do closing do mês-alvo
        // como referência — o dashboard mostrará esse valor como "Saldo Fechado".
        return monthClosing.total_balance_cents;
      }

      // Fallback: retro-cálculo (pode ser impreciso, mas é melhor que nada)
      const targetMonthStart = startOfMonth(addMonths(new Date(), monthOffset));
      const bankAccountIds = new Set(accounts.filter(a => a.type !== "CREDIT_CARD").map(a => a.id));

      const paidIncomeSinceThen = (consolidatedTransactions || [])
        .filter(t => t.transaction_type === "INCOME" && t.is_paid === true && new Date(t.date) >= targetMonthStart)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const paidExpenseSinceThen = (consolidatedTransactions || [])
        .filter(t => t.transaction_type === "EXPENSE" && t.is_paid === true && bankAccountIds.has(t.account_id) && new Date(t.date) >= targetMonthStart)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const paidTransferSinceThen = (consolidatedTransactions || [])
        .filter(t => t.transaction_type === "TRANSFER" && t.is_paid === true && new Date(t.date) >= targetMonthStart)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      const calculated = currentAssets - paidIncomeSinceThen + paidExpenseSinceThen + paidTransferSinceThen;
      return overrides && overrides[monthKey] !== undefined ? overrides[monthKey] : calculated;
    }

    const confirmedIncomeThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const prevOutlook = calculateMonthlyOutlook({
      accounts,
      confirmedIncomeCents: confirmedIncomeThisMonth,
      scheduledIncomeCents: scheduledIncomeCents,
      scheduledExpensesCents: scheduledExpensesCents,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset: monthOffset - 1,
      activeSimulations,
      futureTransactions,
      allTransactions: consolidatedTransactions,
      recurringTransactions,
      goals,
      survivalReserveCents,
      invoices
    });
    
    const calculated = prevOutlook.totalAssets || 0;
    return overrides && overrides[monthKey] !== undefined ? overrides[monthKey] : calculated;
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, monthOffset, activeSimulations, futureTransactions, monthTransactions, recurringTransactions, goals, survivalReserveCents, currentAssets, consolidatedTransactions, overrides, invoices, monthClosing]);

  const reconciliationAdjustmentCents = useMemo(() => {
    if (monthOffset !== 0) return 0;
    
    const targetDate = addMonths(new Date(), monthOffset);
    const monthKey = format(targetDate, "yyyy-MM");

    const creditCardAccountIds = new Set(
      accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id)
    );

    const paidIncomeThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const paidExpenseThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "EXPENSE" && t.is_paid === true && !creditCardAccountIds.has(t.account_id))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const paidTransferThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "TRANSFER" && t.is_paid === true)
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const calculated = currentAssets - paidIncomeThisMonth + paidExpenseThisMonth + paidTransferThisMonth;
    
    let finalStartingBalance = calculated;
    if (overrides && overrides[monthKey] !== undefined) {
      finalStartingBalance = overrides[monthKey];
    } else {
      const prevMonthKey = format(addMonths(targetDate, -1), "yyyy-MM");
      if (overrides && overrides[prevMonthKey] !== undefined) {
        finalStartingBalance = overrides[prevMonthKey];
      }
    }

    return calculated - finalStartingBalance;
  }, [accounts, monthTransactions, monthOffset, currentAssets, overrides]);


  const prevMonthOutlook = useMemo(() => {
    if (monthOffset === 0) return null;
    const confirmedIncomeThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
    return calculateMonthlyOutlook({
      accounts,
      confirmedIncomeCents: confirmedIncomeThisMonth,
      scheduledIncomeCents: scheduledIncomeCents,
      scheduledExpensesCents: scheduledExpensesCents,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset: monthOffset - 1,
      activeSimulations,
      futureTransactions,
      allTransactions: consolidatedTransactions,
      recurringTransactions,
      goals,
      survivalReserveCents,
      invoices
    });
  }, [monthOffset, accounts, monthTransactions, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, activeSimulations, futureTransactions, consolidatedTransactions, recurringTransactions, goals, survivalReserveCents, invoices]);

  const cashFlowStatement = useMemo(() => {
    let prevMonthAssets = currentAssets;
    if (monthOffset > 0 && prevMonthOutlook) {
      prevMonthAssets = prevMonthOutlook.totalAssets;
    }

    return generateCashFlowStatement({
      monthOffset,
      currentAssetsCents: currentAssets,
      accounts,
      liveMonthTransactions: monthTransactions,
      futureTransactions,
      recurringTransactions,
      activeSimulations,
      targetDate: addMonths(new Date(), monthOffset),
      liveAllTransactions: consolidatedTransactions,
      startingBalanceOverride: startingBalanceCents
    });
  }, [monthOffset, currentAssets, accounts, monthTransactions, futureTransactions, recurringTransactions, activeSimulations, consolidatedTransactions, prevMonthOutlook, startingBalanceCents]);

  const monthlyOutlook = useMemo(() => {
    const confirmedIncomeThisMonth = (monthTransactions || [])
      .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const baseOutlook = calculateMonthlyOutlook({
      accounts,
      confirmedIncomeCents: confirmedIncomeThisMonth,
      scheduledIncomeCents: scheduledIncomeCents,
      scheduledExpensesCents: scheduledExpensesCents,
      recurringIncomeCents,
      recurringExpensesCents,
      budgets,
      netLiquidityCents: netLiquidity,
      monthOffset,
      activeSimulations,
      futureTransactions,
      allTransactions: consolidatedTransactions,
      recurringTransactions,
      goals,
      survivalReserveCents,
      startingBalanceOverride: startingBalanceCents,
      invoices
    });

    // Projeção Avançada: Usa a liquidez calculada pelo motor central para manter 100% de consistência
    const projectedNetLiquidity = monthOffset === 0
      ? realCycleLiquidity  // Mês atual = estado real (respiro)
      : baseOutlook.projectedNetLiquidity;

    return {
      ...baseOutlook,
      // O saldo final para cálculo de teto (ceiling) deve ser o projetado (baseOutlook) no mês atual
      // e o acumulado (projectedNetLiquidity) nos meses futuros.
      balanceAtMonthEnd: (monthOffset === 0 ? baseOutlook.balanceAtMonthEnd : baseOutlook.totalAssets) || 0,
      projectedNetLiquidity: projectedNetLiquidity || 0
    };
  }, [accounts, scheduledIncomeCents, scheduledExpensesCents, recurringIncomeCents, recurringExpensesCents, budgets, netLiquidity, monthOffset, futureTransactions, goals, activeSimulations, monthTransactions, consolidatedTransactions, survivalReserveCents, realCycleLiquidity, invoices]);

  // --- CÁLCULO UNIFICADO DE IMPACTO DE SIMULAÇÕES (Etapa 2) ---
  const { incomeImpact: simIncome, expenseImpact: simExpense } = useMemo(() => 
    calculateSimulationImpactForMonth(activeSimulations, monthOffset), 
  [activeSimulations, monthOffset]);

  const simulatedNetImpact = simIncome - simExpense;

  const activeDebt = useMemo(() => {
    const baseDebt = monthOffset === 0 ? consolidatedDebt : (monthlyOutlook.totalDebt ?? consolidatedDebt);
    if (activeSimulations.length > 0 && monthOffset === 0) {
      // Se for empréstimo (income com juros) e iniciou hoje, NÃO aumenta dívida imediata de cartão, 
      // mas aumenta a dívida global (simulada). Como o sistema atual atrela debt a cartão, 
      // para empréstimos vamos manter simples e só ajustar liquidez líquida, 
      // a menos que seja uma despesa a prazo simulada.
      const simCreditExpense = activeSimulations
        .filter(s => s.type === "EXPENSE" && s.installments > 1 && (s.startMonthOffset ?? 0) === 0)
        .reduce((sum, s) => sum + s.amount_cents, 0); // Toda a dívida assumida hoje
      return baseDebt + simCreditExpense;
    }
    return baseDebt;
  }, [monthOffset, consolidatedDebt, monthlyOutlook.totalDebt, activeSimulations]);

  const activeAssets = useMemo(() => {
    const baseAssets = monthOffset === 0 ? currentAssets : (monthlyOutlook.totalAssets ?? currentAssets);
    if (monthOffset === 0 && activeSimulations.length > 0) {
      // Impacto no caixa hoje (ex: recebe o principal do empréstimo hoje, ou paga entrada hoje)
      const cashIn = activeSimulations.filter(s => s.type === "INCOME" && (s.startMonthOffset ?? 0) === 0).reduce((sum, s) => sum + s.amount_cents, 0);
      const cashOut = activeSimulations.filter(s => s.type === "EXPENSE" && s.installments === 1 && (s.startMonthOffset ?? 0) === 0).reduce((sum, s) => sum + s.amount_cents, 0);
      return baseAssets + cashIn - cashOut;
    }
    return baseAssets;
  }, [monthOffset, currentAssets, monthlyOutlook.totalAssets, activeSimulations]);

  const activeNetLiquidity = useMemo(() => {
    // Para meses futuros, o baseLiquidity já inclui a simulação via calculateMonthlyOutlook -> calculateAdvancedProjection
    const baseLiquidity = monthOffset === 0 ? realCycleLiquidity : (monthlyOutlook.projectedNetLiquidity ?? netLiquidity);
    if (monthOffset === 0 && activeSimulations.length > 0) {
      // No mês 0, o impacto na liquidez engloba tudo: cash in - dívida contraída (ou cash out)
      const cashIn = activeSimulations.filter(s => s.type === "INCOME" && (s.startMonthOffset ?? 0) === 0).reduce((sum, s) => sum + s.amount_cents, 0);
      const debtOrCashOut = activeSimulations.filter(s => s.type === "EXPENSE" && (s.startMonthOffset ?? 0) === 0).reduce((sum, s) => sum + s.amount_cents, 0);
      return baseLiquidity + cashIn - debtOrCashOut;
    }
    return baseLiquidity;
  }, [monthOffset, realCycleLiquidity, monthlyOutlook.projectedNetLiquidity, netLiquidity, activeSimulations]);

  const debtExit = useMemo(() => {
    return calculateDebtExitProjection({
      netLiquidityCents: activeNetLiquidity,
      recurringIncomeCents: recurringIncomeCents + simIncome,
      recurringExpensesCents: recurringExpensesCents + simExpense,
      monthlyInstallmentsCents: monthlyOutlook.immediateCardDebt,
      budgets
    });
  }, [activeNetLiquidity, recurringIncomeCents, simIncome, recurringExpensesCents, simExpense, monthlyOutlook.immediateCardDebt, budgets]);

  const goalProjections = useMemo(() => {
    return calculateGoalProjections({
      debtExit,
      goals
    });
  }, [debtExit, goals]);
  


  // Total gasto nos cartões de crédito — projetado para meses futuros
  const creditCardUsed = useMemo(() => {
    // O conceito de "Cartões Usados" na UI reflete a fatura que precisamos pagar no mês (immediateCardDebt).
    // Antes, no mês atual (0) o código somava a dívida total (total_debt_cents), o que causava pânico no usuário
    // pois exibia a soma de todas as faturas futuras de parcelamentos como se fossem contas do mês atual.
    return monthlyOutlook.immediateCardDebt ?? 0;
  }, [monthlyOutlook.immediateCardDebt]);



  const isSurvivalMode = monthlyOutlook.isSurvivalMode;
  const isCrisisMode = monthlyOutlook.isCrisisMode;

  const weeklySurvival = useMemo(() => {
    // Margem livre real = Renda recorrente - Despesas fixas recorrentes
    const regularIncome = recurringIncomeCents > 0 ? recurringIncomeCents : 0;
    const regularExpenses = recurringExpensesCents > 0 ? recurringExpensesCents : 0;
    let freeMarginMonthly = Math.max(0, regularIncome - regularExpenses);

    // Ajustar margem livre mensal e saldo de contas com base no impacto de simulações ativas
    let effectiveCheckingBalance = currentAssets;
    if (activeSimulations.length > 0) {
      const monthlySimulatedExpense = simulatedNetImpact < 0 ? Math.abs(simulatedNetImpact) : 0;
      freeMarginMonthly = Math.max(0, freeMarginMonthly - monthlySimulatedExpense);
      effectiveCheckingBalance = Math.max(0, effectiveCheckingBalance - monthlySimulatedExpense);
    }

    // Para meses futuros, usar o saldo projetado em vez do saldo atual
    if (monthOffset > 0) {
      effectiveCheckingBalance = monthlyOutlook.totalAssets ?? 0;
    }

    return calculateWeeklySurvival({
      netFreeMarginMonthly: freeMarginMonthly,
      effectiveCheckingBalance,
      isCrisisMode,
      isSurvivalMode,
      currentMonthTransactions: monthOffset === 0 ? monthTransactions : [],
      weeklyLimitOverrideCents: weeklyLimitOverrideCents > 0 ? weeklyLimitOverrideCents : undefined
    });
  }, [currentAssets, recurringIncomeCents, recurringExpensesCents, monthTransactions, monthOffset, activeSimulations, simulatedNetImpact, monthlyOutlook.totalAssets, weeklyLimitOverrideCents, isCrisisMode, isSurvivalMode]);

  const simulateDetailedImpactFn = useCallback((
    amountCents: number, 
    installments: number, 
    type?: "EXPENSE" | "INCOME",
    loanInstallmentCents?: number,
    loanInstallmentsCount?: number
  ) => 
    simulateDetailedImpact({
      amountCents,
      installments,
      netLiquidityCents: netLiquidity,
      monthlySurplus: debtExit.monthlySurplus,
      currentExitDate: debtExit.exitDate,
      currentBalanceCents: currentAssets,
      type,
      loanInstallmentCents,
      loanInstallmentsCount
    }), [netLiquidity, debtExit.monthlySurplus, debtExit.exitDate, currentAssets]);

  const analyzeSimulationIA = useCallback(async (simulation: any) => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.analyzeSimulationIA(simulation, summary);
    if (error || !data) return "Falha ao consultar a análise do oráculo de IA.";
    return data;
  }, [activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  const solveFinancialDilemma = useCallback(async (dilemmaText: string) => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.solveFinancialDilemma(dilemmaText, summary);
    if (error || !data) return { advice: "Falha ao obter sugestões do copiloto de IA.", simulations: [] };
    return data;
  }, [activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  const optimizeSweepIA = useCallback(async () => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.optimizeSweep(goals, budgets, summary);
    if (error || !data) {
      return {
        advice: "Falha ao obter recomendações de amortização acelerada por IA.",
        suggested_simulation: null
      };
    }
    return data;
  }, [goals, budgets, activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  const consultJarvisIA = useCallback(async (simulation?: any) => {
    const summary = {
      net_liquidity_cents: activeNetLiquidity,
      total_consolidated_debt_cents: activeDebt,
      accumulated_balance_cents: activeAssets,
      monthly_outlook: {
        balance_at_month_end: monthlyOutlook.balanceAtMonthEnd,
        planned_expenses: monthlyOutlook.plannedExpenses,
        scheduled_only: monthlyOutlook.scheduledOnly,
        is_crisis_mode: monthlyOutlook.isCrisisMode
      }
    };
    const { data, error } = await financialService.consultJarvisIA({
      goals,
      budgets,
      accounts,
      transactions: monthTransactions,
      recurring_transactions: recurringTransactions,
      summary,
      simulation
    });

    if (error || !data) {
      return {
        advice: "Falha ao consultar Gabinete de Crise Vesper Jarvis.",
        suggested_loan_amount_cents: 0,
        loan_verdict: "Copiloto indisponível.",
        postponement_tips: []
      };
    }
    return data;
  }, [goals, budgets, accounts, monthTransactions, recurringTransactions, activeNetLiquidity, activeDebt, activeAssets, monthlyOutlook]);

  return useMemo(() => ({
    netLiquidityCents: activeNetLiquidity,
    totalConsolidatedDebtCents: activeDebt,
    accumulatedBalanceCents: activeAssets,
    startingBalanceCents: startingBalanceCents,
    reconciliationAdjustmentCents: reconciliationAdjustmentCents,
    checkingBalanceCents: currentAssets,
    creditCardUsedCents: creditCardUsed,
    monthlyOutlook: {
      ...monthlyOutlook,
      balanceAtMonthEnd: monthlyOutlook.balanceAtMonthEnd || 0,
      projectedNetLiquidity: monthlyOutlook.projectedNetLiquidity || 0
    },
    cashFlowStatement,
    healthScore,
    recurringIncomeCents,
    recurringExpensesCents,
    isSurvivalMode,
    isCrisisMode,
    debtExit,
    weeklySurvival,
    goalProjections,
    simulateDetailedImpact: simulateDetailedImpactFn,
    analyzeSimulationIA,
    solveFinancialDilemma,
    optimizeSweepIA,
    consultJarvisIA
  }), [activeNetLiquidity, activeDebt, activeAssets, currentAssets, creditCardUsed, monthlyOutlook, cashFlowStatement, healthScore, recurringIncomeCents, recurringExpensesCents, debtExit, weeklySurvival, goalProjections, simulateDetailedImpactFn, analyzeSimulationIA, solveFinancialDilemma, optimizeSweepIA, consultJarvisIA, reconciliationAdjustmentCents, startingBalanceCents]);
}
