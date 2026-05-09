import { addDays, endOfMonth, isAfter, isBefore, addMonths, isSameMonth, differenceInCalendarMonths, startOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Account {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
  closed_invoice_cents?: number;
  closed_invoice_month?: string;
  open_invoice_cents?: number;
  open_invoice_month?: string;
  due_day?: number;
}

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
  accounts: Account[] = [],
  fixedExpensesCents: number = 0
): ProjectedDetails {
  let projected = currentBalance;
  const today = new Date();
  const transactions: ProjectedTransaction[] = [];

  // 0. Contabilizar Faturas de Cartão (Latência de Pagamento)
  accounts.forEach(acc => {
    if (acc.type === "CREDIT_CARD") {
      // Fatura Fechada (O que já fechou e precisa ser pago)
      // Se fechou no mês atual ou anterior, o vencimento é geralmente no mês atual ou seguinte
      if ((acc.closed_invoice_cents || 0) > 0) {
        const dueDate = new Date(today.getFullYear(), today.getMonth(), acc.due_day || 10);
        
        // Se a data de vencimento for no mês alvo, adicionamos à lista de transações
        if (isSameMonth(targetDate, dueDate)) {
          transactions.push({
            id: `card-closed-${acc.id}`,
            description: `Fatura ${acc.name} (${acc.closed_invoice_month || 'Ant'})`,
            amount_cents: acc.closed_invoice_cents || 0,
            transaction_type: "EXPENSE",
            date: dueDate,
            isRecurring: false,
            accountName: acc.name,
            accountType: "CREDIT_CARD"
          });
        }
        
        // Sempre subtraímos do saldo projetado se for uma dívida pendente
        projected -= (acc.closed_invoice_cents || 0);
      }

      // Fatura Aberta (O que está sendo gasto agora e vencerá no próximo ciclo)
      if ((acc.open_invoice_cents || 0) > 0) {
        // A fatura aberta sempre vence no ciclo seguinte ao fechamento atual
        const nextMonth = addMonths(today, 1);
        const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), acc.due_day || 10);
        
        if (isSameMonth(targetDate, dueDate)) {
          transactions.push({
            id: `card-open-${acc.id}`,
            description: `Fatura ${acc.name} (${acc.open_invoice_month || 'Atu'})`,
            amount_cents: acc.open_invoice_cents || 0,
            transaction_type: "EXPENSE",
            date: dueDate,
            isRecurring: false,
            accountName: acc.name,
            accountType: "CREDIT_CARD"
          });
        }

        projected -= (acc.open_invoice_cents || 0);
      }
    }
  });
  
  // Se for o mês atual, não há "detalhes projetados" da mesma forma
  if (isBefore(targetDate, today) && !isSameMonth(targetDate, today)) {
    return { totalBalance: currentBalance, transactions: [], budgetSummaries: [] };
  }

  const targetMonthEnd = endOfMonth(targetDate);
  const targetMonthStart = startOfMonth(targetDate);
  const fullMonthsAhead = differenceInCalendarMonths(targetDate, today);

  // 1. Contabilizar Despesas Fixas Manuais (Survival HUD)
  // Se houver despesas fixas manuais, elas ocorrem todo mês.
  if (fixedExpensesCents > 0) {
    // Para cada mês até o alvo (incluindo o atual)
    for (let i = 0; i <= fullMonthsAhead; i++) {
      const monthDate = addMonths(today, i);
      projected -= fixedExpensesCents;
      
      if (isSameMonth(monthDate, targetDate)) {
        transactions.push({
          id: `manual-fixed-${i}`,
          description: "Despesas Fixas (Manual)",
          amount_cents: fixedExpensesCents,
          transaction_type: "EXPENSE",
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), // Dia 1 como padrão
          isRecurring: true,
          accountName: "Geral",
          accountType: "CASH"
        });
      }
    }
  }

  // 1. Orçamentos do mês atual
  const remainingBudgetsThisMonth = budgets.reduce((acc, budget) => {
    const remaining = Math.max(0, budget.amount_cents - budget.spent_this_month);
    if (remaining > 0 && isSameMonth(targetDate, today)) {
      transactions.push({
        id: `budget-now-${budget.category || 'general'}`,
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
    budgets.forEach(budget => {
      const totalFutureBudget = budget.amount_cents * fullMonthsAhead;
      projected -= totalFutureBudget;
      
      // Adicionar entrada para o mês alvo especificamente se estivermos olhando para ele
      transactions.push({
        id: `budget-future-${budget.category || 'general'}`,
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
      // Pular se for no passado (antes de hoje e não no mesmo mês)
      if (isBefore(occurrenceDate, today) && !isSameMonth(occurrenceDate, today)) {
        const next = advanceDate(occurrenceDate, item.frequency);
        if (!next) break;
        occurrenceDate = next;
        continue;
      }

      const isIncome = item.transaction_type === "INCOME";
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
        // Lógica para Despesas
        
        // Evitar redundância com faturas de cartão:
        // Se a transação é no cartão e é para este mês ou o próximo, 
        // ela já pode estar incluída em closed_invoice ou open_invoice.
        // Padrão: Se for no cartão, não subtraímos do saldo aqui pois as faturas já foram subtraídas no passo 0.
        // Apenas mostramos na lista se for o mês alvo para transparência.
        
        const isPastSameMonth = isSameMonth(occurrenceDate, today) && isBefore(occurrenceDate, today);
        
        if (accountType === "CREDIT_CARD") {
          // No cartão, o impacto no saldo é via pagamento da fatura.
          // Se for uma transação recorrente futura (além da fatura aberta atual), 
          // ela impactará faturas futuras que ainda não foram somadas.
          
          const nextInvoicePayDate = addMonths(today, 1);
          const isBeyondOpenInvoice = isAfter(occurrenceDate, endOfMonth(nextInvoicePayDate));
          
          if (isBeyondOpenInvoice) {
            projected -= item.amount_cents;
          }
        } else {
          // Se for débito/dinheiro, subtrai normalmente se não for passado
          if (!isPastSameMonth) {
            projected -= item.amount_cents;
          }
        }

        if (isTargetMonth) {
          transactions.push({
            id: `recurring-${item.id || Math.random()}-${occurrenceDate.getTime()}`,
            description: item.description || item.category || "Despesa",
            amount_cents: item.amount_cents,
            transaction_type: "EXPENSE",
            date: occurrenceDate,
            category: item.category,
            isRecurring: true,
            accountName: accountName || "Conta Corrente",
            accountType: accountType || "CHECKING"
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
