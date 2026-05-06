import { addDays, differenceInMonths, startOfMonth, endOfMonth, isAfter, isBefore, addMonths } from "date-fns";

interface RecurringItem {
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  next_date: string | Date;
}

interface Budget {
  amount_cents: number;
  spent_this_month: number;
}

/**
 * Calcula o saldo projetado em uma data futura.
 * @param currentBalance Saldo atual em centavos
 * @param targetDate Data para a projeção
 * @param recurringItems Lista de transações recorrentes
 * @param budgets Lista de orçamentos (para considerar o que ainda planeja gastar no mês atual)
 */
export function calculateProjectedBalance(
  currentBalance: number,
  targetDate: Date,
  recurringItems: RecurringItem[],
  budgets: Budget[] = []
): number {
  let projected = currentBalance;
  const today = new Date();
  
  if (isBefore(targetDate, today)) return currentBalance;

  // 1. Considerar o "Restante do Orçamento" para o mês atual
  // Se o usuário planejou gastar 1000 e gastou 400, projetamos que ele ainda gastará 600.
  const remainingBudgets = budgets.reduce((acc, budget) => {
    const remaining = Math.max(0, budget.amount_cents - budget.spent_this_month);
    return acc + remaining;
  }, 0);
  
  projected -= remainingBudgets;

  // 2. Projetar itens recorrentes
  recurringItems.forEach((item) => {
    let occurrenceDate = new Date(item.next_date);
    
    // Simular ocorrências até a data alvo
    while (isBefore(occurrenceDate, targetDate) || occurrenceDate.getTime() === targetDate.getTime()) {
      if (item.transaction_type === "INCOME") {
        projected += item.amount_cents;
      } else {
        projected -= item.amount_cents;
      }

      // Avançar para a próxima ocorrência baseada na frequência
      if (item.frequency === "monthly") {
        occurrenceDate = addMonths(occurrenceDate, 1);
      } else if (item.frequency === "weekly") {
        occurrenceDate = addDays(occurrenceDate, 7);
      } else if (item.frequency === "daily") {
        occurrenceDate = addDays(occurrenceDate, 1);
      } else if (item.frequency === "yearly") {
        occurrenceDate = addMonths(occurrenceDate, 12);
      } else if (item.frequency === "once") {
        // Se for uma transação única, processamos uma vez e paramos
        break;
      } else {
        break; // Evitar loop infinito se a frequência for desconhecida
      }
    }
  });

  return projected;
}
