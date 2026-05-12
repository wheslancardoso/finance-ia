import { Account, Budget, Goal, RecurringTransaction, Transaction } from "@/lib/db";
import { addMonths, startOfMonth, endOfMonth, isSameMonth, isAfter, isBefore } from "date-fns";

export interface Simulation {
  amount_cents: number;
  installments: number;
  description?: string;
}

export interface MonthlyOutlook {
  balanceAtMonthEnd: number;
  plannedExpenses: number;
  immediateCardDebt: number;
  upcomingCardDebt: number;
  projectedNetLiquidity?: number; // Patrimônio Líquido na data projetada
}

/**
 * Calcula o total de receitas agendadas para o mês atual (do dia atual até o fim do mês)
 */
export function calculateScheduledIncome(recurring: RecurringTransaction[]): number {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const endOfMonthDay = new Date(todayYear, todayMonth + 1, 0).getDate();

  return (recurring || [])
    .filter((r) => {
      if (r.transaction_type !== "INCOME" || r.status !== 'active') return false;
      const datePart = typeof r.next_date === 'string' ? r.next_date.split('T')[0] : '';
      const [y, m, d] = datePart.split('-').map(Number);
      return y === todayYear && (m - 1) === todayMonth && d >= todayDay && d <= endOfMonthDay;
    })
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total de despesas agendadas para o mês atual (do dia atual até o fim do mês)
 */
export function calculateScheduledExpenses(recurring: RecurringTransaction[]): number {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const endOfMonthDay = new Date(todayYear, todayMonth + 1, 0).getDate();

  return (recurring || [])
    .filter((r) => {
      if (r.transaction_type !== "EXPENSE" || r.status !== 'active') return false;
      const datePart = typeof r.next_date === 'string' ? r.next_date.split('T')[0] : '';
      const [y, m, d] = datePart.split('-').map(Number);
      return y === todayYear && (m - 1) === todayMonth && d >= todayDay && d <= endOfMonthDay;
    })
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total mensal de receitas recorrentes ativas
 */
export function calculateRecurringIncome(recurring: RecurringTransaction[]): number {
  return (recurring || [])
    .filter((r) => r.transaction_type === "INCOME" && r.status === 'active')
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total mensal de despesas recorrentes ativas
 */
export function calculateRecurringExpenses(recurring: RecurringTransaction[]): number {
  return (recurring || [])
    .filter((r) => r.transaction_type === "EXPENSE" && r.status === 'active')
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total mensal da renda primária ativa
 */
export function calculatePrimaryIncome(recurring: RecurringTransaction[]): number {
  return (recurring || [])
    .filter((r) => r.transaction_type === "INCOME" && r.status === 'active' && r.is_primary_income)
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula a Dívida Total Consolidada (Soma de faturas abertas e fechadas de todos os cartões)
 */
export function calculateTotalConsolidatedDebt(accounts: Account[]): number {
  if (!accounts || !Array.isArray(accounts)) return 0;
  return accounts
    .filter((a) => a && a.type === "CREDIT_CARD")
    .reduce((sum, a) => {
      // Priorizar total_debt_cents se disponível, senão cair no somatório de faturas
      const debt = a.total_debt_cents !== undefined 
        ? Number(a.total_debt_cents) 
        : (Number(a.closed_invoice_cents) || 0) + (Number(a.open_invoice_cents) || 0);
      return sum + debt;
    }, 0);
}

/**
 * Calcula a Dívida do Mês Atual (Apenas faturas abertas e fechadas que vencem agora)
 */
export function calculateCurrentMonthDebt(accounts: Account[]): number {
  if (!accounts || !Array.isArray(accounts)) return 0;
  return accounts
    .filter((a) => a && a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (Number(a.closed_invoice_cents) || 0) + (Number(a.open_invoice_cents) || 0), 0);
}

/**
 * Calcula a Liquidez Acumulada (Soma de saldos de contas corrente e investimento)
 */
export function calculateAccumulatedBalance(accounts: Account[]): number {
  if (!accounts || !Array.isArray(accounts)) return 0;
  return accounts
    .filter((a) => a && a.type !== "CREDIT_CARD")
    .reduce((sum, a) => sum + (Number(a.balance_cents) || 0), 0);
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
  isCrisisMode: boolean;
  projectedNetLiquidity?: number;
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

export interface WeeklySurvival {
  weeklyLimitCents: number;
  weeklySpentCents: number;
  remainingCents: number;
  daysRemaining: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

/**
 * Calcula o Teto de Sobrevivência Semanal (Sobra Mensal / 4)
 * e o quanto já foi consumido na semana atual.
 */
export function calculateWeeklySurvival(params: {
  monthlySurplusCents: number;
  currentMonthTransactions: any[];
}): WeeklySurvival {
  const { monthlySurplusCents, currentMonthTransactions } = params;
  
  // Limite semanal é a sobra mensal dividida por 4 (janelas de 7 dias)
  const weeklyLimitCents = Math.max(0, Math.round(monthlySurplusCents / 4));
  
  // Identificar transações variáveis da semana atual (últimos 7 dias)
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  
  const weeklySpentCents = currentMonthTransactions
    .filter(t => {
      const tDate = new Date(t.date);
      // Apenas despesas que não são recorrentes (gastos variáveis de sobrevivência)
      return t.transaction_type === "EXPENSE" && 
             !t.is_recurring && 
             tDate >= sevenDaysAgo && 
             tDate <= now;
    })
    .reduce((sum, t) => sum + (t.amount_cents || 0), 0);
    
  const remainingCents = weeklyLimitCents - weeklySpentCents;
  
  // Calcular dias restantes na "janela" da semana (próximo domingo ou ciclo de 7 dias)
  const daysRemaining = 7 - (now.getDay() || 7) + 1; // Simplificado: até o fim da semana civil
  
  let status: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
  const consumptionRatio = weeklyLimitCents > 0 ? weeklySpentCents / weeklyLimitCents : 0;
  
  if (consumptionRatio > 0.9 || remainingCents < 0) status = "CRITICAL";
  else if (consumptionRatio > 0.6) status = "WARNING";
  
  return {
    weeklyLimitCents,
    weeklySpentCents,
    remainingCents,
    daysRemaining,
    status
  };
}

export function calculateMonthlyOutlook(params: {
  accounts: Account[];
  scheduledIncomeCents: number;
  scheduledExpensesCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  budgets: Budget[];
  netLiquidityCents: number;
  monthOffset?: number; // 0 = atual, 1 = próximo...
}): MonthlyOutlook {
  const { 
    accounts, 
    scheduledIncomeCents, 
    scheduledExpensesCents, 
    recurringIncomeCents,
    recurringExpensesCents,
    budgets, 
    netLiquidityCents,
    monthOffset = 0 
  } = params;
  
  const liquidity = calculateAccumulatedBalance(accounts);
  const currentMonthDebt = calculateCurrentMonthDebt(accounts);
  
  // No mês atual (offset 0), usamos os agendados. Nos futuros, os recorrentes.
  const monthlyIncome = monthOffset === 0 ? scheduledIncomeCents : recurringIncomeCents;
  const monthlyExpenses = monthOffset === 0 ? scheduledExpensesCents : recurringExpensesCents;
  
  const budgetReserves = budgets.reduce((sum, b) => {
    return sum + Math.max(0, (b.amount_cents || 0) - (b.spent_cents || 0));
  }, 0);

  // Sobra mensal estimada
  const monthlySurplus = Math.max(0, monthlyIncome - monthlyExpenses - budgetReserves);
  
  // Projeção Simplificada: Liquidez Atual + (Sobra * meses)
  // Mas para o saldo de final de mês, consideramos apenas o ciclo atual.
  const balanceAtMonthEnd = liquidity + monthlyIncome - (monthlyExpenses + currentMonthDebt) - budgetReserves;

  const immediateCardDebt = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.closed_invoice_cents || 0), 0);

  const upcomingCardDebt = accounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.open_invoice_cents || 0), 0);

  const isCritical = balanceAtMonthEnd < 0;
  const isCrisisMode = isCritical && netLiquidityCents < 0;

  return {
    balanceAtMonthEnd: Number(balanceAtMonthEnd) || 0,
    plannedExpenses: Number(monthlyExpenses + currentMonthDebt + budgetReserves) || 0,
    immediateCardDebt: Number(immediateCardDebt) || 0,
    upcomingCardDebt: Number(upcomingCardDebt) || 0,
    scheduledOnly: Number(monthlyExpenses) || 0,
    budgetReserves: Number(budgetReserves) || 0,
    isHealthy: balanceAtMonthEnd >= 0 && netLiquidityCents >= 0,
    isRecovering: balanceAtMonthEnd >= 0 && netLiquidityCents < 0,
    isCritical,
    isCrisisMode,
    projectedNetLiquidity: Number(balanceAtMonthEnd) // Fallback inicial
  };
}

/**
 * Motor de Projeção Acumulada Avançada (Time Machine)
 * Calcula o saldo futuro simulando a passagem dos meses.
 */
export function calculateAdvancedProjection(params: {
  currentNetLiquidity: number;
  recurringTransactions: RecurringTransaction[];
  futureTransactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  monthOffset: number;
  activeSimulations?: Simulation[];
}): number {
  const {
    currentNetLiquidity,
    recurringTransactions,
    futureTransactions,
    goals,
    budgets,
    monthOffset,
    activeSimulations = []
  } = params;

  let projectedBalance = currentNetLiquidity;
  const now = new Date();

  // Iterar mês a mês para acumular resultados
  for (let i = 0; i <= monthOffset; i++) {
    const targetDate = addMonths(now, i);
    const targetStart = startOfMonth(targetDate);
    const targetEnd = endOfMonth(targetDate);

    // 1. Receitas e Despesas Recorrentes
    const monthlyIncome = recurringTransactions
      .filter(r => r.transaction_type === "INCOME" && r.status === "active")
      .reduce((sum, r) => sum + (r.amount_cents || 0), 0);

    const monthlyExpenses = recurringTransactions
      .filter(r => r.transaction_type === "EXPENSE" && r.status === "active")
      .reduce((sum, r) => sum + (r.amount_cents || 0), 0);

    // 2. Parcelamentos do Cartão (Transactions futuras)
    // Apenas transações que caem no mês específico da iteração
    const installmentDebt = futureTransactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.transaction_type === "EXPENSE" && 
               (isSameMonth(tDate, targetDate) || (isAfter(tDate, targetStart) && isBefore(tDate, targetEnd)));
      })
      .reduce((sum, t) => sum + (t.amount_cents || 0), 0);

    // 3. Reservas de Orçamento (Provisão mensal)
    const monthlyBudgets = budgets.reduce((sum, b) => sum + (b.amount_cents || 0), 0);

    // 4. Aportes em Metas (Compromisso de poupança)
    // Calculamos o aporte mensal necessário para cada meta ativa
    const monthlyGoals = goals
      .filter(g => g.status === "ACTIVE")
      .reduce((sum, g) => {
        // Se a meta tiver um valor mensal definido ou se for uma "meta de economia"
        // Aqui assumimos que o usuário quer transferir o valor total ou um valor fixo
        // Para simplificar, usamos 10% da renda ou um valor fixo se implementado
        // No contexto do usuário, ele quer "juntar R$ 1000 todo mês"
        return sum + (g.monthly_contribution_cents || 0);
      }, 0);

    // 5. Simulações Ativas (Impacto de compras simuladas)
    const monthlySimulations = activeSimulations.reduce((sum, s) => {
      // Se a simulação tiver parcelas, verificamos se ela ainda está ativa nesta iteração
      if (i <= s.installments) {
        return sum + (s.amount_cents / s.installments);
      }
      return sum;
    }, 0);

    // Acumular saldo do mês
    const monthlySurplus = monthlyIncome - (monthlyExpenses + installmentDebt + monthlyBudgets + monthlyGoals + monthlySimulations);
    projectedBalance += monthlySurplus;
  }

  return projectedBalance;
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
  goals: Goal[];
}): GoalProjection[] {
  const { debtExit, goals } = params;
  let currentFocusDate = debtExit.exitDate ? new Date(debtExit.exitDate) : new Date();
  
  // Ordenar por prioridade (assumindo que já vêm ordenadas ou usando critério padrão)
  const sortedGoals = [...goals].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  return sortedGoals.map((goal) => {
    const remainingCents = (goal.target_amount_cents || 0) - (goal.current_amount_cents || 0);
    const surplusForGoals = (debtExit.monthlySurplus || 0) * 0.5;
    
    const monthsToComplete = (surplusForGoals > 0 && remainingCents > 0)
      ? Math.ceil(remainingCents / surplusForGoals)
      : (remainingCents <= 0 ? 0 : 999);
      
    const focusDate = new Date(currentFocusDate);
    const completionDate = new Date(focusDate);
    
    if (monthsToComplete !== 999) {
      completionDate.setMonth(completionDate.getMonth() + (monthsToComplete || 0));
    } else {
      completionDate.setFullYear(completionDate.getFullYear() + 10); // 10 anos se não houver sobra
    }
    
    const today = new Date();
    const monthsToStart = Math.max(0, (focusDate.getFullYear() - today.getFullYear()) * 12 + (focusDate.getMonth() - today.getMonth()));
    
    // Sugerimos alocar 50% da sobra se for o foco atual, senão 0
    const recommendedAmountCents = (monthsToStart === 0 && (debtExit.monthsToExit || 0) === 0)
      ? Math.round((debtExit.monthlySurplus || 0) * 0.5)
      : 0;

    const projection = {
      goalId: goal.id,
      goalName: goal.name,
      focusDate,
      completionDate,
      canFocusNow: monthsToStart === 0 && (debtExit.monthsToExit || 0) === 0,
      monthsToStart,
      recommendedAmountCents,
      reasoning: monthsToStart > 0 
        ? `Aguardando ${monthsToStart} meses (${(debtExit.monthsToExit || 0) > 0 ? 'quitação de dívidas' : 'metas prioritárias'})`
        : "Pronto para foco imediato."
    };
    
    // O próximo objetivo começa quando este termina
    currentFocusDate = new Date(completionDate);
    
    return projection;
  });
}


export interface SimulationDetailedResult {
  status: "SAFE" | "WARNING" | "DANGER";
  message: string;
  impact_percentage: number;
  new_balance_cents: number;
  new_net_liquidity_cents: number;
  debt_exit_delay_months: number;
  new_exit_date: Date | null;
  installment_impact: number;
}

/**
 * Simula o impacto de uma compra (à vista ou parcelada) nas projeções financeiras.
 */
export function simulateDetailedImpact(params: {
  amountCents: number;
  installments: number;
  netLiquidityCents: number;
  monthlySurplus: number;
  currentExitDate: Date | null;
  currentBalanceCents: number;
}): SimulationDetailedResult {
  const { amountCents, installments, netLiquidityCents, monthlySurplus, currentExitDate, currentBalanceCents } = params;
  
  const isInstallment = installments > 1;
  const monthlyImpact = isInstallment ? Math.round(amountCents / installments) : amountCents;
  
  // Novo saldo de liquidez líquida (imediatamente reduz o valor total se for à vista, 
  // ou reduz gradualmente se for parcelado - mas para fins de "saúde real", consideramos o compromisso total)
  const newNetLiquidity = netLiquidityCents - amountCents;
  const newMonthlySurplus = monthlySurplus - (isInstallment ? monthlyImpact : 0);
  
  // Novo cálculo de saída de dívida
  let newExitDate = currentExitDate;
  let debtExitDelay = 0;
  
  if (newNetLiquidity < 0 && newMonthlySurplus > 0) {
    const monthsToExit = Math.ceil(Math.abs(newNetLiquidity) / newMonthlySurplus);
    newExitDate = new Date();
    newExitDate.setMonth(newExitDate.getMonth() + monthsToExit);
    
    if (currentExitDate) {
      const currentMonths = Math.ceil(Math.abs(netLiquidityCents) / monthlySurplus);
      debtExitDelay = monthsToExit - currentMonths;
    } else {
      debtExitDelay = monthsToExit;
    }
  } else if (newMonthlySurplus <= 0 && newNetLiquidity < 0) {
    newExitDate = null;
    debtExitDelay = 999;
  }

  // Determinar Status
  let status: "SAFE" | "WARNING" | "DANGER" = "SAFE";
  let message = "";
  
  const impactOnSurplus = monthlySurplus > 0 ? Math.round((monthlyImpact / monthlySurplus) * 100) : 100;
  
  if (newNetLiquidity < 0 || newMonthlySurplus < (monthlySurplus * 0.5)) {
    status = "DANGER";
    message = isInstallment 
      ? `Atenção: Esta parcela de ${formatCurrency(monthlyImpact)} compromete ${impactOnSurplus}% da sua sobra mensal.`
      : "Risco Alto: Esta compra zera sua reserva imediata ou aumenta seu ciclo de dívida.";
  } else if (impactOnSurplus > 20) {
    status = "WARNING";
    message = "Moderado: A compra é possível, mas reduz consideravelmente seu fôlego mensal.";
  } else {
    status = "SAFE";
    message = "Seguro: O impacto é baixo e não compromete seus objetivos principais.";
  }

  if (debtExitDelay > 0 && debtExitDelay !== 999) {
    message += ` Isso atrasará sua saída das dívidas em ${debtExitDelay} ${debtExitDelay === 1 ? 'mês' : 'meses'}.`;
  } else if (debtExitDelay === 999) {
    message = "Crítico: Esta compra impede que você saia das dívidas com sua renda atual.";
  }

  return {
    status,
    message,
    impact_percentage: impactOnSurplus,
    new_balance_cents: currentBalanceCents - (isInstallment ? monthlyImpact : amountCents),
    new_net_liquidity_cents: newNetLiquidity,
    debt_exit_delay_months: debtExitDelay === 999 ? 0 : debtExitDelay,
    new_exit_date: newExitDate,
    installment_impact: monthlyImpact
  };
}

function formatCurrency(cents: number) {
  if (isNaN(cents) || cents === null || cents === undefined) {
    return "R$ 0,00";
  }
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
