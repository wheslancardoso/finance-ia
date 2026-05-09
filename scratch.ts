import { addDays, endOfMonth, isAfter, isBefore, addMonths, isSameMonth, differenceInCalendarMonths, startOfMonth } from "date-fns";

export function getProjectedDetails(
  currentBalance: number,
  targetDate: Date,
  recurringItems: any[] = [],
  budgets: any[] = [],
  accounts: any[] = []
): any {
  let projected = currentBalance;
  const today = new Date();
  const transactions: any[] = [];
  
  if (isBefore(targetDate, today) && !isSameMonth(targetDate, today)) {
    return { totalBalance: currentBalance, transactions: [], budgetSummaries: [] };
  }

  const targetMonthEnd = endOfMonth(targetDate);
  const targetMonthStart = startOfMonth(targetDate);
  const fullMonthsAhead = differenceInCalendarMonths(targetDate, today);

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

      if (isIncome) {
        projected += item.amount_cents;
        if (isTargetMonth) transactions.push({ ...item, date: occurrenceDate });
      } else {
        const isPastSameMonth = isSameMonth(occurrenceDate, today) && isBefore(occurrenceDate, today);
        if (!isPastSameMonth) {
          projected -= item.amount_cents;
        }

        if (isTargetMonth) {
          transactions.push({ ...item, date: occurrenceDate });
        }
      }

      const nextDate = advanceDate(occurrenceDate, item.frequency);
      if (!nextDate || item.frequency === "once") break;
      occurrenceDate = nextDate;
    }
  });

  return {
    totalBalance: projected,
    transactions: transactions
  };
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

const target = new Date("2026-06-15T00:00:00Z");
const items = [
  { id: 1, transaction_type: "EXPENSE", frequency: "once", next_date: "2026-06-10T00:00:00Z", amount_cents: 10000 },
  { id: 2, transaction_type: "EXPENSE", frequency: "monthly", next_date: "2026-04-10T00:00:00Z", amount_cents: 20000 },
];
console.log(getProjectedDetails(0, target, items));
