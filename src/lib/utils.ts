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
  let year: number, month: number, day: number;

  // Extração exata para ignorar Timezones e evitar UTC Shifts 
  // ex: '2026-06-07T23:00:00-03:00' -> dia 7.
  if (typeof dateStr === "string" && dateStr.includes("-")) {
    const localDateStr = dateStr.split("T")[0];
    const parts = localDateStr.split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // 0-indexed JS Date compatibility
    day = parseInt(parts[2], 10);
  } else {
    // Fallback para outros formatos
    const date = new Date(dateStr);
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
  }
  
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
