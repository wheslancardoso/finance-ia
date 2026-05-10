
import { Account, Budget, RecurringTransaction } from "@/lib/db";
import { isSameMonth, endOfMonth } from "date-fns";

/**
 * Calcula a Dívida Total Consolidada (Soma de faturas abertas e fechadas de todos os cartões)
 */
export function calculateTotalConsolidatedDebt(accounts: Account[]): number {
  return accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.closed_invoice_cents || 0) + (a.open_invoice_cents || 0), 0);
}

/**
 * Calcula a Liquidez Acumulada (Soma de saldos de contas corrente e investimento)
 */
export function calculateAccumulatedBalance(accounts: Account[]): number {
  return accounts
    .filter((a) => a.type !== "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.balance_cents || 0), 0);
}

/**
 * Calcula a Liquidez Líquida Real (O que você realmente tem se pagasse tudo hoje)
 */
export function calculateNetLiquidity(accounts: Account[]): number {
  const assets = calculateAccumulatedBalance(accounts);
  const debt = calculateTotalConsolidatedDebt(accounts);
  return assets - debt;
}

/**
 * Calcula o Panorama Mensal (Projeção de final de mês baseada em agendados e reservas)
 */
export interface MonthlyOutlook {
  balanceAtMonthEnd: number;
  plannedExpenses: number;
  immediateCardDebt: number;
  upcomingCardDebt: number;
  scheduledOnly: number;
  budgetReserves: number;
  isHealthy: boolean;
  isRecovering: boolean;
  isCritical: boolean;
}

export interface GoalProjection {
  goalId: string;
  goalName: string;
  focusDate: Date;
  completionDate: Date;
  canFocusNow: boolean;
  monthsToStart: number;
  reasoning: string;
  recommendedAmountCents: number;
}

export interface DebtExitProjection {
  monthsToExit: number;
  exitDate: Date | null;
  monthlySurplus: number;
}

export function calculateMonthlyOutlook(params: {
  accounts: Account[];
  scheduledIncomeCents: number;
  scheduledExpensesCents: number;
  budgets: Budget[];
  netLiquidityCents: number;
}): MonthlyOutlook {
  const { accounts, scheduledIncomeCents, scheduledExpensesCents, budgets, netLiquidityCents } = params;
  
  const liquidity = calculateAccumulatedBalance(accounts);
  const cardDebt = calculateTotalConsolidatedDebt(accounts);
  
  const pendingIncome = scheduledIncomeCents;
  const pendingOutflow = scheduledExpensesCents + cardDebt;
  
  const budgetReserves = budgets.reduce((sum, b) => {
    return sum + Math.max(0, (b.amount_cents || 0) - (b.spent_cents || 0));
  }, 0);

  const balanceAtMonthEnd = liquidity + pendingIncome - pendingOutflow - budgetReserves;

  const immediateCardDebt = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.closed_invoice_cents || 0), 0);

  const upcomingCardDebt = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.open_invoice_cents || 0), 0);

  return {
    balanceAtMonthEnd,
    plannedExpenses: pendingOutflow + budgetReserves,
    immediateCardDebt,
    upcomingCardDebt,
    scheduledOnly: scheduledExpensesCents,
    budgetReserves,
    isHealthy: balanceAtMonthEnd >= 0 && netLiquidityCents >= 0,
    isRecovering: balanceAtMonthEnd >= 0 && netLiquidityCents < 0,
    isCritical: balanceAtMonthEnd < 0
  };
}

/**
 * Projeta quando o usuário sairá do ciclo de dívida líquida.
 */
export function calculateDebtExitProjection(params: {
  netLiquidityCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  budgets: Budget[];
}): DebtExitProjection {
  const { netLiquidityCents, recurringIncomeCents, recurringExpensesCents, budgets } = params;
  
  const budgetTotal = budgets.reduce((sum, b) => sum + (b.amount_cents || 0), 0);
  const monthlySurplus = (recurringIncomeCents || 0) - (recurringExpensesCents || 0) - budgetTotal;
  
  if (netLiquidityCents >= 0) {
    return { monthsToExit: 0, exitDate: new Date(), monthlySurplus };
  }
  
  if (monthlySurplus <= 0) {
    return { monthsToExit: 999, exitDate: null, monthlySurplus };
  }
  
  const monthsToExit = Math.ceil(Math.abs(netLiquidityCents) / monthlySurplus);
  const exitDate = new Date();
  exitDate.setMonth(exitDate.getMonth() + monthsToExit);
  
  return { monthsToExit, exitDate, monthlySurplus };
}

/**
 * Projeta o cronograma de foco para cada meta.
 */
export function calculateGoalProjections(params: {
  debtExit: DebtExitProjection;
  goals: any[];
}): GoalProjection[] {
  const { debtExit, goals } = params;
  let currentFocusDate = debtExit.exitDate ? new Date(debtExit.exitDate) : new Date();
  
  // Ordenar por prioridade (assumindo que já vêm ordenadas ou usando critério padrão)
  const sortedGoals = [...goals].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  return sortedGoals.map((goal) => {
    const remainingCents = goal.target_amount_cents - goal.current_amount_cents;
    const monthsToComplete = (debtExit.monthlySurplus > 0 && remainingCents > 0)
      ? Math.ceil(remainingCents / (debtExit.monthlySurplus * 0.5)) // Usamos 50% da sobra para metas
      : (remainingCents <= 0 ? 0 : 999);
      
    const focusDate = new Date(currentFocusDate);
    const completionDate = new Date(focusDate);
    
    if (monthsToComplete !== 999) {
      completionDate.setMonth(completionDate.getMonth() + monthsToComplete);
    } else {
      completionDate.setFullYear(completionDate.getFullYear() + 10); // 10 anos se não houver sobra
    }
    
    const today = new Date();
    const monthsToStart = Math.max(0, (focusDate.getFullYear() - today.getFullYear()) * 12 + (focusDate.getMonth() - today.getMonth()));
    
    // Sugerimos alocar 50% da sobra se for o foco atual, senão 0
    const recommendedAmountCents = (monthsToStart === 0 && debtExit.monthsToExit === 0)
      ? Math.round(debtExit.monthlySurplus * 0.5)
      : 0;

    const projection = {
      goalId: goal.id,
      goalName: goal.name,
      focusDate,
      completionDate,
      canFocusNow: monthsToStart === 0 && debtExit.monthsToExit === 0,
      monthsToStart,
      recommendedAmountCents,
      reasoning: monthsToStart > 0 
        ? `Aguardando ${monthsToStart} meses (${debtExit.monthsToExit > 0 ? 'quitação de dívidas' : 'metas prioritárias'})`
        : "Pronto para foco imediato."
    };
    
    // O próximo objetivo começa quando este termina
    currentFocusDate = new Date(completionDate);
    
    return projection;
  });
}

