# Análise do Single Source of Truth (SSOT)

Abaixo estão os arquivos principais que gerenciam a lógica financeira, agregações, fechamento de mês e contexto de dados na aplicação.

## 1. Lógica Pura e Projeções (SSOT Base)
Arquivo: `src/domain/financial/financial-logic.ts`

```typescript
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

export interface Invoice {
  id: string;
  account_id: string;
  reference_month: string;
  amount_cents: number;
  paid_amount_cents: number;
  status: "OPEN" | "CLOSED" | "PAID";
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

export function expandSplits(txs: Transaction[]): Transaction[] {
  return txs.flatMap(tx => {
    if (tx.splits && tx.splits.length > 0) {
      return tx.splits.map((split: any) => ({
        ...tx,
        amount_cents: split.amount_cents,
        category_id: split.category_id,
        category: split.category || { id: split.category_id, name: "Outros", type: tx.transaction_type },
        description: split.description || tx.description,
      } as Transaction));
    }
    return [tx];
  });
}

export function filterIgnoredBalance(txs: Transaction[]): Transaction[] {
  return txs.filter(tx => !tx.category?.ignore_balance);
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
      if (r.excluded_months?.includes(targetMonthKey)) return false;
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
      if (r.excluded_months?.includes(targetMonthKey)) return false;
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
  
  // 1. Base Limit (Estável)
  // Usamos 4.33 como a média de semanas em um mês para garantir um teto semanal estável
  // que não flutua loucamente conforme os dias passam.
  const WEEKS_IN_MONTH = 4.33;

  let baseLimitCents = 0;
  if (netFreeMarginMonthly > 0) {
    baseLimitCents = Math.round(netFreeMarginMonthly / WEEKS_IN_MONTH);
  } else if (effectiveCheckingBalance > 0) {
    baseLimitCents = Math.round(effectiveCheckingBalance / WEEKS_IN_MONTH);
  }

  let weeklyLimitCents = baseLimitCents;

  // 2. Redutor de Abundância Progressiva: Acima de R$ 300,00, apenas 30% do excedente entra no teto
  if (baseLimitCents > 30000) {
    weeklyLimitCents = 30000 + Math.round((baseLimitCents - 30000) * 0.30);
  }

  // 3. Corte Emergencial de Crise: Se em crise ou sobrevivência, cortar 50%
  if (isSurvivalMode) {
    weeklyLimitCents = Math.round(weeklyLimitCents * 0.5);
  }

  // Piso absoluto geral de sobrevivência
  weeklyLimitCents = Math.max(MIN_WEEKLY_LIMIT_CENTS, weeklyLimitCents);

  if (weeklyLimitOverrideCents && weeklyLimitOverrideCents > 0) {
    weeklyLimitCents = weeklyLimitOverrideCents;
  }

  // Identificar transações variáveis da semana atual
  // A semana começa na Segunda-feira (1) e vai até Domingo (7)
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay() || 7; // 1 (Seg) a 7 (Dom)
  startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklySpentCents = currentMonthTransactions
    .filter(t => {
      const tDate = parseLocalDate(t.date);
      // Apenas despesas variáveis orgânicas de sobrevivência
      return t.transaction_type === "EXPENSE" &&
        !t.source_metadata?.recurring_id &&
        !t.category?.ignore_balance &&
        !isAdjustmentTransaction(t) &&
        tDate >= startOfWeek &&
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
  invoices?: Invoice[];               // Faturas reais de cartão de crédito
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
    survivalReserveCents = 0,
    invoices = []
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
    


  // Para meses futuros, usar faturas reais (invoices) como fonte de verdade quando disponíveis.
  // A soma de transações pode divergir da fatura real (juros, estornos parciais, transações INCOME que invertem total).
  const invoiceBasedDebt = monthOffset > 0 
    ? accounts
        .filter(a => a.type === "CREDIT_CARD")
        .reduce((sum, a) => {
          const cardInvoices = invoices.filter(inv => 
            inv.account_id === a.id && 
            inv.reference_month === monthKey &&
            (inv.status === 'OPEN' || inv.status === 'CLOSED')
          );
          return sum + cardInvoices.reduce((s, inv) => s + (Number(inv.amount_cents) || 0), 0);
        }, 0)
    : 0;

  const txBasedDebt = installmentDebtTxs
    .reduce((sum, t) => {
      const val = t.amount_cents || 0;
      return t.transaction_type === "INCOME" ? sum - val : sum + val;
    }, 0);

  // Usar faturas reais quando disponíveis e houver diferença significativa
  const installmentDebt = (monthOffset > 0 && invoiceBasedDebt > 0) 
    ? invoiceBasedDebt 
    : Math.max(0, txBasedDebt);

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
    projectedAssets = calculateAccumulatedBalance(accounts) + totalPendingIncomes - totalPendingExpenses - pendingCreditCardBills;
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
    goalContributions = advancedProjection.finalMonthGoalContributions ?? 0;
  }

  // Aportes em Metas (Compromisso de poupança mensal ativo)
  // Base de cálculo para metas deve usar o novo projectedAssets se M0, ou o antigo finalBalanceBeforeGoals se futuro.
  const finalBalanceBeforeGoals = monthOffset === 0 
    ? projectedAssets 
    : liquidity + adjustedMonthlyIncome - realOutflow;

  if (monthOffset === 0) {
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
  }
  budgetReserves = baseBudgetReserves + goalContributions;

  // No Mês 0, deduzimos as goals diretamente de projectedAssets (já que foi calculado livre disso antes)
  if (monthOffset === 0) {
    projectedAssets -= goalContributions;
  }

  // 3. DETERMINAÇÃO DA LIQUIDEZ FINAL PROJETADA (Patrimônio Líquido vs Fluxo de Caixa)
  // Para o card de compromissos: Mostrar o planejado consolidado
  const immediateCardDebt = monthOffset === 0
    ? Math.max(currentMonthDebt, installmentDebt)
    : installmentDebt;

  const finalLiquidity = monthOffset === 0 
    ? projectedAssets - (projectedTotalDebt - currentMonthDebt) // subtrai apenas a futura
    : projectedAssets - projectedTotalDebt;

  const isCritical = monthOffset === 0 
    ? (projectedAssets < 0) 
    : (finalLiquidity < 0);

  const isSurvivalMode = isCritical || netLiquidityCents < 0;
  const isCrisisMode = isCritical && netLiquidityCents < 0;

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
}): { projectedBalance: number; projectedTotalDebt: number; finalMonthGoalContributions?: number } {
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
      projectedTotalDebt: calculateTotalConsolidatedDebt(accounts),
      finalMonthGoalContributions: 0
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
  let finalMonthGoalContributions = 0;
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
      let effectiveBill = rawBill - rolledCredit; // abate crédito acumulado

      // Garantia de Fatura: Se a soma das transações mapeadas for menor que a fatura real conhecida para este mês, usamos a fatura.
      let invoiceFallback = 0;
      if (cc.closed_invoice_cents && cc.closed_invoice_month === monthKey) {
        invoiceFallback += Math.max(0, Number(cc.closed_invoice_cents));
      }
      if (cc.open_invoice_cents && cc.open_invoice_month === monthKey) {
        invoiceFallback += Math.max(0, Number(cc.open_invoice_cents));
      }
      
      if (invoiceFallback > effectiveBill) {
        effectiveBill = invoiceFallback;
      }

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
    if (i === monthOffset) {
      finalMonthGoalContributions = goalContributions;
    }

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

  return { projectedBalance, projectedTotalDebt, finalMonthGoalContributions };
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

  const incomeTransactions = expandSplits(transactions || [])
    .filter(tx => 
      tx.transaction_type === "INCOME" && 
      !tx.category?.ignore_dashboard &&
      parseLocalDate(tx.date) >= thirtyDaysAgo
    );

  const mixMap: Record<string, number> = {};
  
  incomeTransactions.forEach((tx: Transaction) => {
    const catName = tx.category?.name || "Outros";
    mixMap[catName] = (mixMap[catName] || 0) + ((tx.amount_cents || 0) / 100);
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
export function calculateCheckingBalanceHistory(
  accounts: Account[], 
  transactions: Transaction[], 
  account_snapshots?: import("@/lib/db").AccountSnapshot[]
): { month: string; netWorth: number }[] {
  const history: any[] = [];
  const now = new Date();
  
  let currentTotalCents = (accounts || []).reduce((sum, acc) => sum + (acc.balance_cents || 0), 0);
  
  for (let i = 0; i < 6; i++) {
    const targetMonth = addMonths(now, -i);
    const monthStr = format(targetMonth, "MMM", { locale: ptBR });
    const monthEnd = endOfMonth(targetMonth);
    
    // If we have snapshots, find the closest snapshot to the end of the month
    if (account_snapshots && account_snapshots.length > 0) {
      let monthTotalCents = 0;
      
      for (const acc of accounts || []) {
        if (acc.type === 'CREDIT_CARD') continue;
        
        // Find snapshot for this account
        const accSnaps = account_snapshots.filter(s => s.account_id === acc.id);
        
        // Se targetMonth for o mês atual, apenas usamos o saldo atual
        if (i === 0) {
          monthTotalCents += acc.balance_cents || 0;
          continue;
        }

        // Tenta achar um snapshot com data <= monthEnd, pegando o mais recente
        const validSnaps = accSnaps.filter(s => new Date(s.snapshot_date) <= monthEnd)
                                  .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
        
        if (validSnaps.length > 0) {
          monthTotalCents += validSnaps[0].balance_cents;
        }
      }
      
      history.unshift({
        month: monthStr,
        amount: Math.round(monthTotalCents / 100)
      });
      
    } else {
      // Legacy fallback
      history.unshift({
        month: monthStr,
        amount: Math.round(currentTotalCents / 100)
      });

      const monthStart = startOfMonth(targetMonth);

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
  if (t.is_adjustment === true || t.source === "ADJUSTMENT" || t.source === "MIGRATION") return true;
  
  const desc = (t.description || "").toLowerCase();
  if (
    desc.includes("ajuste de saldo") || 
    desc.includes("reajuste de saldo") || 
    desc.includes("ajuste de fatura") ||
    desc.includes("pgto fatura") ||
    desc.includes("pagamento de fatura") ||
    desc.includes("pagamento da fatura")
  ) {
    return true;
  }
  return false;
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

  // Filtrar apenas orgânicas (ignorar cartões e ajustes) e separar os splits
  const organicTransactions = expandSplits(rawTransactionsToUse)
    .filter(t => isOrganicTransaction(t, accounts))
    .filter(t => !t.category?.ignore_dashboard);
  
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

```

## 2. Agregação do Estado Financeiro (Backend)
Arquivo: `src/app/api/financial-state/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

/**
 * GET /api/financial-state
 * Retorna o estado financeiro completo via RPC get_financial_state_v5.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = user.id;
  const supabase = await createAdminClient();

  try {
    // Fechar automaticamente faturas cuja data de fechamento já passou
    try {
      await supabase.rpc('fn_auto_close_invoices');
    } catch {
      // Se a função não existir ou falhar, segue normalmente
    }

    // Processar transações recorrentes do mês atual
    try {
      await supabase.rpc('fn_process_recurring_transactions');
    } catch {
      // Se a função não existir ou falhar, segue normalmente
    }

    // Tentar usar a função RPC se existir (com retry simples)
    try {
      let rpcResult: any;
      let retries = 0;
      while (retries < 2) {
        rpcResult = await supabase.rpc('get_financial_state_v5', { p_user_id: userId });
        if (!rpcResult.error) break;
        retries++;
        if (retries < 2) await new Promise(r => setTimeout(r, 500));
      }
      const { data, error } = rpcResult;

      if (!error && data) {
        // Enriquecer contas de cartão com dados de fatura retornados na própria RPC
        const enrichedAccounts = (data.accounts || []).map((acc: any) => {
          if (acc.type !== "CREDIT_CARD") return acc;

          const accountInvoices = (data.invoices || []).filter((i: any) => i.account_id === acc.id);
          
          // Ordenar faturas por reference_month de forma crescente (mais antigas primeiro)
          const sortedInvoices = [...accountInvoices].sort((a, b) => 
            (a.reference_month || "").localeCompare(b.reference_month || "")
          );

          const openInvoice = sortedInvoices.find((i: any) => i.status === "OPEN");
          const closedInvoices = sortedInvoices.filter((i: any) => i.status === "CLOSED");

          const openCents = openInvoice ? (Number(openInvoice.amount_cents) || 0) : 0;
          const closedCents = closedInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

          // Dívida Consolidada Pendente Real: soma de todas as faturas abertas (OPEN) e fechadas (CLOSED) pendentes
          const unpaidInvoices = sortedInvoices.filter((i: any) => i.status === "OPEN" || i.status === "CLOSED");
          const unpaidDebtCents = unpaidInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);
          const totalDebt = accountInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

          return {
            ...acc,
            open_invoice_id: openInvoice ? openInvoice.id : null,
            closed_invoice_id: closedInvoices.length > 0 ? closedInvoices[0].id : null,
            open_invoice_cents: openCents,
            closed_invoice_cents: closedCents,
            balance_cents: -totalDebt,
            total_debt_cents: unpaidDebtCents,
            open_invoice_month: openInvoice ? openInvoice.reference_month : null,
            closed_invoice_month: closedInvoices.length > 0 ? closedInvoices[0].reference_month : null
          };
        });

        data.accounts = enrichedAccounts;

        // Garantir que todas as transações recorrentes (incluindo as pausadas) sejam retornadas
        try {
          const { data: dbRecurring, error: recError } = await supabase
            .from('recurring_transactions')
            .select('*')
            .eq('user_id', userId);

          if (!recError && dbRecurring) {
            const catMap = new Map((data.categories || []).map((c: any) => [c.id, c]));
            const accMap = new Map((enrichedAccounts || []).map((a: any) => [a.id, a]));
            
            data.recurring_transactions = dbRecurring.map((rt: any) => ({
              ...rt,
              category: rt.category_id ? catMap.get(rt.category_id) || null : null,
              account: rt.account_id ? accMap.get(rt.account_id) || null : null
            }));
          }
        } catch (err) {
          console.warn("⚠️ Falha ao buscar transações recorrentes pausadas:", err);
        }
        
        // Garantir consistência: Se a RPC retornou family_group mas não user_profile, mapeamos
        if (data.family_group && !data.user_profile) {
          data.user_profile = {
            monthly_income_cents: data.family_group.monthly_income_cents || 0,
            fixed_expenses_cents: data.family_group.fixed_expenses_cents || 0,
            accumulated_balance_cents: (data.accounts || [])
              .filter((a: any) => a.type !== "CREDIT_CARD")
              .reduce((acc: number, a: any) => acc + (Number(a.balance_cents) || 0), 0),
            financial_health_score: data.family_group.financial_health_score || 80,
          };
        }

        return NextResponse.json(data);
      } else {
        console.warn("RPC get_financial_state_v5 failed, using manual build:", error?.message);
      }
    } catch (rpcErr: any) {
      console.warn("Error calling get_financial_state_v5 RPC:", rpcErr.message);
    }

    // Fallback: montar o estado manualmente a partir das tabelas usando Supabase
    const state = await buildFinancialState(userId);
    return NextResponse.json(state);
  } catch (error: any) {
    console.error("GET /api/financial-state failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Constrói o estado financeiro manualmente a partir das tabelas individuais.
 * Serve como fallback caso a RPC não exista ou falhe.
 */
async function buildFinancialState(userId: string) {
  const supabase = await createAdminClient();

  const [
    accountsRes,
    categoriesRes,
    goalsRes,
    recurringRes,
    budgetsRes,
    transactionsRes,
    profileRes,
    invoicesRes,
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('categories').select('*').or(`user_id.eq.${userId},is_system_default.eq.true`).order('name'),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('recurring_transactions').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('budgets').select('*').eq('user_id', userId),
    supabase.from('transactions')
      .select('*, categories(name, type)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('credit_card_invoices').select('*').eq('user_id', userId).order('reference_month', { ascending: true }),
  ]);

  if (accountsRes.error || categoriesRes.error || goalsRes.error) {
    const error = accountsRes.error || categoriesRes.error || goalsRes.error;
    console.error("Database error in buildFinancialState:", error);
    throw new Error(`Database connection failed: ${error?.message}`);
  }

  const accounts = accountsRes.data;
  const categories = categoriesRes.data;
  const goals = goalsRes.data;
  const recurring_transactions = recurringRes.data;
  const budgets = budgetsRes.data;
  const transactionsData = transactionsRes.data;
  const profile = profileRes.data;
  const invoices = invoicesRes.data || [];

  const allTransactions = (transactionsData || []).map((t: any) => ({
    ...t,
    category_name: t.categories?.name,
    category_type: t.categories?.type,
  }));

  // Saldo acumulado (desconsidera contas do tipo CREDIT_CARD)
  const accumulated_balance_cents = (accounts || [])
    .filter((a: any) => a.type !== "CREDIT_CARD")
    .reduce(
      (acc: number, a: any) => acc + (Number(a.balance_cents) || 0),
      0
    );

  const initialAccountMap = new Map((accounts || []).map((a: any) => [a.id, a]));

  // Transações recentes (10) + transações de cartão de crédito não pagas + transações criadas nas últimas 24h para sincronização segura
  const limitDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unpaidOrNewTransactions = allTransactions.filter((t: any) => {
    const acc = initialAccountMap.get(t.account_id);
    const createdDate = new Date(t.created_at);
    const isUnpaidCredit = (acc as any)?.type === "CREDIT_CARD" && !t.is_paid;
    const isNew = createdDate >= limitDate;
    return isUnpaidCredit || isNew;
  });
  
  const recent_transactions = Array.from(
    new Map(
      [...allTransactions.slice(0, 10), ...unpaidOrNewTransactions].map((t: any) => [t.id, t])
    ).values()
  );

  // Transações do mês atual
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const month_transactions = allTransactions.filter((t: any) => {
    const d = new Date(t.date);
    return d >= firstDayOfMonth && d <= lastDayOfMonth;
  });

  // Transações futuras (parcelas de cartão, agendamentos e transações de cartão de crédito não pagas)
  const future_transactions = allTransactions.filter((t: any) => {
    const d = new Date(t.date);
    const acc = initialAccountMap.get(t.account_id);
    const isUnpaidCredit = (acc as any)?.type === "CREDIT_CARD" && !t.is_paid;
    return d > lastDayOfMonth || isUnpaidCredit;
  });

  // Estatísticas do mês
  let income = 0;
  let debit_expense = 0;
  let credit_expense = 0;
  let investments = 0;

  // Faturas foram descontinuadas - Agregação é 100% dinâmica via transações



    // Enriquecer contas de cartão com dados de faturas reais
  const enrichedAccounts = (accounts || []).map((acc: any) => {
    if (acc.type !== "CREDIT_CARD") return acc;

    const accountInvoices = invoices.filter((i: any) => i.account_id === acc.id);
    
    const sortedInvoices = [...accountInvoices].sort((a, b) => 
      (a.reference_month || "").localeCompare(b.reference_month || "")
    );

    const openInvoice = sortedInvoices.find((i: any) => i.status === "OPEN");
    const closedInvoices = sortedInvoices.filter((i: any) => i.status === "CLOSED");

    const openCents = openInvoice ? (Number(openInvoice.amount_cents) || 0) : 0;
    const closedCents = closedInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

    const unpaidInvoices = sortedInvoices.filter((i: any) => i.status === "OPEN" || i.status === "CLOSED");
    const unpaidDebtCents = unpaidInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);
    const totalDebt = accountInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

    return {
      ...acc,
      open_invoice_id: openInvoice ? openInvoice.id : null,
      closed_invoice_id: closedInvoices.length > 0 ? closedInvoices[0].id : null,
      open_invoice_cents: openCents,
      closed_invoice_cents: closedCents,
      balance_cents: -totalDebt,
      total_debt_cents: unpaidDebtCents,
      open_invoice_month: openInvoice ? openInvoice.reference_month : null,
      closed_invoice_month: closedInvoices.length > 0 ? closedInvoices[0].reference_month : null
    };
  });

  const accountMap = new Map(enrichedAccounts.map((a: any) => [a.id, a]));

  month_transactions.forEach((t: any) => {
    const amountCents = Number(t.amount_cents) || 0;
    if (t.transaction_type === "INCOME") income += amountCents;
    if (t.transaction_type === "INVESTMENT") investments += amountCents;
    if (t.transaction_type === "EXPENSE") {
      const acc = accountMap.get(t.account_id);
      if (acc && (acc as any).type === "CREDIT_CARD") {
        credit_expense += amountCents;
      } else {
        debit_expense += amountCents;
      }
    }
  });

  const catMap = new Map((categories || []).map((c: any) => [c.id, c]));
  const accMap = new Map((enrichedAccounts || []).map((a: any) => [a.id, a]));
  const enrichedRecurring = (recurring_transactions || []).map((rt: any) => ({
    ...rt,
    category: rt.category_id ? catMap.get(rt.category_id) || null : null,
    account: rt.account_id ? accMap.get(rt.account_id) || null : null
  }));

  return {
    user_profile: {
      monthly_income_cents: profile?.monthly_income_cents || 0,
      fixed_expenses_cents: profile?.fixed_expenses_cents || 0,
      accumulated_balance_cents,
      financial_health_score: profile?.financial_health_score || 80,
    },
    categories: categories || [],
    accounts: enrichedAccounts,
    invoices: invoices || [],
    goals: goals || [],
    recurring_transactions: enrichedRecurring,
    budgets: budgets || [],
    recent_transactions,
    month_transactions,
    future_transactions,
    month_stats: {
      income,
      debit_expense,
      credit_expense,
      investments,
    },
  };
}


```

## 3. Lógica de Fechamento de Mês (Snapshots)
Arquivo: `src/app/api/month-closing/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

/**
 * GET /api/month-closing?month=YYYY-MM
 * 
 * Retorna o snapshot selado do mês solicitado.
 * Se não existir, executa auto-seal calculando retroativamente.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const month = request.nextUrl.searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Parâmetro 'month' inválido. Formato esperado: YYYY-MM" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Tentar buscar closing existente
    const { data: existing } = await supabase
      .from("month_closings")
      .select("*")
      .eq("user_id", user.id)
      .eq("reference_month", month)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ closing: existing, source: "sealed" });
    }

    // Auto-seal: calcular retroativamente
    const closing = await calculateAndSealMonth(supabase, user.id, month);
    return NextResponse.json({ closing, source: "auto-sealed" });

  } catch (error: any) {
    console.error("GET /api/month-closing failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/month-closing
 * 
 * Permite corrigir/sobrescrever o saldo de um mês já selado.
 * Usado pela tela de Reconciliação quando o usuário informa o saldo real.
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { reference_month, total_balance_cents, seal_method } = body;

    if (!reference_month || !/^\d{4}-\d{2}$/.test(reference_month) || total_balance_cents == null) {
      return NextResponse.json({ error: "Campos obrigatórios inválidos. reference_month deve ser YYYY-MM" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Buscar contas para montar account_balances
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, type, balance_cents")
      .eq("user_id", user.id);

    // Buscar transações do mês para income/expenses
    const [year, monthNum] = reference_month.split("-").map(Number);
    const monthStart = `${reference_month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const monthEnd = `${reference_month}-${String(lastDay).padStart(2, "0")}`;

    const { data: txs } = await supabase
      .from("transactions")
      .select("amount_cents, transaction_type")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    const totalIncome = (txs || [])
      .filter(t => t.transaction_type === "INCOME")
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const totalExpenses = (txs || [])
      .filter(t => t.transaction_type === "EXPENSE")
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    // Dívida de cartão de crédito usando faturas do mês (SSOT fix)
    const creditCardIds = (accounts || [])
      .filter(a => a.type === "CREDIT_CARD")
      .map(a => a.id);

    let totalCreditDebt = 0;
    if (creditCardIds.length > 0) {
      const { data: monthInvoices } = await supabase
        .from("credit_card_invoices")
        .select("amount_cents, status")
        .in("account_id", creditCardIds)
        .eq("reference_month", reference_month)
        .in("status", ["OPEN", "CLOSED"]);

      totalCreditDebt = (monthInvoices || [])
        .reduce((sum, inv) => sum + (Number(inv.amount_cents) || 0), 0);
    }

    const checkingAccounts = (accounts || []).filter(a => a.type !== "CREDIT_CARD");

    // Upsert: se já existe, atualiza; senão, cria
    const { data, error } = await supabase
      .from("month_closings")
      .upsert({
        user_id: user.id,
        reference_month,
        total_balance_cents,
        account_balances: checkingAccounts.map(a => {
          const currentTotal = checkingAccounts.reduce((sum, acc) => sum + (Number(acc.balance_cents) || 0), 0);
          const proportion = currentTotal > 0
            ? (Number(a.balance_cents) || 0) / currentTotal
            : 1 / checkingAccounts.length;
          return {
            account_id: a.id,
            name: a.name,
            balance_cents: Math.round(total_balance_cents * proportion)
          };
        }),
        total_income_cents: totalIncome,
        total_expenses_cents: totalExpenses,
        total_credit_debt_cents: totalCreditDebt,
        sealed_at: new Date().toISOString(),
        seal_method: seal_method || "manual"
      }, { onConflict: "user_id,reference_month" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ closing: data, source: "manual" });

  } catch (error: any) {
    console.error("PUT /api/month-closing failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Calcula retroativamente o estado financeiro de um mês passado
 * e sela na tabela month_closings.
 * 
 * Estratégia:
 * 1. Busca todas as transações do mês-alvo
 * 2. Se for o mês anterior ao atual, usa saldo atual das contas
 *    e reverte as transações do mês atual para derivar o saldo de fim do mês-alvo
 * 3. Se for mais antigo, encadeia com closings existentes ou faz best-effort
 */
async function calculateAndSealMonth(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  month: string
) {
  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  // Buscar contas atuais
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type, balance_cents")
    .eq("user_id", userId);

  // Buscar TODAS as transações desde o início do mês-alvo até hoje
  // para poder reverter o saldo atual
  const { data: txsSinceTarget } = await supabase
    .from("transactions")
    .select("amount_cents, transaction_type, account_id, date, is_paid")
    .eq("user_id", userId)
    .gt("date", monthEnd)
    .eq("is_paid", true)
    .order("date", { ascending: false });

  // Buscar transações DO mês-alvo (para income/expenses)
  const { data: txsInMonth } = await supabase
    .from("transactions")
    .select("amount_cents, transaction_type, account_id, is_paid")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const totalIncome = (txsInMonth || [])
    .filter(t => t.transaction_type === "INCOME")
    .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

  const totalExpenses = (txsInMonth || [])
    .filter(t => t.transaction_type === "EXPENSE")
    .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

  // Saldo atual das contas correntes (não cartão)
  const checkingAccounts = (accounts || []).filter(a => a.type !== "CREDIT_CARD");
  const currentCheckingBalance = checkingAccounts.reduce(
    (sum, a) => sum + (Number(a.balance_cents) || 0), 0
  );

  // Reverter transações pós mês-alvo para derivar saldo de fim do mês-alvo
  // Income após o mês-alvo = dinheiro que entrou DEPOIS → subtrair
  // Expense após o mês-alvo = dinheiro que saiu DEPOIS → somar de volta
  const checkingAccountIds = new Set(checkingAccounts.map(a => a.id));

  let reversedBalance = currentCheckingBalance;
  for (const tx of txsSinceTarget || []) {
    // Só reverter transações de contas correntes (não cartão)
    if (!checkingAccountIds.has(tx.account_id)) continue;

    if (tx.transaction_type === "INCOME") {
      reversedBalance -= Number(tx.amount_cents) || 0;
    } else if (tx.transaction_type === "EXPENSE") {
      reversedBalance += Number(tx.amount_cents) || 0;
    }
  }

  // Dívida de cartão de crédito usando faturas do mês (SSOT fix)
  const creditCardIds = (accounts || [])
    .filter(a => a.type === "CREDIT_CARD")
    .map(a => a.id);

  let totalCreditDebt = 0;
  if (creditCardIds.length > 0) {
    const { data: monthInvoices } = await supabase
      .from("credit_card_invoices")
      .select("amount_cents, status")
      .in("account_id", creditCardIds)
      .eq("reference_month", month)
      .in("status", ["OPEN", "CLOSED"]);

    totalCreditDebt = (monthInvoices || [])
      .reduce((sum, inv) => sum + (Number(inv.amount_cents) || 0), 0);
  }

  // Montar account_balances retroativo (proporcional ao saldo revertido)
  const accountBalances = checkingAccounts.map(a => {
    const proportion = currentCheckingBalance > 0
      ? (Number(a.balance_cents) || 0) / currentCheckingBalance
      : 1 / checkingAccounts.length;
    return {
      account_id: a.id,
      name: a.name,
      balance_cents: Math.round(reversedBalance * proportion)
    };
  });

  // Inserir no banco
  const { data, error } = await supabase
    .from("month_closings")
    .upsert({
      user_id: userId,
      reference_month: month,
      total_balance_cents: reversedBalance,
      account_balances: accountBalances,
      total_income_cents: totalIncome,
      total_expenses_cents: totalExpenses,
      total_credit_debt_cents: totalCreditDebt,
      sealed_at: new Date().toISOString(),
      seal_method: "auto"
    }, { onConflict: "user_id,reference_month" })
    .select()
    .single();

  if (error) {
    console.error("Falha ao auto-selar mês:", error);
    throw new Error(`Falha ao auto-selar mês ${month}: ${error.message}`);
  }

  return data;
}

```

## 4. Contexto Financeiro do Frontend
Arquivo: `src/context/FinancialDataContext.tsx`

```typescript
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { financialService } from "@/services/financialService";
import { db, type Account, type Category, type Goal, type RecurringTransaction, type Budget, type FinancialHealthScore, type Transaction, type AccountSnapshot } from "@/lib/db";
import { useAccountModal } from "./AccountModalContext";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  calculateTotalConsolidatedDebt, 
  calculateNetLiquidity,
  calculateScheduledIncome,
  calculateScheduledExpenses,
  calculateRecurringIncome,
  calculateRecurringExpenses,
  calculatePrimaryIncome,
  deduplicateTransactions,
  calculateIncomeMix,
  calculateCheckingBalanceHistory
} from "@/domain/financial/financial-logic";

export interface CreditCardInvoice {
  id: string;
  account_id: string;
  reference_month: string;
  amount_cents: number;
  paid_amount_cents: number;
  status: "OPEN" | "CLOSED" | "PAID";
  closing_date: string;
  due_date: string;
}

interface FinancialStateResponse {
  user_profile: {
    monthly_income_cents: number;
    fixed_expenses_cents: number;
    accumulated_balance_cents: number;
    financial_health_score: number;
    gamification_enabled?: boolean;
  };
  categories: Category[];
  accounts: Account[];
  account_snapshots?: AccountSnapshot[];
  invoices?: CreditCardInvoice[];
  goals: Goal[];
  recurring_transactions: RecurringTransaction[];
  budgets: Budget[];
  recent_transactions: Transaction[];
  month_transactions: Transaction[];
  future_transactions: Transaction[];
  month_stats: {
    income: number;
    debit_expense: number;
    credit_expense: number;
    investments: number;
  };
}

export interface IncomeMixItem {
  name: string;
  value: number;
}

export interface NetWorthHistoryItem {
  month: string;
  amount: number;
}

interface GoalRecommendation {
  goal_id: string;
  goal_name: string;
  recommended_amount_cents: number;
  is_full_target: boolean;
  advice: string;
}

interface GoalRecommendationsResponse {
  surplus_cents: number;
  real_surplus_cents: number;
  recommendations: GoalRecommendation[];
}

interface SimulationResult {
  current_surplus_cents: number;
  simulated_surplus_cents: number;
  status: "SAFE" | "WARNING" | "DANGER";
  message: string;
  impact_percentage: number;
}

interface FinancialDataContextType {
  categories: Category[];
  accounts: Account[];
  invoices: CreditCardInvoice[];
  loading: boolean;
  refreshData: () => Promise<void>;
  lastFetched: number | null;
  monthlyIncomeCents: number;
  setMonthlyIncomeCents: (val: number) => void;
  fixedExpensesCents: number;
  setFixedExpensesCents: (val: number) => void;
  survivalReserveCents: number;
  setSurvivalReserveCents: (val: number) => void;
  weeklyLimitOverrideCents: number;
  setWeeklyLimitOverrideCents: (val: number) => void;
  
  extraIncomeCents: number;
  currentMonthExpensesCents: number;
  accumulatedBalanceCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  goals: Goal[];
  recurringTransactions: RecurringTransaction[];
  budgets: Budget[];
  recentTransactions: Transaction[];
  monthTransactions: Transaction[];
  futureTransactions: Transaction[];
  allTransactions: Transaction[];
  transactions: Transaction[];
  healthScore: number;
  scheduledIncomeCents: number;
  scheduledExpensesCents: number;
  cardDebtImpactCents: number;
  totalConsolidatedDebtCents: number;
  netLiquidityCents: number;
  toggleTransactionPaid: (id: string, status: boolean) => Promise<void>;
  upsertTransaction: (data: Partial<Transaction>) => Promise<any>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactionSeries: (description: string, total: number, accId: string) => Promise<void>;
  updateTransactionSeries: (description: string, total: number, accId: string, updates: Partial<Transaction>) => Promise<void>;
  createInstallmentSeries: (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
    starting_installment?: number;
    is_third_party?: boolean;
    third_party_name?: string | null;
  }) => Promise<void>;
  upsertAccount: (data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  upsertGoal: (data: Partial<Goal> & { status?: string }) => Promise<any>;
  updateGoalBalance: (id: string, amount: number) => Promise<void>;
  getGoalRecommendations: () => Promise<GoalRecommendationsResponse>;
  getIncomeMix: () => IncomeMixItem[];
  getNetWorthHistory: () => NetWorthHistoryItem[];
  createTransfer: (fromId: string, toId: string, amountCents: number) => Promise<void>;
  skipRecurringOccurrence: (recurringId: string, monthKey: string) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  payRecurringOccurrence: (recurringId: string) => Promise<void>;
  primaryIncomeCents: number;
  userId: string | null;
  isGamificationEnabled: boolean;
  setGamificationEnabled: (val: boolean) => void;
}

export const FinancialDataContext = createContext<FinancialDataContextType | undefined>(undefined);

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos de cache

export function FinancialDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<CreditCardInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  
  const [monthlyIncomeCents, setMonthlyIncomeCentsState] = useState(0);
  const [fixedExpensesCents, setFixedExpensesCentsState] = useState(0);
  const [survivalReserveCents, setSurvivalReserveCentsState] = useState(0);
  const [weeklyLimitOverrideCents, setWeeklyLimitOverrideCentsState] = useState(0);
  const [extraIncomeCents, setExtraIncomeCents] = useState(0);
  const [currentMonthExpensesCents, setCurrentMonthExpensesCents] = useState(0);
  const [accumulatedBalanceCents, setAccumulatedBalanceCents] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [futureTransactions, setFutureTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accountSnapshots, setAccountSnapshots] = useState<AccountSnapshot[]>([]);
  const [healthScore, setHealthScore] = useState<number>(0);

  const { userId: rawUserId } = useAccountModal();
  const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;
  const userId = rawUserId || (isE2E ? "e2e-user" : null);

  const totalConsolidatedDebtCents = useMemo(() => {
    return calculateTotalConsolidatedDebt(accounts);
  }, [accounts]);

  const netLiquidityCents = useMemo(() => {
    return calculateNetLiquidity(accounts);
  }, [accounts]);

  const scheduledIncomeCents = useMemo(() => {
    return calculateScheduledIncome(recurringTransactions);
  }, [recurringTransactions]);

  const scheduledExpensesCents = useMemo(() => {
    return calculateScheduledExpenses(recurringTransactions);
  }, [recurringTransactions]);

  const recurringIncomeCents = useMemo(() => {
    return calculateRecurringIncome(recurringTransactions);
  }, [recurringTransactions]);

  const recurringExpensesCents = useMemo(() => {
    return calculateRecurringExpenses(recurringTransactions);
  }, [recurringTransactions]);

  const primaryIncomeCents = useMemo(() => {
    return calculatePrimaryIncome(recurringTransactions);
  }, [recurringTransactions]);

  const cardDebtImpactCents = useMemo(() => {
    return calculateTotalConsolidatedDebt(accounts);
  }, [accounts]);

  const setMonthlyIncomeCents = useCallback((val: number) => {
    setMonthlyIncomeCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_monthly_income", val.toString());
    }
  }, []);

  const setFixedExpensesCents = useCallback((val: number) => {
    setFixedExpensesCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_fixed_expenses", val.toString());
    }
  }, []);

  const setSurvivalReserveCents = useCallback((val: number) => {
    setSurvivalReserveCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_survival_reserve", val.toString());
    }
  }, []);

  const setWeeklyLimitOverrideCents = useCallback((val: number) => {
    setWeeklyLimitOverrideCentsState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_weekly_limit_override", val.toString());
    }
  }, []);

  const [isGamificationEnabled, setIsGamificationEnabledState] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vesper_gamification_enabled");
      if (saved !== null) {
        setIsGamificationEnabledState(saved === "true");
      }
    }
  }, []);

  const setGamificationEnabled = useCallback((val: boolean) => {
    setIsGamificationEnabledState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("vesper_gamification_enabled", val ? "true" : "false");
    }
    if (userId) {
      financialService.upsertUserProfile({
        id: userId,
        gamification_enabled: val
      });
    }
  }, [userId]);


  const _applyState = (data: any) => {
    const recurring = data.recurring_transactions || [];
    const accounts = data.accounts || [];

    setAccounts(accounts);
    setInvoices(data.invoices || []);
    setCategories(data.categories || []);
    setGoals(data.goals || []);
    setRecurringTransactions(recurring);
    setBudgets(data.budgets || []);
    setAccountSnapshots(data.account_snapshots || []);
    setRecentTransactions([...(data.recent_transactions || data.transactions || [])]);
    setMonthTransactions([...(data.month_transactions || data.transactions || [])]);
    setFutureTransactions([...(data.future_transactions || [])]);
    
    const allTx = [
      ...(data.recent_transactions || data.transactions || []),
      ...(data.month_transactions || []),
      ...(data.future_transactions || [])
    ];
    const uniqueTx = deduplicateTransactions([allTx]);
    setAllTransactions(uniqueTx);
    
    if (data.user_profile) {
      setMonthlyIncomeCentsState(data.user_profile.monthly_income_cents || 0);
      setFixedExpensesCentsState(data.user_profile.fixed_expenses_cents || 0);
      setHealthScore(data.user_profile.financial_health_score || 0);
      setAccumulatedBalanceCents(data.user_profile.accumulated_balance_cents || 0);
      if (data.user_profile.gamification_enabled !== undefined) {
        setIsGamificationEnabledState(data.user_profile.gamification_enabled);
        if (typeof window !== "undefined") {
          localStorage.setItem("vesper_gamification_enabled", data.user_profile.gamification_enabled ? "true" : "false");
        }
      }
    }
  };

  const refreshData = useCallback(async (force = false) => {
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;

    if (!userId && !isE2E) {
      setLoading(false);
      // Limpar estados ao deslogar
      setAccounts([]);
      setInvoices([]);
      setCategories([]);
      setGoals([]);
      setRecurringTransactions([]);
      setBudgets([]);
      setRecentTransactions([]);
      setMonthTransactions([]);
      setAccumulatedBalanceCents(0);
      setHealthScore(0);
      return;
    }

    try {
      setLoading(true);
      if (isInitialLoading) setIsInitialLoading(false);
      
      const { data, error } = await financialService.getFinancialState(userId!);

      if (error) throw error;

      if (!data) {
        setLoading(false);
        return;
      }

      const state = data as FinancialStateResponse;

      // 1. Aplicar estado centralizado (calcula agendados, recorrentes, etc)
      _applyState(state);

      // 2. Métricas adicionais que dependem do state mas não estão no _applyState (ex: stats mensais)
      setExtraIncomeCents(Number(state.month_stats?.income || 0));
      setCurrentMonthExpensesCents(Number(state.month_stats?.debit_expense || 0));

      // 3. Sincronizar Cache de Longo Prazo (localStorage)
      if (typeof window !== "undefined" && state.user_profile) {
        localStorage.setItem("vesper_monthly_income", (state.user_profile.monthly_income_cents || 0).toString());
        localStorage.setItem("vesper_fixed_expenses", (state.user_profile.fixed_expenses_cents || 0).toString());
        localStorage.setItem("vesper_accumulated_balance", (state.user_profile.accumulated_balance_cents || 0).toString());
        localStorage.setItem("vesper_health_score", (state.user_profile.financial_health_score || 0).toString());
      }

      // 5. Sincronizar com Banco de Dados Local (Dexie)
      // Aguardamos a sincronização para garantir que navegações subsequentes encontrem os dados
      await Promise.all([
        db.categories.where('user_id').equals(userId!).delete().then(() => 
          db.categories.bulkPut(state.categories.map(c => ({ ...c, user_id: userId! })))
        ),
        db.accounts.where('user_id').equals(userId!).delete().then(() => 
          db.accounts.bulkPut(state.accounts.map(a => ({ ...a, user_id: userId! })))
        ),
        state.goals ? db.goals.where('user_id').equals(userId!).delete().then(() => 
          db.goals.bulkPut(state.goals.map(g => ({ ...g, user_id: userId! })))
        ) : Promise.resolve(),
        state.account_snapshots ? db.account_snapshots.clear().then(() => 
          db.account_snapshots.bulkPut(state.account_snapshots!)
        ) : Promise.resolve(),
        state.recurring_transactions ? db.recurring_transactions.where('user_id').equals(userId!).delete().then(() => 
          db.recurring_transactions.bulkPut(state.recurring_transactions.map(r => ({ ...r, user_id: userId! })))
        ) : Promise.resolve(),
        state.budgets ? db.budgets.where('user_id').equals(userId!).delete().then(() => 
          db.budgets.bulkPut(state.budgets.map(b => ({ ...b, user_id: userId! })))
        ) : Promise.resolve(),
        // Transações: preservar pendentes de sincronização offline antes de apagar
        (async () => {
          const pendingTx = await db.transactions
            .where('user_id').equals(userId!)
            .filter(t => (t as any).sync_status === 'pending')
            .toArray();

          await db.transactions.where('user_id').equals(userId!).delete();

          const allTx = [
            ...(state.recent_transactions || []), 
            ...(state.month_transactions || []),
            ...(state.future_transactions || [])
          ];
          const uniqueTx = deduplicateTransactions([allTx]);
          await db.transactions.bulkPut(uniqueTx.map(t => ({ ...t, user_id: userId! })));

          // Re-inserir transações pendentes de sincronização que foram salvas offline
          if (pendingTx.length > 0) {
            await db.transactions.bulkPut(pendingTx);
            console.log(`🔄 ${pendingTx.length} transação(ões) offline preservada(s) durante sync.`);
          }
        })()
      ]).catch(err => console.error("⚠️ Falha na sincronização Dexie:", err));

      setLastFetched(Date.now());
    } catch (error: any) {
      console.error("❌ ERRO AO BUSCAR ESTADO FINANCEIRO, TENTANDO FALLBACK OFFLINE:", error);
      
      // Fallback offline via Dexie e localStorage
      const cachedTx = await db.transactions.where('user_id').equals(userId || '').toArray();
      const cachedAccounts = await db.accounts.where('user_id').equals(userId || '').toArray();
      const cachedRecurring = await db.recurring_transactions.where('user_id').equals(userId || '').toArray();
      const cachedGoals = await db.goals.where('user_id').equals(userId || '').toArray();

      if (cachedAccounts.length > 0) setAccounts(cachedAccounts);
      if (cachedTx.length > 0) {
        setAllTransactions(cachedTx);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setMonthTransactions(cachedTx.filter(t => {
          if (!t.date) return false;
          const tDate = new Date(t.date.split('T')[0] + 'T00:00:00');
          return tDate >= startOfMonth && tDate <= now;
        }));
        setRecentTransactions(cachedTx.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 10));
      }
      if (cachedRecurring.length > 0) setRecurringTransactions(cachedRecurring);
      if (cachedGoals.length > 0) setGoals(cachedGoals);

      // Usar localStorage como último recurso para acumular score e saldos se o fallback não funcionar 100%
      const lsScore = localStorage.getItem('vesper_health_score');
      if (lsScore) setHealthScore(Number(lsScore));

    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getGoalRecommendations = async (): Promise<GoalRecommendationsResponse> => {
    if (!userId) return { surplus_cents: 0, real_surplus_cents: 0, recommendations: [] };
    const { data, error } = await financialService.getGoalRecommendations(userId);
    if (error || !data) return { surplus_cents: 0, real_surplus_cents: 0, recommendations: [] };
    return data as GoalRecommendationsResponse;
  };

  const getIncomeMix = useCallback((): IncomeMixItem[] => {
    return calculateIncomeMix(monthTransactions, budgets);
  }, [monthTransactions, budgets]);

  const getNetWorthHistory = useCallback((): NetWorthHistoryItem[] => {
    return calculateCheckingBalanceHistory(accounts, allTransactions, accountSnapshots).map(item => ({
      month: item.month,
      amount: item.netWorth
    }));
  }, [accounts, allTransactions]);

  const createTransfer = async (fromId: string, toId: string, amountCents: number) => {
    if (!userId) return;
    const { error } = await financialService.createTransfer({
      user_id: userId,
      from_account_id: fromId,
      to_account_id: toId,
      amount_cents: amountCents
    });
    await refreshData();
  };

  const upsertTransaction = useCallback(async (data: Partial<Transaction>) => {
    if (!userId) return;
    setLoading(true);
    const res = await financialService.upsertTransaction({ ...data, user_id: userId });
    await refreshData();
    setLoading(false);
    return res;
  }, [userId, refreshData]);

  const skipRecurringOccurrence = useCallback(async (recurringId: string, monthKey: string) => {
    setLoading(true);
    await financialService.skipRecurringOccurrence(recurringId, monthKey);
    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const deleteRecurringTransaction = useCallback(async (id: string) => {
    setLoading(true);
    await financialService.deleteRecurringTransaction(id);
    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const payRecurringOccurrence = useCallback(async (recurringId: string) => {
    setLoading(true);
    await financialService.payRecurringOccurrence(recurringId);
    await refreshData();
    setLoading(false);
  }, [refreshData]);

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await financialService.deleteTransaction(id);
    await refreshData();
  }, [refreshData]);

  const deleteTransactionSeries = useCallback(async (description: string, total: number, accId: string) => {
    const { error } = await financialService.deleteTransactionSeries(description, total, accId);
    await refreshData();
  }, [refreshData]);

  const updateTransactionSeries = useCallback(async (description: string, total: number, accId: string, updates: any) => {
    const { error } = await financialService.updateTransactionSeries(description, total, accId, updates);
    await refreshData();
  }, [refreshData]);

  const createInstallmentSeries = useCallback(async (data: {
    description: string;
    amount_total_cents: number;
    installments: number;
    account_id: string;
    category_id?: string | null;
    start_date: string;
    starting_installment?: number;
    is_third_party?: boolean;
    third_party_name?: string | null;
  }) => {
    if (!userId) return;
    await financialService.createInstallmentSeries({
      ...data,
      user_id: userId
    });
    await refreshData();
  }, [userId, refreshData]);

  const upsertAccount = useCallback(async (data: Partial<Account>) => {
    if (!userId) return;
    await financialService.upsertAccount({
      ...data,
      user_id: userId
    });
    await refreshData();
  }, [userId, refreshData]);

  const deleteAccount = useCallback(async (id: string) => {
    await financialService.deleteAccount(id);
    await refreshData();
  }, [refreshData]);

  const upsertGoal = useCallback(async (data: Partial<Goal> & { status?: string }) => {
    if (!userId) return;
    const res = await financialService.upsertGoal({
      ...data,
      user_id: userId
    });
    await refreshData();
    return res;
  }, [userId, refreshData]);

  const updateGoalBalance = useCallback(async (id: string, amount: number) => {
    await financialService.updateGoalBalance(id, amount);
    await refreshData();
  }, [refreshData]);

  const toggleTransactionPaid = useCallback(async (transactionId: string, currentStatus: boolean) => {
    await financialService.toggleTransactionPaid(transactionId, currentStatus);
    await refreshData();
  }, [refreshData]);

  // 1. Carregar preferências do LocalStorage (Apenas uma vez no mount)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedIncome = localStorage.getItem("vesper_monthly_income");
        if (storedIncome) setMonthlyIncomeCentsState(parseInt(storedIncome, 10));
        
        const storedExpenses = localStorage.getItem("vesper_fixed_expenses");
        if (storedExpenses) setFixedExpensesCentsState(parseInt(storedExpenses, 10));
        
        const storedAccumulated = localStorage.getItem("vesper_accumulated_balance");
        if (storedAccumulated) setAccumulatedBalanceCents(parseInt(storedAccumulated, 10));

        const storedReserve = localStorage.getItem("vesper_survival_reserve");
        if (storedReserve) setSurvivalReserveCentsState(parseInt(storedReserve, 10));

        const storedWeeklyLimit = localStorage.getItem("vesper_weekly_limit_override");
        if (storedWeeklyLimit) setWeeklyLimitOverrideCentsState(parseInt(storedWeeklyLimit, 10));
      } catch (err) {
        console.error("ERRO AO CARREGAR LOCALSTORAGE:", err);
      }
    }
  }, []);

  // 2. Carregar dados locais do IndexedDB (Quando o usuário muda)
  useEffect(() => {
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;
    
    const loadLocalData = async () => {
      if (!userId || isE2E) {
        setLoading(false);
        setIsInitialLoading(false);
        return;
      }

      // Evitar recarregar se já carregamos para este usuário nesta instância
      if (loadedUserIdRef.current === userId) {
        return;
      }
      
      try {
        const localAccounts = await db.accounts.where('user_id').equals(userId).toArray();
        const localCategories = await db.categories.where('user_id').equals(userId).toArray();
        const localGoals = await db.goals.where('user_id').equals(userId).toArray();
        const localRecurring = await db.recurring_transactions.where('user_id').equals(userId).toArray();
        const localBudgets = await db.budgets.where('user_id').equals(userId).toArray();
        const localSnapshots = await db.account_snapshots.toArray();

        // Só atualizamos se houver dados para evitar loops se o estado inicial for igual
        if (localAccounts.length > 0) setAccounts(localAccounts as Account[]);
        if (localCategories.length > 0) setCategories(localCategories as Category[]);
        if (localGoals.length > 0) setGoals(localGoals as Goal[]);
        if (localRecurring.length > 0) setRecurringTransactions(localRecurring as RecurringTransaction[]);
        if (localBudgets.length > 0) setBudgets(localBudgets as Budget[]);
        if (localSnapshots.length > 0) setAccountSnapshots(localSnapshots as AccountSnapshot[]);
        
        loadedUserIdRef.current = userId;
      } catch (err) {
        console.error("ERRO AO CARREGAR DADOS LOCAIS (DEXIE):", err);
      } finally {
        setLoading(false);
        setIsInitialLoading(false);
      }
    };

    loadLocalData();
  }, [userId]);

  useEffect(() => {
    const handleOnline = async () => {
      console.log("🌐 Conexão restaurada! Sincronizando transações offline...");
      try {
        const pendingTx = await db.transactions
          .filter(t => (t as any).sync_status === 'pending')
          .toArray();

        if (pendingTx.length > 0) {
          console.log(`Encontradas ${pendingTx.length} transações pendentes de sincronização.`);
          for (const tx of pendingTx) {
            const payload = { ...tx };
            delete (payload as any).sync_status;
            
            const response = await fetch("/api/transactions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });
            
            if (response.ok) {
              const saved = await response.json();
              await db.transactions.put({ ...tx, ...saved, sync_status: undefined });
              console.log(`✅ Transação offline ${tx.id} sincronizada com sucesso!`);
            }
          }
          refreshData();
        }
      } catch (err) {
        console.error("Erro ao sincronizar transações offline:", err);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener('online', handleOnline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [refreshData]);

  useEffect(() => {
    const isE2E = typeof window !== 'undefined' && (window as any).__E2E_MOCK_STATE__;
    
    if (userId || isE2E) {
      const now = Date.now();
      const isExpired = !lastFetched || (now - lastFetched > CACHE_DURATION);
      
      if (isExpired) {
        refreshData();
      }
    }
  }, [userId, lastFetched, refreshData]);

  const contextValue = useMemo(() => ({ 
    categories, accounts, invoices, loading, refreshData, lastFetched,
    monthlyIncomeCents, setMonthlyIncomeCents,
    fixedExpensesCents, setFixedExpensesCents,
    survivalReserveCents, setSurvivalReserveCents,
    weeklyLimitOverrideCents, setWeeklyLimitOverrideCents,
    extraIncomeCents, currentMonthExpensesCents, accumulatedBalanceCents,
    recurringIncomeCents, recurringExpensesCents,
    goals,
    recurringTransactions,
    budgets,
    recentTransactions,
    monthTransactions,
    futureTransactions,
    allTransactions,
    transactions: monthTransactions,
    getIncomeMix,
    getNetWorthHistory,
    createTransfer,
    skipRecurringOccurrence,
    deleteRecurringTransaction,
    payRecurringOccurrence,
    upsertTransaction,
    primaryIncomeCents,
    deleteTransaction,
    deleteTransactionSeries,
    updateTransactionSeries,
    upsertAccount,
    deleteAccount,
    upsertGoal,
    updateGoalBalance,
    healthScore,
    scheduledIncomeCents,
    scheduledExpensesCents,
    cardDebtImpactCents,
    totalConsolidatedDebtCents,
    netLiquidityCents,
    createInstallmentSeries,
    getGoalRecommendations,
    toggleTransactionPaid,
    userId,
    isGamificationEnabled,
    setGamificationEnabled
  }), [
    categories, accounts, invoices, loading, refreshData, lastFetched,
    monthlyIncomeCents, setMonthlyIncomeCents,
    fixedExpensesCents, setFixedExpensesCents,
    survivalReserveCents, setSurvivalReserveCents,
    weeklyLimitOverrideCents, setWeeklyLimitOverrideCents,
    extraIncomeCents, currentMonthExpensesCents, accumulatedBalanceCents,
    recurringIncomeCents, recurringExpensesCents,
    goals,
    recurringTransactions,
    budgets,
    recentTransactions,
    monthTransactions,
    futureTransactions,
    allTransactions,
    getIncomeMix,
    getNetWorthHistory,
    createTransfer,
    skipRecurringOccurrence,
    deleteRecurringTransaction,
    payRecurringOccurrence,
    upsertTransaction,
    primaryIncomeCents,
    deleteTransaction,
    deleteTransactionSeries,
    updateTransactionSeries,
    upsertAccount,
    deleteAccount,
    upsertGoal,
    updateGoalBalance,
    healthScore,
    scheduledIncomeCents,
    scheduledExpensesCents,
    cardDebtImpactCents,
    totalConsolidatedDebtCents,
    netLiquidityCents,
    createInstallmentSeries,
    getGoalRecommendations,
    toggleTransactionPaid,
    userId,
    isGamificationEnabled,
    setGamificationEnabled
  ]);

  return (
    <FinancialDataContext.Provider value={contextValue}>
      {children}
    </FinancialDataContext.Provider>
  );
}

export function useFinancialData() {
  const context = useContext(FinancialDataContext);
  if (context === undefined) {
    throw new Error("useFinancialData must be used within a FinancialDataProvider");
  }
  return context;
}

```

## 5. Hook de Análise Financeira e Teto de Sobrevivência
Arquivo: `src/hooks/useFinancialAnalysis.ts`

```typescript

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
      return overrides && overrides[monthKey] !== undefined ? overrides[monthKey] : calculated;
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
      netLiquidityCents: netLiquidity,
      recurringIncomeCents,
      recurringExpensesCents,
      monthlyInstallmentsCents: monthlyOutlook.immediateCardDebt,
      budgets
    });
  }, [netLiquidity, recurringIncomeCents, recurringExpensesCents, monthlyOutlook.immediateCardDebt, budgets]);

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
  }), [activeNetLiquidity, activeDebt, activeAssets, currentAssets, creditCardUsed, monthlyOutlook, cashFlowStatement, healthScore, recurringIncomeCents, recurringExpensesCents, debtExit, weeklySurvival, goalProjections, simulateDetailedImpactFn, analyzeSimulationIA, solveFinancialDilemma, optimizeSweepIA, consultJarvisIA]);
}
```

## 6. Derivações Visuais (Resumo Consolidado) no Dashboard
Arquivo: `src/components/RealtimeDashboard.tsx` (Trecho de lógica)

```tsx
  const consolidatedItems = useMemo(() => {
    const transactionsToUse = isFuture ? projectionTransactions : displayTransactions;
    
    // Deduplicar transações físicas/projetadas por recurring_id para evitar double-counting
    const seenRecurringIds = new Set<string>();
    const deduplicatedTransactions = transactionsToUse.filter((t: any) => {
      const recId = t.source_metadata?.recurring_id || t.source_metadata?.['recurring_id'];
      if (recId) {
        if (seenRecurringIds.has(recId)) return false;
        seenRecurringIds.add(recId);
      }
      return true;
    });

    const items: any[] = [];
    const targetMonth = startOfMonth(targetDate);
    const targetMonthStr = format(targetMonth, "yyyy-MM");

    // Agrupar por contas (Corrente/Poupança e Cartão de Crédito)
    liveAccounts.forEach(a => {
      if (a.type === "CREDIT_CARD") {
        let billAmount = 0;
        
        if (monthOffset === 0) {
          if (a.closed_invoice_month === targetMonthStr) billAmount += Number(a.closed_invoice_cents) || 0;
          if (a.open_invoice_month === targetMonthStr) billAmount += Number(a.open_invoice_cents) || 0;
        } else {
          // Para meses passados ou futuros, tenta buscar a fatura real
          const cardInvoices = (liveInvoices || []).filter(inv => 
            inv.account_id === a.id && 
            inv.reference_month === targetMonthStr &&
            (inv.status === 'OPEN' || inv.status === 'CLOSED' || inv.status === 'PAID')
          );
          
          if (cardInvoices.length > 0) {
            billAmount = cardInvoices.reduce((sum, inv) => sum + (Number(inv.amount_cents) || 0), 0);
          } else if (!isPast || !monthClosing) {
            // Fallback: somar transações com impactDate (faturas futuras ou antigas não seladas)
            const consolidatedTx = isFuture 
              ? [...(futureTransactions || []), ...(liveAllTransactions || [])]
              : deduplicatedTransactions;
              
            const uniqueTx = Array.from(new Map(consolidatedTx.map(t => [t.id, t])).values());
            billAmount = uniqueTx
              .filter(t => {
                if ((t as any).account_id !== a.id) return false;
                const impactDate = getTransactionImpactDate(t as any, liveAccounts);
                return t.transaction_type === "EXPENSE" && isSameMonth(impactDate, targetMonth);
              })
              .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
          }
        }
        
        if (billAmount > 0) {
          items.push({
            name: `Fatura ${a.name}`,
            value: billAmount,
            type: "EXPENSE" as const,
            category: "Cartão de Crédito",
            isInstallment: false,
            isBudget: false,
            isGoal: false
          });
        }
      } else {
        // Contas Correntes/Poupança
        const accTxs = deduplicatedTransactions.filter(t => (t as any).account_id === a.id);
        
        const accIncome = accTxs
          .filter(t => t.transaction_type === "INCOME")
          .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);
          
        const accExpense = accTxs
          .filter(t => t.transaction_type === "EXPENSE")
          .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

        if (accIncome > 0) {
          items.push({
            name: `Entradas ${a.name}`,
            value: accIncome,
            type: "INCOME" as const,
            category: "Conta Bancária",
            isInstallment: false,
            isBudget: false,
            isGoal: false
          });
        }
        if (accExpense > 0) {
          items.push({
            name: `Saídas ${a.name}`,
            value: accExpense,
            type: "EXPENSE" as const,
            category: "Conta Bancária",
            isInstallment: false,
            isBudget: false,
            isGoal: false
          });
        }
      }
    });

```
