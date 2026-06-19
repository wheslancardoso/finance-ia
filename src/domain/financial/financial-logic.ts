import { Account, Transaction, RecurringTransaction, Budget, Goal } from "@/lib/db";

/**
 * Força interpretação de data no formato YYYY-MM-DD como data local, evitando bugs de fuso horário UTC.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

import { addMonths, startOfMonth, endOfMonth, isSameMonth, isAfter, isBefore, format } from "date-fns";

export interface Simulation {
  amount_cents: number;
  installments: number;
  description?: string;
  type?: "EXPENSE" | "INCOME";
  interestRate?: number;
  isLoan?: boolean;
  startMonthOffset?: number;
  customInstallmentCents?: number;
}

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
  isSurvivalMode: boolean;
  totalDebt: number;       // Dívida total remanescente no mês projetado
  totalAssets: number;     // Saldo bruto projetado no mês projetado
  projectedNetLiquidity?: number; // Patrimônio Líquido na data projetada
}

/**
 * Verifica se uma transação recorrente já expirou em um determinado mês de referência (yyyy-MM).
 * Ela expira se a descrição contiver "[Vence: YYYY-MM]" e o mês de referência for posterior a YYYY-MM.
 */
export function isRecurringExpired(description: string, targetMonthKey: string): boolean {
  if (!description) return false;
  const match = description.match(/\[[Vv]ence:\s*(\d{4}-\d{2})\]/);
  if (!match) return false;
  return targetMonthKey > match[1];
}

export function calculateSimulationImpactForMonth(simulations: Simulation[], monthOffset: number): { incomeImpact: number; expenseImpact: number } {
  const expenseImpact = simulations.reduce((sum, s) => {
    const startOffset = s.startMonthOffset ?? 0;
    const sType = s.type ? s.type.toUpperCase() : "EXPENSE";
    const isLoan = s.isLoan || sType === "LOAN" || (s.interestRate && s.interestRate > 0 && sType === "INCOME");
    
    if (isLoan) {
      if (monthOffset >= startOffset && monthOffset < startOffset + s.installments) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        const rate = (s.interestRate && s.interestRate > 0) ? s.interestRate : 9.53;
        return sum + calculateLoanInstallment(s.amount_cents, rate, s.installments);
      }
      return sum;
    }
    if (sType === "INCOME") return sum;
    if (monthOffset >= startOffset && monthOffset < startOffset + s.installments) {
      if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
        return sum + s.customInstallmentCents;
      }
      return sum + (s.amount_cents / (s.installments || 1));
    }
    return sum;
  }, 0);

  const incomeImpact = simulations.reduce((sum, s) => {
    const startOffset = s.startMonthOffset ?? 0;
    const sType = s.type ? s.type.toUpperCase() : "EXPENSE";
    const isLoan = s.isLoan || sType === "LOAN" || (s.interestRate && s.interestRate > 0 && sType === "INCOME");
    
    if (monthOffset === startOffset && (isLoan || sType === "INCOME")) {
      return sum + s.amount_cents;
    }
    return sum;
  }, 0);

  return { incomeImpact, expenseImpact };
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
  const targetMonthKey = format(now, 'yyyy-MM');

  return (recurring || [])
    .filter((r) => {
      if (r.transaction_type !== "INCOME" || r.status !== 'active') return false;
      if (isRecurringExpired(r.description, targetMonthKey)) return false;
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
  const targetMonthKey = format(now, 'yyyy-MM');

  return (recurring || [])
    .filter((r) => {
      if (r.transaction_type !== "EXPENSE" || r.status !== 'active') return false;
      if (isRecurringExpired(r.description, targetMonthKey)) return false;
      const datePart = typeof r.next_date === 'string' ? r.next_date.split('T')[0] : '';
      const [y, m, d] = datePart.split('-').map(Number);
      return y === todayYear && (m - 1) === todayMonth && d >= todayDay && d <= endOfMonthDay;
    })
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total mensal de receitas recorrentes ativas
 */
export function calculateRecurringIncome(recurring: RecurringTransaction[], date: Date = new Date()): number {
  const monthKey = format(date, 'yyyy-MM');
  return (recurring || [])
    .filter((r) =>
      r.transaction_type === "INCOME" &&
      r.status === 'active' &&
      !isRecurringExpired(r.description, monthKey) &&
      !r.excluded_months?.includes(monthKey)
    )
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total mensal de despesas recorrentes ativas
 */
export function calculateRecurringExpenses(recurring: RecurringTransaction[], date: Date = new Date()): number {
  const monthKey = format(date, 'yyyy-MM');
  return (recurring || [])
    .filter((r) =>
      r.transaction_type === "EXPENSE" &&
      r.status === 'active' &&
      !isRecurringExpired(r.description, monthKey) &&
      !r.excluded_months?.includes(monthKey)
    )
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Calcula o total mensal da renda primária ativa
 */
export function calculatePrimaryIncome(recurring: RecurringTransaction[], date: Date = new Date()): number {
  const monthKey = format(date, 'yyyy-MM');
  return (recurring || [])
    .filter((r) =>
      r.transaction_type === "INCOME" &&
      r.status === 'active' &&
      r.is_primary_income &&
      !isRecurringExpired(r.description, monthKey) &&
      !r.excluded_months?.includes(monthKey)
    )
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);
}

/**
 * Deduplica transações com base no ID da transação.
 * Combina múltiplos arrays de transações em um único array sem duplicatas.
 */
export function deduplicateTransactions(txArrays: Transaction[][]): Transaction[] {
  const consolidated = txArrays.flat().filter(Boolean);
  return Array.from(new Map(consolidated.map(t => [t.id, t])).values());
}

/**
 * Calcula a Dívida de Parcelamentos para o mês específico (Calculado a partir de transactions)
 * Considera transações EXPENSE não pagas que caem no mês alvo.
 */
export function calculateInstallmentDebtForMonth(transactions: Transaction[], targetDate: Date): number {
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  return (transactions || [])
    .filter((t) => {
      if (t.transaction_type !== "EXPENSE" || t.is_paid) return false;
      const d = parseLocalDate(t.date);
      return (
        d.getMonth() === targetMonth &&
        d.getFullYear() === targetYear
      );
    })
    .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
}

/**
 * Determina a data real de impacto/vencimento financeiro de uma transação.
 * Para cartões de crédito, projeta para o mês do vencimento da fatura com base no dia de fechamento.
 * Para outras contas, retorna a data original da transação.
 */
export function getTransactionImpactDate(t: Transaction, accounts: Account[]): Date {
  const tDate = parseLocalDate(t.date);
  const account = (accounts || []).find(a => a.id === t.account_id);
  if (!account || account.type !== "CREDIT_CARD") {
    return tDate;
  }

  const closingDay = account.closing_day || 31;
  const dueDay = account.due_day || 5;
  let year = tDate.getFullYear();
  let month = tDate.getMonth();
  const day = tDate.getDate();

  // Se a data da compra for maior ou igual ao dia de fechamento do cartão, ela cai na fatura do próximo mês
  if (day >= closingDay) {
    month++;
  }

  // Se o dia de vencimento for menor que o dia de fechamento, significa que a fatura 
  // só será paga no mês seguinte ao mês da fatura.
  if (dueDay < closingDay) {
    month++;
  }

  if (month > 11) {
    year += Math.floor(month / 12);
    month = month % 12;
  }

  return new Date(year, month, 1);
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
  const currentMonthStr = format(new Date(), "yyyy-MM");
  return accounts
    .filter((a) => a && a.type === "CREDIT_CARD")
    .reduce((sum, a) => {
      let debt = 0;
      if (a.closed_invoice_cents && a.closed_invoice_month === currentMonthStr) {
        debt += Number(a.closed_invoice_cents) || 0;
      }
      if (a.open_invoice_cents && a.open_invoice_month === currentMonthStr) {
        debt += Number(a.open_invoice_cents) || 0;
      }
      return sum + debt;
    }, 0);
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
 * Calcula a Liquidez de Ciclo Real (Respiro Real de Sobrevivência)
 * Ativos - Dívidas de Cartão - Despesas Manuais Pendentes do Mês Atual
 */
export function calculateRealCycleLiquidity(params: {
  accounts: Account[];
  currentMonthTransactions: Transaction[];
}): number {
  const { accounts, currentMonthTransactions } = params;

  const assets = calculateAccumulatedBalance(accounts);

  // No Modo de Sobrevivência (Mês Atual), o que importa é a dívida que vence AGORA
  const currentMonthDebt = (currentMonthTransactions || [])
    .filter(t =>
      t.transaction_type === "EXPENSE" &&
      !t.is_paid &&
      isSameMonth(getTransactionImpactDate(t, accounts), new Date())
    )
    .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

  const result = assets - currentMonthDebt;
  // console.log(`[Liquidez Real] Ativos: ${assets}, Dívida Mês: ${currentMonthDebt}, Resultado: ${result}`);
  return result;
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
  totalDebt: number;
  totalAssets: number;
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

export const MIN_WEEKLY_LIMIT_CENTS = 5000;

/**
 * Calcula o Teto de Sobrevivência Semanal (Sobra Mensal / Semanas do Mês)
 * e o quanto já foi consumido na semana atual, aplicando regras de abundância e corte emergencial.
 */
export function calculateWeeklySurvival(params: {
  netFreeMarginMonthly: number;
  effectiveCheckingBalance: number;
  isCrisisMode: boolean;
  isSurvivalMode: boolean;
  currentMonthTransactions: Transaction[];
  weeklyLimitOverrideCents?: number;
}): WeeklySurvival {
  const { netFreeMarginMonthly, effectiveCheckingBalance, isCrisisMode, isSurvivalMode, currentMonthTransactions, weeklyLimitOverrideCents } = params;

  const now = new Date();
  
  // 1. Base Limit (Dinâmico conforme a data)
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(1, daysInMonth - currentDay + 1);
  const weeksInPeriod = Math.max(1, Math.ceil(daysRemainingInMonth / 7));

  let baseLimitCents = 0;
  if (netFreeMarginMonthly > 0) {
    baseLimitCents = Math.round(netFreeMarginMonthly / weeksInPeriod);
  } else if (effectiveCheckingBalance > 0) {
    baseLimitCents = Math.round(effectiveCheckingBalance / weeksInPeriod);
  }

  let weeklyLimitCents = baseLimitCents;

  // 2. Redutor de Abundância Progressiva: Acima de R$ 300,00, apenas 30% do excedente entra no teto
  if (baseLimitCents > 30000) {
    weeklyLimitCents = 30000 + Math.round((baseLimitCents - 30000) * 0.30);
  }

  // 3. Corte Emergencial de Crise: Se em crise ou sobrevivência, cortar 50%
  if (isCrisisMode || isSurvivalMode) {
    weeklyLimitCents = Math.round(weeklyLimitCents * 0.5);
    // Piso de subsistência rígido na crise
    if (weeklyLimitCents < 8000) {
      weeklyLimitCents = MIN_WEEKLY_LIMIT_CENTS;
    }
  }

  // Piso absoluto geral de sobrevivência
  weeklyLimitCents = Math.max(MIN_WEEKLY_LIMIT_CENTS, weeklyLimitCents);

  if (weeklyLimitOverrideCents && weeklyLimitOverrideCents > 0) {
    weeklyLimitCents = weeklyLimitOverrideCents;
  }

  // Identificar transações variáveis da semana atual (últimos 7 dias)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const weeklySpentCents = currentMonthTransactions
    .filter(t => {
      const tDate = parseLocalDate(t.date);
      // Apenas despesas que não são recorrentes (gastos variáveis de sobrevivência)
      return t.transaction_type === "EXPENSE" &&
        !t.source_metadata?.recurring_id &&
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
  confirmedIncomeCents: number;
  scheduledIncomeCents: number;
  scheduledExpensesCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  budgets: Budget[];
  netLiquidityCents: number;
  monthOffset?: number;
  activeSimulations?: Simulation[];
  futureTransactions?: Transaction[];
  allTransactions?: Transaction[];
  recurringTransactions?: RecurringTransaction[];
  goals?: Goal[];
  survivalReserveCents?: number;      // Reserva pessoal para o mês
  startingBalanceOverride?: number;   // Override manual do saldo inicial
}): MonthlyOutlook {
  const {
    accounts,
    confirmedIncomeCents,
    scheduledIncomeCents,
    scheduledExpensesCents,
    recurringIncomeCents,
    recurringExpensesCents,
    budgets,
    netLiquidityCents,
    monthOffset = 0,
    activeSimulations = [],
    futureTransactions = [],
    recurringTransactions = [],
    goals = [],
    allTransactions = [],
    survivalReserveCents = 0
  } = params;

  const now = new Date();
  const targetDate = addMonths(now, monthOffset);

  const liquidity = params.startingBalanceOverride !== undefined 
    ? params.startingBalanceOverride 
    : calculateAccumulatedBalance(accounts);
  const currentMonthDebt = calculateCurrentMonthDebt(accounts);

  const monthKey = format(targetDate, "yyyy-MM");

  // Recalcula recorrentes ativas para o mês projetado de forma a considerar expiração/vencimento
  const effectiveRecurringIncome = recurringTransactions
    .filter(r => 
      r.transaction_type === "INCOME" && 
      r.status === "active" && 
      !isRecurringExpired(r.description, monthKey)
    )
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);

  const effectiveRecurringExpenses = recurringTransactions
    .filter(r => 
      r.transaction_type === "EXPENSE" && 
      r.status === "active" && 
      !isRecurringExpired(r.description, monthKey)
    )
    .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);

  // No mês atual (offset 0), usamos o maior entre o agendado (restante) e o recorrente (planejado)
  // para garantir que o card não zere após o pagamento.
  const monthlyIncome = monthOffset === 0 ? Math.max(scheduledIncomeCents, effectiveRecurringIncome) : effectiveRecurringIncome;
  const baseMonthlyExpenses = monthOffset === 0 ? Math.max(scheduledExpensesCents, effectiveRecurringExpenses) : effectiveRecurringExpenses;

  // No futuro, as reservas são o valor total planejado (pois não há gasto ainda)
  const baseBudgetReserves = budgets.reduce((sum, b) => {
    const reserve = monthOffset === 0
      ? Math.max(0, (b.amount_cents || 0) - (b.spent_cents || 0))
      : (b.amount_cents || 0);
    // Se a reserva atual for 0 mas houver um budget definido, mostramos o planejado para manter o card preenchido
    return sum + (reserve || (b.amount_cents || 0));
  }, 0);

  // Aportes em Metas (Compromisso de poupança mensal ativo - suspenso de forma inteligente se o usuário estiver com liquidez líquida real negativa)
  let goalContributions = 0;
  let budgetReserves = baseBudgetReserves;

  // Parcelas de Cartão para o mês específico (Calculado a partir de futureTransactions + allTransactions)
  // Consolidamos todas as transações para garantir que parcelas com data de compra no mês atual 
  // mas cujo impacto de fatura caia em meses futuros (pós-fechamento) sejam computadas corretamente!
  const uniqueTx = deduplicateTransactions([futureTransactions, allTransactions]);

  const creditCardAccounts = new Set(accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id));

  const installmentDebtTxs = uniqueTx
    .filter(t => {
      const impactDate = getTransactionImpactDate(t, accounts);
      const isCreditCard = t.account_id && creditCardAccounts.has(t.account_id);
      return isCreditCard && 
             (t.transaction_type === "EXPENSE" || t.transaction_type === "INCOME") && 
             isSameMonth(impactDate, targetDate) &&
             !isAdjustmentTransaction(t);
    });
    


  const installmentDebt = installmentDebtTxs
    .reduce((sum, t) => {
      const val = t.amount_cents || 0;
      return t.transaction_type === "INCOME" ? sum - val : sum + val;
    }, 0);

  // Impacto de Simulações
  const simulationExpenseImpact = activeSimulations.reduce((sum, s) => {
    const startOffset = s.startMonthOffset ?? 0;
    // Caso especial: Simulação de Empréstimo (parcelas começam no mês seguinte)
    if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
      if (monthOffset >= startOffset + 1 && monthOffset < startOffset + 1 + s.installments) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        const rate = (s.interestRate && s.interestRate > 0) ? s.interestRate : 9.53;
        return sum + calculateLoanInstallment(s.amount_cents, rate, s.installments);
      }
      return sum;
    }
    // Despesa parcelada normal
    if (s.type === "INCOME") return sum;
    if (monthOffset >= startOffset && monthOffset < startOffset + s.installments) {
      if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
        return sum + s.customInstallmentCents;
      }
      return sum + (s.amount_cents / (s.installments || 1));
    }
    return sum;
  }, 0);

  const simulationIncomeImpact = activeSimulations.reduce((sum, s) => {
    const startOffset = s.startMonthOffset ?? 0;
    // Caso especial: Simulação de Empréstimo
    if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
      if (monthOffset === startOffset) {
        return sum + s.amount_cents; // Injeção total do capital no Mês de início
      }
      return sum;
    }
    // Receita parcelada normal
    if (s.type !== "INCOME") return sum;
    if (monthOffset >= startOffset && monthOffset < startOffset + s.installments) {
      if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
        return sum + s.customInstallmentCents;
      }
      return sum + (s.amount_cents / (s.installments || 1));
    }
    return sum;
  }, 0);

  // No mês atual, incluímos a dívida total de cartão (aberta + fechada)
  // No futuro, a dívida de cartão é o installmentDebt (parcelas futuras)
  const effectiveCardDebt = monthOffset === 0 ? Math.max(currentMonthDebt, installmentDebt) : installmentDebt;

  // LÓGICA DE EVITAR DUPLICIDADE (Mês Atual)
  let adjustedMonthlyIncome = monthlyIncome + simulationIncomeImpact;
  if (monthOffset === 0 && confirmedIncomeCents > 0) {
    const pendingIncomeCents = allTransactions
      .filter((t: any) => t.transaction_type === "INCOME" && !t.is_paid && isSameMonth(parseLocalDate(t.date), new Date()))
      .reduce((sum: number, t: any) => sum + (t.amount_cents || 0), 0);
    adjustedMonthlyIncome = pendingIncomeCents + simulationIncomeImpact;
  }

  const monthlyExpenses = baseMonthlyExpenses; // Restaurado para corrigir o lint

  // Saldo projetado do final do mês
  const creditCardAccountIds = new Set(
    accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id)
  );

  const currentMonthPendingExpenses = monthOffset === 0
    ? allTransactions
      .filter((t: any) => 
        t.transaction_type === "EXPENSE" && 
        !t.is_paid && 
        isSameMonth(parseLocalDate(t.date), new Date()) &&
        !creditCardAccountIds.has(t.account_id)
      )
      .reduce((sum: number, t: any) => sum + (t.amount_cents || 0), 0)
    : 0;

  const realOutflow = (monthOffset === 0 ? (scheduledExpensesCents + currentMonthDebt + currentMonthPendingExpenses) : (recurringExpensesCents + installmentDebt)) +
    (monthOffset === 0 ? (budgets.reduce((sum, b) => sum + Math.max(0, (b.amount_cents || 0) - (b.spent_cents || 0)), 0)) : (budgets.reduce((sum, b) => sum + (b.amount_cents || 0), 0))) +
    simulationExpenseImpact;

  // 1. CÁLCULO DE DÍVIDA TOTAL REMANESCENTE COM AMORTIZAÇÃO (Time Machine)
  const getInstallmentDebtForOffset = (offset: number) => {
    const target = addMonths(now, offset);
    const creditCardAccounts = new Set(accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id));
    return uniqueTx
      .filter(t => {
        const impactDate = getTransactionImpactDate(t, accounts);
        const isCreditCard = t.account_id && creditCardAccounts.has(t.account_id);
        return isCreditCard && isSameMonth(impactDate, target);
      })
      .reduce((sum, t) => {
        const val = Number(t.amount_cents) || 0;
        return t.transaction_type === "INCOME" ? sum - val : sum + val;
      }, 0);
  };

  let projectedTotalDebt = 0;
  let projectedAssets = 0;

  if (monthOffset === 0) {
    projectedTotalDebt = calculateTotalConsolidatedDebt(accounts);
    
    // O Saldo Projetado real para o Mês 0 parte do dinheiro que já temos HOJE (calculateAccumulatedBalance)
    // soma o que AINDA VAI ENTRAR (não pago), e subtrai o que AINDA VAI SAIR (não pago).
    const targetMonthStr = format(now, "yyyy-MM");
    const targetMonth = startOfMonth(now);

    const currentMonthRealizedRecurrings = new Set(
      allTransactions
        .filter((t: any) => isSameMonth(parseLocalDate(t.date), targetMonth) && t.source === "RECURRING" && t.source_metadata?.recurring_id)
        .map((t: any) => t.source_metadata.recurring_id)
    );

    // 1. O que falta cair de receita orgânica
    const pendingFutureIncomes = allTransactions
      .filter(t => isSameMonth(getTransactionImpactDate(t, accounts), targetMonth) && t.transaction_type === "INCOME" && !t.is_paid && isOrganicTransaction(t, accounts))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
      
    const pendingRecurringIncomes = recurringTransactions
      .filter(r => r.status === 'active' && !isRecurringExpired(r.description, targetMonthStr) && r.transaction_type === "INCOME" && !currentMonthRealizedRecurrings.has(r.id) && (!r.next_date || format(parseLocalDate(r.next_date), "yyyy-MM") <= targetMonthStr))
      .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);

    const totalPendingIncomes = pendingFutureIncomes + pendingRecurringIncomes;

    // 2. O que falta pagar de despesa orgânica
    const pendingFutureExpenses = allTransactions
      .filter(t => isSameMonth(getTransactionImpactDate(t, accounts), targetMonth) && t.transaction_type === "EXPENSE" && !t.is_paid && isOrganicTransaction(t, accounts))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const pendingRecurringExpenses = recurringTransactions
      .filter(r => r.status === 'active' && !isRecurringExpired(r.description, targetMonthStr) && r.transaction_type === "EXPENSE" && !currentMonthRealizedRecurrings.has(r.id) && (!r.next_date || format(parseLocalDate(r.next_date), "yyyy-MM") <= targetMonthStr))
      .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);

    const totalPendingExpenses = pendingFutureExpenses + pendingRecurringExpenses;

    // 3. Faturas de cartão do mês que ainda não foram pagas
    const pendingCreditCardBills = currentMonthDebt;

    // Fórmula contábil M0 Base
    projectedAssets = calculateAccumulatedBalance(accounts) + totalPendingIncomes - totalPendingExpenses;
    projectedAssets += simulationIncomeImpact - simulationExpenseImpact;
  } else {
    // 2. CÁLCULO DO SALDO BRUTO E DÍVIDA PROJETADA (Total Assets & Debt)
    // Usa o motor de projeção com o parâmetro currentAssetsCents para eliminar double-counting de cartões.
    const startingAssets = calculateMonthlyOutlook({
      ...params,
      monthOffset: 0
    }).totalAssets;

    const advancedProjection = calculateAdvancedProjection({
      liquidityHealthGuard: netLiquidityCents,
      currentAssetsCents: startingAssets,
      recurringTransactions,
      futureTransactions,
      goals,
      budgets,
      monthOffset,
      activeSimulations,
      allTransactions,
      accounts,
      survivalReserveCents
    });
    
    projectedAssets = advancedProjection.projectedBalance;
    projectedTotalDebt = advancedProjection.projectedTotalDebt;
  }

  // Aportes em Metas (Compromisso de poupança mensal ativo)
  // Base de cálculo para metas deve usar o novo projectedAssets se M0, ou o antigo finalBalanceBeforeGoals se futuro.
  const finalBalanceBeforeGoals = monthOffset === 0 
    ? projectedAssets 
    : liquidity + adjustedMonthlyIncome - realOutflow;

  goalContributions = 0;
  if (netLiquidityCents >= 0 && finalBalanceBeforeGoals >= 0) {
    const activeGoals = goals.filter(g => g.status === "active" || g.status === "ACTIVE");
    const sortedGoals = [...activeGoals].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    let remainingSurplus = finalBalanceBeforeGoals;
    for (const g of sortedGoals) {
      const contribution = Number(g.monthly_contribution_cents) || 0;
      if (remainingSurplus >= contribution) {
        goalContributions += contribution;
        remainingSurplus -= contribution;
      } else {
        break;
      }
    }
  }
  budgetReserves = baseBudgetReserves + goalContributions;

  // No Mês 0, deduzimos as goals diretamente de projectedAssets (já que foi calculado livre disso antes)
  if (monthOffset === 0) {
    projectedAssets -= goalContributions;
  }

  // 3. DETERMINAÇÃO DA LIQUIDEZ FINAL PROJETADA (Patrimônio Líquido)
  const finalLiquidity = projectedAssets - projectedTotalDebt;

  const isCritical = finalLiquidity < 0;
  const isSurvivalMode = isCritical || netLiquidityCents < 0;
  const isCrisisMode = isCritical && netLiquidityCents < 0;

  // Para o card de compromissos: Mostrar o planejado consolidado
  const immediateCardDebt = monthOffset === 0
    ? Math.max(currentMonthDebt, installmentDebt)
    : installmentDebt;

  const upcomingCardDebt = 0;

  return {
    balanceAtMonthEnd: Number(finalLiquidity) || 0,
    plannedExpenses: Number(monthlyExpenses + effectiveCardDebt + budgetReserves + simulationExpenseImpact) || 0,
    immediateCardDebt: Number(immediateCardDebt) || 0,
    upcomingCardDebt: Number(upcomingCardDebt) || 0,
    scheduledOnly: Number(monthlyExpenses) || 0,
    budgetReserves: Number(budgetReserves) || 0,
    isHealthy: finalLiquidity >= 0 && netLiquidityCents >= 0,
    isRecovering: finalLiquidity >= 0 && netLiquidityCents < 0,
    isCritical,
    isCrisisMode,
    isSurvivalMode,
    totalDebt: projectedTotalDebt,
    totalAssets: projectedAssets,
    projectedNetLiquidity: Number(finalLiquidity)
  };
}

/**
 * Motor de Projeção Acumulada Avançada (Time Machine)
 * Calcula o saldo futuro simulando a passagem dos meses.
 */
export function calculateAdvancedProjection(params: {
  liquidityHealthGuard: number;       // Liquidez líquida REAL de hoje usada como guarda para aportes em metas
  currentAssetsCents: number;         // Ativos brutos de hoje (sem deduzir dívidas)
  recurringTransactions: RecurringTransaction[];
  futureTransactions: Transaction[];  // Parcelas futuras de cartão
  goals: Goal[];
  budgets: Budget[];
  monthOffset: number;                // 0 = mês atual, 1 = próximo, etc.
  activeSimulations?: Simulation[];
  allTransactions?: Transaction[];
  accounts?: Account[];
  survivalReserveCents?: number;      // Reserva pessoal para o mês
}): { projectedBalance: number; projectedTotalDebt: number } {
  const {
    liquidityHealthGuard,
    currentAssetsCents,
    recurringTransactions,
    futureTransactions,
    goals,
    budgets,
    monthOffset,
    activeSimulations = [],
    allTransactions = [],
    accounts = [],
    survivalReserveCents = 0
  } = params;

  // Se o offset é 0, retornamos a liquidez real atual (estado presente) - não aplicável ao projectedTotalDebt aqui, 
  // mas o chamador não usa essa função para o mês 0 na nova arquitetura. Se chamar, retornamos o atual.
  if (monthOffset === 0) {
    return {
      projectedBalance: currentAssetsCents,
      projectedTotalDebt: calculateTotalConsolidatedDebt(accounts)
    };
  }

  // Adiciona o impacto de simulações do mês atual (mês 0) no saldo de partida da projeção acumulada
  const simulationExpensesMonth0 = activeSimulations.reduce((sum, s) => {
    const startOffset = s.startMonthOffset ?? 0;
    if (startOffset > 0) return sum; // Se começa no futuro, não afeta o mês 0
    // Caso especial: Simulação de Empréstimo
    if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
      return sum; // Mês 0 de empréstimo não tem despesa/parcela
    }
    if (s.type === "INCOME") return sum;
    return sum + (s.amount_cents / (s.installments || 1));
  }, 0);

  const simulationIncomesMonth0 = activeSimulations.reduce((sum, s) => {
    const startOffset = s.startMonthOffset ?? 0;
    if (startOffset > 0) return sum; // Se começa no futuro, não afeta o mês 0
    // Caso especial: Simulação de Empréstimo
    if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
      return sum + s.amount_cents; // Injeção total de capital do empréstimo no Mês 0
    }
    if (s.type !== "INCOME") return sum;
    return sum + (s.amount_cents / (s.installments || 1));
  }, 0);

  const startBalance = currentAssetsCents;
  // O saldo inicial de partida parte do saldo atual bruto de ativos (sem deduzir compromissos passados quitados).
  const startIncomeAdjustment = simulationIncomesMonth0;
  const startExpenseAdjustment = simulationExpensesMonth0;
  let projectedBalance = startBalance + startIncomeAdjustment - startExpenseAdjustment;
  let projectedTotalDebt = calculateTotalConsolidatedDebt(accounts);

  // Lógica de Amortização do Mês 0: A dívida de cartão projetada para o futuro
  // não pode conter as faturas do mês atual que já estão sendo quitadas no saldo inicial (startBalance).
  // Deduzimos o passivo do mês atual para evitar double-count de dívida na Time Machine.
  // Rollover de crédito por cartão (INCOME excess carrega para o próximo mês do mesmo cartão)
  const cardCreditRollover = new Map<string, number>();

  const currentMonthDebt = accounts.reduce((sum, a) => {
    if (a.type !== "CREDIT_CARD") return sum;
    const currentMonthStr = format(new Date(), "yyyy-MM");
    let debt = 0;
    if (a.closed_invoice_cents && a.closed_invoice_month === currentMonthStr) {
      debt += Math.max(0, Number(a.closed_invoice_cents)); // guarda: nunca negativo
    }
    if (a.open_invoice_cents && a.open_invoice_month === currentMonthStr) {
      debt += Math.max(0, Number(a.open_invoice_cents)); // guarda: nunca negativo
    }
    return sum + debt;
  }, 0);
  
  projectedTotalDebt = Math.max(0, projectedTotalDebt - currentMonthDebt);

  const now = new Date();

  // Iterar mês a mês a partir do próximo mês (i=1) até o offset desejado
  for (let i = 1; i <= monthOffset; i++) {
    const targetDate = addMonths(now, i);
    const monthKey = format(targetDate, 'yyyy-MM');

    const uniqueTxForProjection = deduplicateTransactions([futureTransactions, allTransactions]);
    
    // Evita dupla contagem identificando quais recorrências já têm instância física neste mês (Tabela Base + Exceção)
    const realizedRecurringsThisMonth = new Set(
      uniqueTxForProjection
        .filter(t => t.source === "RECURRING" && t.source_metadata?.recurring_id && isSameMonth(getTransactionImpactDate(t, accounts), targetDate))
        .map(t => t.source_metadata?.recurring_id)
    );

    // Filtra apenas transações não pagas para as despesas e receitas futuras orgânicas
    const unpaidTxForProjection = uniqueTxForProjection.filter(t => !t.is_paid);

    // 1. Receitas e Despesas Recorrentes (excluindo as que já têm transação física no mês)
    const income = recurringTransactions
      .filter(r => 
        r.transaction_type === "INCOME" && 
        r.status === "active" && 
        !isRecurringExpired(r.description, monthKey) &&
        !r.excluded_months?.includes(monthKey) &&
        !realizedRecurringsThisMonth.has(r.id)
      )
      .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);

    const expenses = recurringTransactions
      .filter(r => 
        r.transaction_type === "EXPENSE" && 
        r.status === "active" && 
        !isRecurringExpired(r.description, monthKey) &&
        !r.excluded_months?.includes(monthKey) &&
        !realizedRecurringsThisMonth.has(r.id)
      )
      .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0);

    const creditCardAccounts = new Set(accounts.filter(a => a.type === "CREDIT_CARD").map(a => a.id));

    // A. Parcelamentos de Cartão — cálculo individual por cartão com rollover de crédito
    let ccInstallmentsCashOut = 0;  // Saída real de caixa do mês (nunca negativa)
    let ccDebtAmortization = 0;     // Quanto abater da dívida projetada total no mês

    const creditCardAccountsList = accounts.filter(a => a.type === "CREDIT_CARD");

    for (const cc of creditCardAccountsList) {
      // Soma de todas as transações deste cartão que impactam no mês alvo (apenas não pagas)
      const rawBill = unpaidTxForProjection
        .filter(t =>
          t.account_id === cc.id &&
          isSameMonth(getTransactionImpactDate(t, accounts), targetDate)
        )
        .reduce((sum, t) => {
          const val = Number(t.amount_cents) || 0;
          return t.transaction_type === "INCOME" ? sum - val : sum + val;
        }, 0);

      // Aplicar rollover acumulado deste cartão de meses anteriores no loop
      const rolledCredit = cardCreditRollover.get(cc.id) || 0;
      const effectiveBill = rawBill - rolledCredit; // abate crédito acumulado

      if (effectiveBill > 0) {
        // Há fatura positiva: o usuário paga do caixa e amortiza a dívida
        ccInstallmentsCashOut += effectiveBill;
        ccDebtAmortization += effectiveBill;
        cardCreditRollover.set(cc.id, 0); // crédito consumido
      } else {
        // Fatura negativa ou zero: não há saída de caixa.
        // O excesso de crédito rola para o próximo mês deste cartão.
        // A dívida projetada diminui pelo crédito real (sem exceder a dívida atual deste cartão).
        const creditThisMonth = Math.abs(effectiveBill);
        cardCreditRollover.set(cc.id, creditThisMonth); // acumula para o próximo mês
        // Amortiza a dívida global pelo crédito real recebido (ex: estorno do banco)
        ccDebtAmortization += rawBill < 0 ? Math.abs(rawBill) : 0;
      }
    }

    // B. Despesas Orgânicas Futuras (Pix Agendado, Boletos)
    const organicFutureExpenses = unpaidTxForProjection
      .filter(t => (!t.account_id || !creditCardAccounts.has(t.account_id)) && t.transaction_type === "EXPENSE" && isSameMonth(getTransactionImpactDate(t, accounts), targetDate) && isOrganicTransaction(t, accounts))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    // C. Receitas Orgânicas Futuras (Pix Recebido Agendado)
    const organicFutureIncomes = unpaidTxForProjection
      .filter(t => (!t.account_id || !creditCardAccounts.has(t.account_id)) && t.transaction_type === "INCOME" && isSameMonth(getTransactionImpactDate(t, accounts), targetDate) && isOrganicTransaction(t, accounts))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    // 3. Reservas de Orçamento (Provisão mensal total planejada)
    const budgetReserve = budgets.reduce((sum, b) => sum + (Number(b.amount_cents) || 0), 0);

    // 4. Aportes em Metas (Compromisso de poupança mensal ativo com priorização inteligente)
    let goalContributions = 0;

    // 5. Impacto das Simulações Ativas
    const simulationExpenses = activeSimulations.reduce((sum, s) => {
      const startOffset = s.startMonthOffset ?? 0;
      // Caso especial: Simulação de Empréstimo
      if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
        // As parcelas são pagas nos meses de startOffset + 1 a startOffset + 1 + n - 1
        if (i >= startOffset + 1 && i < startOffset + 1 + s.installments) {
          if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
            return sum + s.customInstallmentCents;
          }
          const rate = (s.interestRate && s.interestRate > 0) ? s.interestRate : 9.53;
          return sum + calculateLoanInstallment(s.amount_cents, rate, s.installments);
        }
        return sum;
      }
      if (s.type === "INCOME") return sum;
      // Condição i < s.installments garante a contabilização correta das parcelas seguintes (meses 1, 2, ...) sem double-count
      if (i >= startOffset && i < startOffset + s.installments) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        return sum + (s.amount_cents / (s.installments || 1));
      }
      return sum;
    }, 0);

    const simulationIncomes = activeSimulations.reduce((sum, s) => {
      const startOffset = s.startMonthOffset ?? 0;
      // Caso especial: Simulação de Empréstimo
      if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
        if (i === startOffset) {
          return sum + s.amount_cents; // Injeção total de capital do empréstimo no mês de contração
        }
        return sum; // Nenhuma renda de empréstimo nos outros meses
      }
      if (s.type !== "INCOME") return sum;
      // Condição i < s.installments garante a contabilização correta das parcelas seguintes (meses 1, 2, ...) sem double-count
      if (i >= startOffset && i < startOffset + s.installments) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        return sum + (s.amount_cents / (s.installments || 1));
      }
      return sum;
    }, 0);

    const totalOutflow = expenses + organicFutureExpenses + ccInstallmentsCashOut + budgetReserve + simulationExpenses;
    const totalIncome = income + organicFutureIncomes + simulationIncomes;

    const availableSurplus = projectedBalance + totalIncome - totalOutflow;
    if (liquidityHealthGuard >= 0 && projectedBalance >= 0 && availableSurplus >= 0) {
      const activeGoals = goals.filter(g => g.status === "active" || g.status === "ACTIVE");
      const sortedGoals = [...activeGoals].sort((a, b) => (a.priority || 999) - (b.priority || 999));
      let remainingSurplus = availableSurplus;
      for (const g of sortedGoals) {
        const contribution = Number(g.monthly_contribution_cents) || 0;
        if (remainingSurplus >= contribution) {
          goalContributions += contribution;
          remainingSurplus -= contribution;
        } else {
          break;
        }
      }
    }

    // Resultado do mês: o que sobra (surplus) ou falta (deficit)
    const monthlyResult = totalIncome - totalOutflow - goalContributions;

    // Acumular no saldo projetado (sem floor em zero)
    projectedBalance += monthlyResult;

    // Amortizar parcelas de cartão de crédito no passivo projetado (aceita negativo para roll-over de faturas pagas a maior)
    projectedTotalDebt = Math.max(0, projectedTotalDebt - ccDebtAmortization);

    // Sweep Automático de Dívida se houver reserva configurada e sobra de saldo
    if (survivalReserveCents > 0 && projectedBalance > survivalReserveCents && projectedTotalDebt > 0) {
      const maxSweep = projectedBalance - survivalReserveCents;
      const sweepApplied = Math.min(maxSweep, projectedTotalDebt);
      projectedBalance -= sweepApplied;
      projectedTotalDebt -= sweepApplied;
    }
  }

  return { projectedBalance, projectedTotalDebt };
}

/**
 * Projeta quando o usuário sairá do ciclo de dívida líquida.
 */
export function calculateDebtExitProjection(params: {
  netLiquidityCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  monthlyInstallmentsCents: number;
  budgets: Budget[];
}): DebtExitProjection {
  const { netLiquidityCents, recurringIncomeCents, recurringExpensesCents, monthlyInstallmentsCents, budgets } = params;

  const budgetTotal = budgets.reduce((sum, b) => sum + (b.amount_cents || 0), 0);
  const monthlySurplus = (recurringIncomeCents || 0) - (recurringExpensesCents || 0) - budgetTotal - (monthlyInstallmentsCents || 0);

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

export const DEFAULT_GOAL_ALLOCATION_RATIO = 0.5;

/**
 * Projeta o cronograma de foco para cada meta.
 */
export function calculateGoalProjections(params: {
  debtExit: DebtExitProjection;
  goals: Goal[];
  goalAllocationRatio?: number;
}): GoalProjection[] {
  const { debtExit, goals, goalAllocationRatio = DEFAULT_GOAL_ALLOCATION_RATIO } = params;
  let currentFocusDate = debtExit.exitDate ? new Date(debtExit.exitDate) : new Date();

  // Ordenar por prioridade (assumindo que já vêm ordenadas ou usando critério padrão)
  const sortedGoals = [...goals].sort((a, b) => (a.priority || 999) - (b.priority || 999));

  return sortedGoals.map((goal) => {
    const remainingCents = (goal.target_amount_cents || 0) - (goal.current_amount_cents || 0);
    const surplusForGoals = (debtExit.monthlySurplus || 0) * goalAllocationRatio;

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

    // Sugerimos alocar a % da sobra se for o foco atual, senão 0
    const recommendedAmountCents = (monthsToStart === 0 && (debtExit.monthsToExit || 0) === 0)
      ? Math.round((debtExit.monthlySurplus || 0) * goalAllocationRatio)
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
  loan_cet_percentage?: number;
  loan_monthly_interest_rate?: number;
  is_debt_swap_advantageous?: boolean;
  loan_verdict_message?: string;
  loan_total_interest_cents?: number;
}

/**
 * Calcula o valor da parcela mensal com base na tabela PRICE (juros compostos).
 */
export function calculateLoanInstallment(amountCents: number, interestRate: number, installments: number): number {
  if (installments <= 1) return amountCents;
  if (interestRate <= 0) return Math.round(amountCents / installments);
  const i = interestRate / 100;
  const n = installments;
  // Fórmula Price: PMT = PV * (i * (1 + i)^n) / ((1 + i)^n - 1)
  const pmt = amountCents * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return Math.round(pmt);
}

/**
 * Rentabilidade implícita mensal de um empréstimo por busca binária.
 */
export function calculateImplicitInterestRate(pv: number, pmt: number, n: number): number {
  if (pv <= 0 || pmt <= 0 || n <= 0) return 0;
  if (pmt * n <= pv) return 0; // Sem juros

  let low = 0.0;
  let high = 5.0; // teto de 500% ao mês
  let rate = 0.0;
  const tolerance = 0.0001;

  for (let iter = 0; iter < 100; iter++) {
    rate = (low + high) / 2;
    if (rate === 0) return 0;
    
    // Fórmula de Valor Presente das parcelas: PV_computed = PMT * (1 - (1 + rate)^(-n)) / rate
    const pvComputed = pmt * (1 - Math.pow(1 + rate, -n)) / rate;
    
    if (Math.abs(pvComputed - pv) < tolerance) {
      break;
    }
    
    if (pvComputed > pv) {
      low = rate;
    } else {
      high = rate;
    }
  }
  
  return rate;
}

/**
 * Simula o impacto de uma compra ou receita (à vista ou parcelada) nas projeções financeiras.
 */
export function simulateDetailedImpact(params: {
  amountCents: number;
  installments: number;
  netLiquidityCents: number;
  monthlySurplus: number;
  currentExitDate: Date | null;
  currentBalanceCents: number;
  type?: "EXPENSE" | "INCOME";
  loanInstallmentCents?: number;
  loanInstallmentsCount?: number;
}): SimulationDetailedResult {
  const { 
    amountCents, 
    installments, 
    netLiquidityCents, 
    monthlySurplus, 
    currentExitDate, 
    currentBalanceCents, 
    type = "EXPENSE",
    loanInstallmentCents = 0,
    loanInstallmentsCount = 0
  } = params;

  const isIncome = type === "INCOME";
  const isInstallment = installments > 1;
  const monthlyImpact = isInstallment ? Math.round(amountCents / installments) : amountCents;

  // Novo saldo de liquidez líquida (aumenta se for receita, reduz se for despesa)
  const newNetLiquidity = isIncome ? netLiquidityCents + amountCents : netLiquidityCents - amountCents;
  const newMonthlySurplus = isIncome
    ? monthlySurplus + (isInstallment ? monthlyImpact : 0)
    : monthlySurplus - (isInstallment ? monthlyImpact : 0);

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
  } else if (isIncome && newNetLiquidity >= 0) {
    // Se a receita quitou a dívida total
    newExitDate = null;
    if (currentExitDate) {
      const currentMonths = Math.ceil(Math.abs(netLiquidityCents) / monthlySurplus);
      debtExitDelay = -currentMonths;
    }
  } else if (!isIncome && newMonthlySurplus <= 0 && newNetLiquidity < 0) {
    newExitDate = null;
    debtExitDelay = 999;
  }

  // Determinar Status
  let status: "SAFE" | "WARNING" | "DANGER" = "SAFE";
  let message = "";

  const impactOnSurplus = monthlySurplus > 0 ? Math.round((monthlyImpact / monthlySurplus) * 100) : 100;

  // Caso especial: Simulação de Empréstimo (INCOME com custos mensais associados)
  const isLoanSimulation = isIncome && loanInstallmentCents > 0 && loanInstallmentsCount > 0;
  
  let loan_cet_percentage: number | undefined;
  let loan_monthly_interest_rate: number | undefined;
  let is_debt_swap_advantageous: boolean | undefined;
  let loan_verdict_message: string | undefined;
  let loan_total_interest_cents: number | undefined;

  if (isLoanSimulation) {
    const monthlyRate = calculateImplicitInterestRate(amountCents, loanInstallmentCents, loanInstallmentsCount);
    const totalCostCents = loanInstallmentCents * loanInstallmentsCount;
    loan_total_interest_cents = totalCostCents - amountCents;
    loan_cet_percentage = Math.round((loan_total_interest_cents / amountCents) * 100);
    loan_monthly_interest_rate = monthlyRate;

    // Veredito da Troca de Dívida (Debt Swap)
    // Compara com a taxa de mercado padrão do rotativo de 12% ao mês (0.12)
    const marketRotaryRate = 0.12;
    const isRateLowerThanRotary = monthlyRate < marketRotaryRate;
    
    // Evita um colapso iminente se a liquidez atual ou projetada for negativa e este empréstimo injetar saldo positivo imediato
    const avoidsLiquidityCollapse = netLiquidityCents < 0 && newNetLiquidity >= 0;

    if (isRateLowerThanRotary) {
      is_debt_swap_advantageous = true;
      status = "SAFE";
      loan_verdict_message = `Veredito: Compensa! Esta troca de dívida reduz seus juros consolidados. Você substitui encargos rotativos de cartão (~12.00% a.m.) por uma taxa menor de ${(monthlyRate * 100).toFixed(2)}% a.m. no empréstimo, aliviando o caixa imediato e economizando juros.`;
    } else if (monthlyRate >= marketRotaryRate) {
      is_debt_swap_advantageous = false;
      status = "DANGER";
      loan_verdict_message = `Veredito: Não Compensa! A taxa implícita de ${(monthlyRate * 100).toFixed(2)}% a.m. deste empréstimo é abusiva (CET de ${loan_cet_percentage}%). Rolar a fatura do cartão ou buscar alternativas de juros menores é financeiramente mais seguro do que assumir este passivo pesado.`;
    } else {
      is_debt_swap_advantageous = false;
      status = "WARNING";
      loan_verdict_message = `Veredito: Risco Moderado. A taxa de ${(monthlyRate * 100).toFixed(2)}% a.m. é competitiva, mas as parcelas de ${formatCurrency(loanInstallmentCents)} comprometerão seu fôlego mensal nos próximos ${loanInstallmentsCount} meses.`;
    }

    message = loan_verdict_message;
  } else if (isIncome) {
    status = "SAFE";
    message = isInstallment
      ? `Excelente! Esta receita parcelada de ${formatCurrency(monthlyImpact)} aumenta em ${impactOnSurplus}% sua sobra mensal.`
      : "Excelente! Esta receita extra fortalece sua liquidez imediata e seus objetivos.";

    if (newNetLiquidity >= 0 && netLiquidityCents < 0) {
      message = "Incrível! Esta receita extra é suficiente para quitar todas as suas faturas pendentes e te colocar de volta no azul hoje mesmo! 🚀";
    } else if (debtExitDelay < 0) {
      const positiveDelay = Math.abs(debtExitDelay);
      message += ` Isso acelerará sua saída das dívidas em ${positiveDelay} ${positiveDelay === 1 ? 'mês' : 'meses'}!`;
    }
  } else {
    // Lógica normal de despesa (EXPENSE)
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
  }

  return {
    status,
    message,
    impact_percentage: impactOnSurplus,
    new_balance_cents: isIncome
      ? currentBalanceCents + (isInstallment ? monthlyImpact : amountCents)
      : currentBalanceCents - (isInstallment ? monthlyImpact : amountCents),
    new_net_liquidity_cents: newNetLiquidity,
    debt_exit_delay_months: isIncome ? (debtExitDelay < 0 ? debtExitDelay : 0) : (debtExitDelay === 999 ? 0 : debtExitDelay),
    new_exit_date: newExitDate,
    installment_impact: monthlyImpact,
    loan_cet_percentage,
    loan_monthly_interest_rate,
    is_debt_swap_advantageous,
    loan_verdict_message,
    loan_total_interest_cents
  };
}

/**
 * Calcula o mix de receitas por categoria nos últimos 30 dias.
 */
export function calculateIncomeMix(transactions: Transaction[], budgets: Budget[]): any[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const incomeTransactions = (transactions || []).filter(tx => 
    tx.transaction_type === "INCOME" && 
    parseLocalDate(tx.date) >= thirtyDaysAgo
  );

  const mixMap: Record<string, number> = {};
  
  incomeTransactions.forEach((tx: Transaction) => {
    const catName = tx.category?.name || "Outros";
    mixMap[catName] = (mixMap[catName] || 0) + (tx.amount_cents / 100);
  });

  return Object.entries(mixMap).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100
  }));
}

/**
 * Calcula o histórico de patrimônio em conta corrente revertendo transações passadas a partir do saldo atual.
 * Nota: Retorna patrimônio em conta corrente (não patrimônio líquido real).
 */
export function calculateCheckingBalanceHistory(accounts: Account[], transactions: Transaction[]): { month: string; netWorth: number }[] {
  const history: any[] = [];
  const now = new Date();
  
  let currentTotalCents = (accounts || []).reduce((sum, acc) => sum + (acc.balance_cents || 0), 0);
  
  for (let i = 0; i < 6; i++) {
    const targetMonth = addMonths(now, -i);
    const monthStr = format(targetMonth, "MMM", { locale: ptBR });
    
    history.unshift({
      month: monthStr,
      amount: Math.round(currentTotalCents / 100)
    });

    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);

    const mTransactions = (transactions || []).filter(tx => {
      const d = parseLocalDate(tx.date);
      return d >= monthStart && d <= monthEnd;
    });

    const netChangeCents = mTransactions.reduce((net, tx) => {
      if (tx.transaction_type === "INCOME") return net + tx.amount_cents;
      if (tx.transaction_type === "EXPENSE") return net - tx.amount_cents;
      return net;
    }, 0);

    currentTotalCents -= netChangeCents;
  }

  return history;
}

function formatCurrency(cents: number) {
  if (isNaN(cents) || cents === null || cents === undefined) {
    return "R$ 0,00";
  }
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Calcula o Tier de Antifragilidade do usuário baseado no saldo líquido real versus despesa fixa.
 * Tier 0: Modo Crise (netLiquidityCents < 0)
 * Tier 1: Sobrevivente (cobertura < 3 meses)
 * Tier 2: Imune (3 <= cobertura < 6 meses)
 * Tier 3: Antifrágil (cobertura >= 6 meses)
 */
export function calculateAntifragilityTier(netLiquidityCents: number, fixedExpensesCents: number): number {
  if (netLiquidityCents < 0) return 0;
  
  const despesaMensal = fixedExpensesCents > 0 ? fixedExpensesCents : 100000;
  const monthsOfCoverage = netLiquidityCents / despesaMensal;

  if (monthsOfCoverage < 3) return 1;
  if (monthsOfCoverage < 6) return 2;
  return 3;
}

import { ptBR } from "date-fns/locale";


export interface CashFlowStatementItem {
  id: string;
  name: string;
  value: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  isInstallment: boolean;
  isBudget: boolean;
  isGoal: boolean;
}

export interface CashFlowStatement {
  monthOffset: number;
  startingBalanceCents: number; // Saldo Inicial (com impactos de ajustes absorvidos)
  organicIncomesCents: number;
  organicExpensesCents: number;
  projectedEndBalanceCents: number; // startingBalance + incomes - expenses
  items: CashFlowStatementItem[];
}

export function isAdjustmentTransaction(t: any): boolean {
  if (!t) return false;
  return t.is_adjustment === true || t.source === "ADJUSTMENT" || t.source === "MIGRATION";
}

export function isCreditCardPurchase(t: any, accounts: Account[]): boolean {
  if (!t || !t.account_id) return false;
  const account = accounts.find((a: any) => a.id === t.account_id);
  return account?.type === "CREDIT_CARD";
}

export function isOrganicTransaction(t: any, accounts: Account[]): boolean {
  if (isAdjustmentTransaction(t)) return false;
  if (isCreditCardPurchase(t, accounts)) return false;
  return true;
}

export function generateCashFlowStatement(params: {
  monthOffset: number;
  currentAssetsCents: number; 
  accounts: Account[];
  liveMonthTransactions: Transaction[]; 
  futureTransactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  activeSimulations: Simulation[];
  targetDate: Date;
  liveAllTransactions: Transaction[];
  startingBalanceOverride?: number;
}): CashFlowStatement {
  const { monthOffset, currentAssetsCents, accounts, liveMonthTransactions, futureTransactions, recurringTransactions, activeSimulations, targetDate, liveAllTransactions, startingBalanceOverride } = params;
  const targetMonthStr = format(targetDate, "yyyy-MM");
  const targetMonth = startOfMonth(targetDate);

  let startingBalanceCents = 0;
  
  if (startingBalanceOverride !== undefined) {
    startingBalanceCents = startingBalanceOverride;
  } else if (monthOffset === 0) {
    // Reconstrução Imutável do Saldo Inicial do mês atual
    const organicPaidIncomes = liveMonthTransactions
      .filter(t => t.transaction_type === "INCOME" && t.is_paid && isOrganicTransaction(t, accounts))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
      
    const organicPaidExpenses = liveMonthTransactions
      .filter(t => t.transaction_type === "EXPENSE" && t.is_paid && isOrganicTransaction(t, accounts))
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    startingBalanceCents = currentAssetsCents - organicPaidIncomes + organicPaidExpenses;
  } else {
    // Para meses futuros, o saldo inicial precisa vir do motor principal de projeção externa (passado no hook)
    startingBalanceCents = currentAssetsCents;
  }

  // Montar base de transações orgânicas projetadas
  const isFuture = monthOffset > 0;
  let rawTransactionsToUse: Transaction[] = [];

  if (!isFuture) {
    rawTransactionsToUse = [...liveMonthTransactions];
  } else {
    // Transações futuras orgânicas
    const filteredFuture = futureTransactions.filter(t => {
      const impactDate = getTransactionImpactDate(t, accounts);
      return isSameMonth(impactDate, targetMonth);
    });
    
    // Transações virtuais recorrentes
    const virtualRecurring = recurringTransactions
      .filter(r => r.status === 'active' && !isRecurringExpired(r.description, targetMonthStr))
      .map(r => ({
        id: `virtual-${r.id}`,
        description: r.description,
        amount_cents: r.amount_cents,
        transaction_type: r.transaction_type,
        date: targetMonth.toISOString(),
        category: r.category_id,
        is_paid: false
      } as unknown as Transaction));
      
    rawTransactionsToUse = [...filteredFuture, ...virtualRecurring];
  }

  // Filtrar apenas orgânicas (ignorar cartões e ajustes)
  const organicTransactions = rawTransactionsToUse.filter(t => isOrganicTransaction(t, accounts));
  
  const baseItems: CashFlowStatementItem[] = organicTransactions.map((t: any) => ({
    id: t.id || Math.random().toString(),
    name: t.description,
    value: Number(t.amount_cents) || 0,
    type: t.transaction_type as "INCOME" | "EXPENSE",
    category: typeof t.category === 'object' ? t.category?.name : (t.category || "Geral"),
    isInstallment: (t as any).installment_total > 1,
    isBudget: (t as any).isBudget || false,
    isGoal: (t as any).isGoal || false
  }));

  // Simulações (apenas afetam fluxo de caixa orgânico, ignoramos customização excessiva aqui ou mapamos de acordo)
  // No mês atual as simulações não estavam em liveMonthTransactions
  const simItems: CashFlowStatementItem[] = [];
  activeSimulations.forEach((s, idx) => {
     const startOffset = s.startMonthOffset ?? 0;
     const installments = s.installments || 1;
     const isLoan = s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME");
     
     if (isLoan) {
        if (monthOffset === startOffset) {
           simItems.push({
             id: `sim-loan-${idx}`,
             name: s.description || "Empréstimo",
             value: s.amount_cents,
             type: "INCOME",
             category: "Simulação",
             isInstallment: false,
             isBudget: false,
             isGoal: false
           });
        }
        if (monthOffset >= startOffset && monthOffset < startOffset + installments) {
           const monthlyValue = s.customInstallmentCents || Math.round((s.amount_cents * (1 + ((s.interestRate||9.53)/100))) / installments); // Simplificado
           simItems.push({
             id: `sim-loan-parcel-${idx}`,
             name: `Parcela: ${s.description || "Empréstimo"}`,
             value: monthlyValue,
             type: "EXPENSE",
             category: "Simulação",
             isInstallment: true,
             isBudget: false,
             isGoal: false
           });
        }
     } else {
        if (monthOffset >= startOffset && monthOffset < startOffset + installments) {
           const monthlyValue = s.customInstallmentCents || Math.round(s.amount_cents / installments);
           simItems.push({
             id: `sim-${idx}`,
             name: s.description || "Simulação",
             value: monthlyValue,
             type: s.type || "EXPENSE",
             category: "Simulação",
             isInstallment: installments > 1,
             isBudget: false,
             isGoal: false
           });
        }
     }
  });

  const allItems = [...baseItems, ...simItems];

  // Adicionar faturas consolidadas de Cartão de Crédito
  const creditCards = accounts.filter(a => a.type === "CREDIT_CARD");
  for (const cc of creditCards) {
    let billAmount = 0;
    if (monthOffset === 0) {
      if (cc.closed_invoice_month === targetMonthStr) billAmount += Number(cc.closed_invoice_cents) || 0;
      if (cc.open_invoice_month === targetMonthStr) billAmount += Number(cc.open_invoice_cents) || 0;
      
      const hasPaidBill = allItems.some(i => i.type === "EXPENSE" && i.name.toLowerCase().includes(cc.name.toLowerCase()) && i.name.toLowerCase().includes("fatura"));
      if (hasPaidBill) billAmount = 0; // Evitar duplicidade do pagamento da fatura
    } else {
      const uniqueTx = deduplicateTransactions([futureTransactions, liveAllTransactions]);
      billAmount = uniqueTx.filter(t => t.account_id === cc.id && isSameMonth(getTransactionImpactDate(t, accounts), targetMonth))
        .reduce((sum, t) => {
          const val = Number(t.amount_cents) || 0;
          return t.transaction_type === "INCOME" ? sum - val : sum + val;
        }, 0);
    }

    if (billAmount > 0) {
      allItems.push({
        id: `bill-${cc.id}`,
        name: `Fatura ${cc.name} (${targetMonthStr})`,
        value: billAmount,
        type: "EXPENSE",
        category: "Cartão de Crédito",
        isInstallment: false,
        isBudget: false,
        isGoal: false
      });
    }
  }

  const organicIncomesCents = allItems.filter(i => i.type === "INCOME").reduce((sum, i) => sum + i.value, 0);
  const organicExpensesCents = allItems.filter(i => i.type === "EXPENSE").reduce((sum, i) => sum + i.value, 0);
  const projectedEndBalanceCents = startingBalanceCents + organicIncomesCents - organicExpensesCents;

  return {
    monthOffset,
    startingBalanceCents,
    organicIncomesCents,
    organicExpensesCents,
    projectedEndBalanceCents,
    items: allItems
  };
}
