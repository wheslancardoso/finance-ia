import { addDays, endOfMonth, isAfter, isBefore, addMonths, isSameMonth, differenceInCalendarMonths, startOfMonth } from "date-fns";

interface RecurringItem {
  id?: string;
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "once";
  next_date: string | Date;
  description?: string;
  category?: string;
  account_id?: string;
}

interface Budget {
  amount_cents: number;
  spent_this_month: number;
  category?: string;
}

export interface ProjectedTransaction {
  id: string;
  description: string;
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  date: Date;
  category?: string;
  isRecurring: boolean;
  accountName?: string;
  accountType?: string;
}

export interface ProjectedDetails {
  totalBalance: number;
  transactions: ProjectedTransaction[];
  budgetSummaries: {
    category: string;
    allocated: number;
    projected: number;
  }[];
}

/**
 * Calcula o saldo projetado e o detalhamento em uma data futura.
 * @param currentBalance Saldo inicial (pode ser liquidez ou patrimônio líquido)
 * @param targetDate Data para a projeção
 * @param recurringItems Lista de transações recorrentes e parcelas futuras
 * @param budgets Lista de orçamentos configurados
 */
export function getProjectedDetails(
  currentBalance: number,
  targetDate: Date,
  recurringItems: RecurringItem[] = [],
  budgets: Budget[] = [],
  accounts: any[] = []
): ProjectedDetails {
  let projected = currentBalance;
  const today = new Date();
  const transactions: ProjectedTransaction[] = [];
  
  // Se for o mês atual, não há "detalhes projetados" da mesma forma
  if (isBefore(targetDate, today) && !isSameMonth(targetDate, today)) {
    return { totalBalance: currentBalance, transactions: [], budgetSummaries: [] };
  }

  const targetMonthEnd = endOfMonth(targetDate);
  const targetMonthStart = startOfMonth(targetDate);
  const fullMonthsAhead = differenceInCalendarMonths(targetDate, today);

  // 1. Orçamentos do mês atual
  const remainingBudgetsThisMonth = budgets.reduce((acc, budget, index) => {
    const remaining = Math.max(0, budget.amount_cents - budget.spent_this_month);
    if (remaining > 0 && isSameMonth(targetDate, today)) {
      transactions.push({
        id: `budget-now-${budget.category || 'general'}-${index}`,
        description: `Reserva: ${budget.category || 'Orçamento'}`,
        amount_cents: remaining,
        transaction_type: "EXPENSE",
        date: targetMonthEnd,
        category: budget.category,
        isRecurring: false
      });
    }
    return acc + remaining;
  }, 0);
  
  projected -= remainingBudgetsThisMonth;

  // 2. Orçamentos de meses futuros
  if (fullMonthsAhead > 0) {
    budgets.forEach((budget, index) => {
      const totalFutureBudget = budget.amount_cents * fullMonthsAhead;
      projected -= totalFutureBudget;
      
      // Adicionar entrada para o mês alvo especificamente se estivermos olhando para ele
      transactions.push({
        id: `budget-future-${budget.category || 'general'}-${index}`,
        description: `Provisionado: ${budget.category || 'Orçamento'}`,
        amount_cents: budget.amount_cents,
        transaction_type: "EXPENSE",
        date: targetMonthEnd,
        category: budget.category,
        isRecurring: false
      });
    });
  }

  // 3. Itens recorrentes
  const endOfThisMonth = endOfMonth(today);

  recurringItems.forEach((item) => {
    let occurrenceDate = new Date(item.next_date);
    const effectiveTargetDate = endOfMonth(targetDate);

    while (isBefore(occurrenceDate, effectiveTargetDate) || isSameMonth(occurrenceDate, effectiveTargetDate)) {
      if (isBefore(occurrenceDate, today) && !isSameMonth(occurrenceDate, today)) {
        const next = advanceDate(occurrenceDate, item.frequency);
        if (!next) break;
        occurrenceDate = next;
        continue;
      }

      const isIncome = item.transaction_type === "INCOME";
      const isFutureMonth = isAfter(occurrenceDate, endOfThisMonth);
      const isTargetMonth = isSameMonth(occurrenceDate, targetDate);

      const account = accounts.find(a => a.id === item.account_id);
      const accountName = account?.name;
      const accountType = account?.type;

      if (isIncome) {
        projected += item.amount_cents;
        if (isTargetMonth) {
          transactions.push({
            id: `recurring-${item.id || Math.random()}-${occurrenceDate.getTime()}`,
            description: item.description || item.category || "Receita Fixa",
            amount_cents: item.amount_cents,
            transaction_type: "INCOME",
            date: occurrenceDate,
            category: item.category,
            isRecurring: true,
            accountName,
            accountType
          });
        }
      } else {
        // Subtrair do saldo se for hoje ou futuro
        const isPastSameMonth = isSameMonth(occurrenceDate, today) && isBefore(occurrenceDate, today);
        
        // Se não for passado (ou seja, hoje ou futuro), subtraímos do saldo projetado
        if (!isPastSameMonth) {
          projected -= item.amount_cents;
        }

        if (isTargetMonth) {
          transactions.push({
            id: `recurring-${item.id || Math.random()}-${occurrenceDate.getTime()}`,
            description: item.description || item.category || "Despesa Fixa",
            amount_cents: item.amount_cents,
            transaction_type: "EXPENSE",
            date: occurrenceDate,
            category: item.category,
            isRecurring: true,
            accountName,
            accountType
          });
        }
      }

      const nextDate = advanceDate(occurrenceDate, item.frequency);
      if (!nextDate || item.frequency === "once") break;
      occurrenceDate = nextDate;
    }
  });

  return {
    totalBalance: projected,
    transactions: transactions.sort((a, b) => a.date.getTime() - b.date.getTime()),
    budgetSummaries: budgets.map(b => ({
      category: b.category || 'Outros',
      allocated: b.amount_cents,
      projected: b.amount_cents
    }))
  };
}

export function calculateProjectedBalance(
  currentBalance: number,
  targetDate: Date,
  recurringItems: RecurringItem[] = [],
  budgets: Budget[] = []
): number {
  return getProjectedDetails(currentBalance, targetDate, recurringItems, budgets).totalBalance;
}

function advanceDate(date: Date, frequency: string): Date | null {
  switch (frequency) {
    case "monthly": return addMonths(date, 1);
    case "weekly": return addDays(date, 7);
    case "daily": return addDays(date, 1);
    case "yearly": return addMonths(date, 12);
    default: return null;
  }
}
