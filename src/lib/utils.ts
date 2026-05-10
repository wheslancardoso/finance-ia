import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number) {
  if (isNaN(cents) || cents === null || cents === undefined) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function getTransactionInvoiceMonth(dateStr: string, closingDay: number | null) {
  const date = new Date(dateStr);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // Regra central: se o dia for >= ao fechamento, cai no próximo mês
  const cDay = closingDay || 31;
  if (day >= cDay) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  
  return { year, month };
}
