import { addDays, endOfMonth, isAfter, isBefore, addMonths, isSameMonth, differenceInCalendarMonths } from "date-fns";

interface RecurringItem {
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "once";
  next_date: string | Date;
}

interface Budget {
  amount_cents: number;
  spent_this_month: number;
}

/**
 * Calcula o saldo projetado em uma data futura.
 * @param currentBalance Saldo inicial (pode ser liquidez ou patrimônio líquido)
 * @param targetDate Data para a projeção
 * @param recurringItems Lista de transações recorrentes e parcelas futuras
 * @param budgets Lista de orçamentos configurados
 */
export function calculateProjectedBalance(
  currentBalance: number,
  targetDate: Date,
  recurringItems: RecurringItem[] = [],
  budgets: Budget[] = []
): number {
  let projected = currentBalance;
  const today = new Date();
  
  if (isBefore(targetDate, today) && !isSameMonth(targetDate, today)) {
    return currentBalance;
  }

  // 1. Calcular meses completos à frente para aplicar orçamentos cheios
  const fullMonthsAhead = differenceInCalendarMonths(targetDate, today);

  // 2. Considerar o "Restante do Orçamento" para o mês atual
  const remainingBudgetsThisMonth = budgets.reduce((acc, budget) => {
    const remaining = Math.max(0, budget.amount_cents - budget.spent_this_month);
    return acc + remaining;
  }, 0);
  
  projected -= remainingBudgetsThisMonth;

  // 3. Considerar "Orçamento Total" para meses futuros cheios
  // Se estamos em Janeiro e projetamos para Março, subtraímos o orçamento TOTAL de Fevereiro.
  // E também o orçamento TOTAL de Março (assumindo que será gasto até o fim do mês alvo).
  if (fullMonthsAhead > 0) {
    const totalMonthlyBudget = budgets.reduce((acc, budget) => acc + budget.amount_cents, 0);
    projected -= (totalMonthlyBudget * fullMonthsAhead);
  }

  // 4. Projetar itens recorrentes (Salários, Contas Fixas, Parcelas)
  const endOfThisMonth = endOfMonth(today);

  recurringItems.forEach((item) => {
    let occurrenceDate = new Date(item.next_date);
    
    // Simular ocorrências até a data alvo
    // Usamos o fim do mês alvo se a data alvo for o primeiro dia do mês (navegação por meses)
    const effectiveTargetDate = endOfMonth(targetDate);

    while (isBefore(occurrenceDate, effectiveTargetDate) || isSameMonth(occurrenceDate, effectiveTargetDate)) {
      // Evitar processar datas no passado que já estão no saldo atual
      if (isBefore(occurrenceDate, today) && !isSameMonth(occurrenceDate, today)) {
        occurrenceDate = advanceDate(occurrenceDate, item.frequency);
        if (!occurrenceDate) break;
        continue;
      }

      const isIncome = item.transaction_type === "INCOME";
      const isFutureMonth = isAfter(occurrenceDate, endOfThisMonth);

      // Regra de Ouro:
      // - Receitas são SEMPRE somadas (mesmo este mês, se ainda não caíram).
      // - Despesas só são subtraídas se forem de meses FUTUROS, 
      //   pois o mês atual já está coberto pelo remainingBudgets.
      if (isIncome) {
        projected += item.amount_cents;
      } else if (isFutureMonth) {
        projected -= item.amount_cents;
      }

      // Avançar para a próxima ocorrência
      const nextDate = advanceDate(occurrenceDate, item.frequency);
      if (!nextDate || item.frequency === "once") break;
      occurrenceDate = nextDate;
    }
  });

  return projected;
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
