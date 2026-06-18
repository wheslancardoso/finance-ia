import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Account, Budget, Goal, RecurringTransaction, Transaction } from "@/lib/db";
import {
  calculateMonthlyOutlook,
  calculateRecurringIncome,
  calculateRecurringExpenses,
  calculateLoanInstallment,
  Simulation
} from "./financial-logic";

export interface MonthSnapshot {
  monthKey: string;          // Formato "yyyy-MM"
  monthLabel: string;        // Formato "julho de 2026"
  monthOffset: number;       // Offset em relação ao mês atual (0 a 5)
  projectedBalance: number;  // Saldo final projetado (em centavos)
  recurringIncome: number;   // Total de receitas recorrentes no mês (em centavos)
  recurringExpenses: number; // Total de despesas recorrentes no mês (em centavos)
  installmentExpenses: number; // Parcelamento total incidindo no cartão (em centavos)
  simulationImpact: number;  // Impacto líquido de simulações ativas no mês (em centavos)
  isCrisis: boolean;         // Indicador se o mês está em crise ou situação crítica
}

export interface HorizonSnapshot {
  currentMonth: MonthSnapshot;
  futureMonths: MonthSnapshot[];
  totalProjectedDebt: number;  // Dívida total remanescente no final do período de 6 meses
  debtExitMonth: string | null; // Mês projetado para saída da crise/dívida
  criticalMonths: string[];    // Lista de meses que estão em situação crítica
}

export interface BuildHorizonSnapshotParams {
  accounts: Account[];
  scheduledIncomeCents: number;
  scheduledExpensesCents: number;
  recurringIncomeCents: number;
  recurringExpensesCents: number;
  budgets: Budget[];
  netLiquidityCents: number;
  activeSimulations?: Simulation[];
  futureTransactions?: Transaction[];
  allTransactions?: Transaction[];
  recurringTransactions?: RecurringTransaction[];
  goals?: Goal[];
  survivalReserveCents?: number;
}

/**
 * Constrói um instantâneo (snapshot) completo de 6 meses do horizonte financeiro do usuário.
 * Esta é uma função pura e testável que serve como motor de projeção para a IA.
 */
export function buildHorizonSnapshot(params: BuildHorizonSnapshotParams): HorizonSnapshot {
  const now = new Date();
  const snapshots: MonthSnapshot[] = [];

  // 1. Calcular individualmente cada um dos 6 meses (offset 0 a 5)
  for (let i = 0; i <= 5; i++) {
    const targetDate = addMonths(now, i);
    const monthKey = format(targetDate, "yyyy-MM");
    const monthLabel = format(targetDate, "MMMM 'de' yyyy", { locale: ptBR });

    // Ajustar scheduledIncomeCents apenas para o mês atual para evitar double-counting com transações reais recebidas
    let incomeForOutlook = params.scheduledIncomeCents;
    if (i === 0 && params.allTransactions) {
      const confirmedIncomeThisMonth = params.allTransactions
        .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

      if (confirmedIncomeThisMonth > 0) {
        incomeForOutlook = 0;
      }
    }

    // Obter panorama mensal projetado pelo motor central
    const outlook = calculateMonthlyOutlook({
      ...params,
      confirmedIncomeCents: i === 0 && params.allTransactions ? params.allTransactions
        .filter(t => t.transaction_type === "INCOME" && t.is_paid === true)
        .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0) : 0,
      scheduledIncomeCents: i === 0 ? incomeForOutlook : 0,
      scheduledExpensesCents: i === 0 ? params.scheduledExpensesCents : 0,
      monthOffset: i,
    });

    // Calcular valores detalhados recorrentes específicos para o mês-alvo
    const recurringIncome = calculateRecurringIncome(params.recurringTransactions || [], targetDate);
    const recurringExpenses = calculateRecurringExpenses(params.recurringTransactions || [], targetDate);

    // Calcular parcelamento incidindo no cartão
    const installmentExpenses = outlook.immediateCardDebt;

    // Calcular impacto das simulações ativas no mês correspondente
    const simulations = params.activeSimulations || [];
    const simulationExpenseImpact = simulations.reduce((sum, s) => {
      const startOffset = s.startMonthOffset ?? 0;
      if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
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
      if (i >= startOffset && i < startOffset + s.installments) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        return sum + (s.amount_cents / (s.installments || 1));
      }
      return sum;
    }, 0);

    const simulationIncomeImpact = simulations.reduce((sum, s) => {
      const startOffset = s.startMonthOffset ?? 0;
      if (s.isLoan || (s.interestRate && s.interestRate > 0 && s.type === "INCOME")) {
        if (i === startOffset) {
          return sum + s.amount_cents;
        }
        return sum;
      }
      if (s.type !== "INCOME") return sum;
      if (i >= startOffset && i < startOffset + s.installments) {
        if (s.customInstallmentCents !== undefined && s.customInstallmentCents > 0) {
          return sum + s.customInstallmentCents;
        }
        return sum + (s.amount_cents / (s.installments || 1));
      }
      return sum;
    }, 0);

    const simulationImpact = simulationIncomeImpact - simulationExpenseImpact;

    // Determinar se está em crise
    // Se o saldo final é menor que 0 ou está em modo de crise
    const isCrisis = outlook.isCrisisMode || outlook.isCritical;

    snapshots.push({
      monthKey,
      monthLabel,
      monthOffset: i,
      projectedBalance: outlook.balanceAtMonthEnd,
      recurringIncome,
      recurringExpenses,
      installmentExpenses,
      simulationImpact,
      isCrisis,
    });
  }

  // 2. Extrair informações consolidadas
  const currentMonth = snapshots[0];
  const futureMonths = snapshots.slice(1);

  // Dívida total remanescente no fim do horizonte de 6 meses (offset 5)
  const lastMonthOutlook = calculateMonthlyOutlook({
    ...params,
    confirmedIncomeCents: 0,
    scheduledIncomeCents: 0,
    scheduledExpensesCents: 0,
    monthOffset: 5,
  });
  const totalProjectedDebt = lastMonthOutlook.totalDebt;

  // Meses críticos
  const criticalMonths = snapshots
    .filter(s => s.isCrisis)
    .map(s => s.monthLabel);

  // Mês de saída projetada da dívida/crise
  let debtExitMonth: string | null = null;
  if (currentMonth.isCrisis) {
    // Procurar o primeiro mês futuro onde não há crise
    const exitMonth = snapshots.find((s, index) => index > 0 && !s.isCrisis);
    if (exitMonth) {
      debtExitMonth = exitMonth.monthLabel;
    }
  }

  return {
    currentMonth,
    futureMonths,
    totalProjectedDebt,
    debtExitMonth,
    criticalMonths,
  };
}
