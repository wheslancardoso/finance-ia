import { describe, it, expect } from 'vitest';
import { 
  calculateTotalConsolidatedDebt, 
  calculateAccumulatedBalance, 
  calculateNetLiquidity,
  calculateMonthlyOutlook,
  calculateDebtExitProjection,
  calculateScheduledIncome,
  calculateScheduledExpenses,
  calculateRecurringIncome,
  calculateRecurringExpenses,
  simulateDetailedImpact
} from './financial-logic';
import { Account, Budget, RecurringTransaction } from '@/lib/db';

describe('Financial Logic Domain', () => {
  const mockAccounts: Account[] = [
    {
      id: '1',
      user_id: 'user1',
      name: 'Conta Corrente',
      type: 'CHECKING',
      balance_cents: 100000, // R$ 1.000,00
      institution: 'Bank A',
      color_hex: '#000'
    } as any,
    {
      id: '2',
      user_id: 'user1',
      name: 'Cartão de Crédito',
      type: 'CREDIT_CARD',
      balance_cents: 0,
      closed_invoice_cents: 20000, // R$ 200,00
      open_invoice_cents: 30000,   // R$ 300,00
      institution: 'Bank B',
      color_hex: '#fff'
    } as any,
    {
      id: '3',
      user_id: 'user1',
      name: 'Investimento',
      type: 'INVESTMENT',
      balance_cents: 50000,  // R$ 500,00
      institution: 'Bank C',
      color_hex: '#ccc'
    } as any
  ];

  describe('calculateTotalConsolidatedDebt', () => {
    it('deve somar faturas abertas e fechadas de cartões de crédito', () => {
      const debt = calculateTotalConsolidatedDebt(mockAccounts);
      expect(debt).toBe(50000); // 20000 + 30000
    });

    it('deve priorizar total_debt_cents se presente', () => {
      const accounts = [
        { 
          type: 'CREDIT_CARD', 
          total_debt_cents: 100000,
          open_invoice_cents: 50000, 
          closed_invoice_cents: 30000 
        } as Account,
      ];
      expect(calculateTotalConsolidatedDebt(accounts)).toBe(100000);
    });

    it('deve retornar 0 se não houver contas de cartão', () => {
      const debt = calculateTotalConsolidatedDebt([mockAccounts[0], mockAccounts[2]]);
      expect(debt).toBe(0);
    });
  });

  describe('calculateAccumulatedBalance', () => {
    it('deve somar saldos de contas que não são cartão de crédito', () => {
      const balance = calculateAccumulatedBalance(mockAccounts);
      expect(balance).toBe(150000); // 100000 + 50000
    });
  });

  describe('calculateNetLiquidity', () => {
    it('deve subtrair a dívida do saldo acumulado', () => {
      const net = calculateNetLiquidity(mockAccounts);
      expect(net).toBe(100000); // 150000 - 50000
    });

    it('deve retornar valor negativo se a dívida for maior que o saldo', () => {
      const accounts = [
        { type: 'CHECKING', balance_cents: 10000 } as Account,
        { type: 'CREDIT_CARD', open_invoice_cents: 50000 } as Account,
      ];
      expect(calculateNetLiquidity(accounts)).toBe(-40000);
    });
  });

  describe('Scheduled & Recurring Transactions', () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    it('deve calcular receitas e despesas agendadas para o mês atual', () => {
      const recurring = [
        { 
          transaction_type: 'INCOME', 
          status: 'active', 
          amount_cents: 100000, 
          next_date: today 
        } as RecurringTransaction,
        { 
          transaction_type: 'EXPENSE', 
          status: 'active', 
          amount_cents: 50000, 
          next_date: today 
        } as RecurringTransaction,
      ];
      expect(calculateScheduledIncome(recurring)).toBe(100000);
      expect(calculateScheduledExpenses(recurring)).toBe(50000);
    });

    it('deve calcular totais recorrentes mensais', () => {
      const recurring = [
        { transaction_type: 'INCOME', status: 'active', amount_cents: 300000 } as RecurringTransaction,
        { transaction_type: 'EXPENSE', status: 'active', amount_cents: 150000 } as RecurringTransaction,
      ];
      expect(calculateRecurringIncome(recurring)).toBe(300000);
      expect(calculateRecurringExpenses(recurring)).toBe(150000);
    });
  });

  describe('calculateMonthlyOutlook', () => {
    it('deve calcular o panorama mensal corretamente', () => {
      const budgets: Budget[] = [
        { id: 'b1', user_id: 'u1', category_id: 'c1', amount_cents: 20000, spent_cents: 5000, month: '2024-05' } as any
      ];
      const outlook = calculateMonthlyOutlook({
        accounts: mockAccounts,
        scheduledIncomeCents: 50000,
        scheduledExpensesCents: 10000,
        budgets,
        netLiquidityCents: 100000
      });
      
      expect(outlook.balanceAtMonthEnd).toBe(125000);
      expect(outlook.isHealthy).toBe(true);
    });
  });

  describe('calculateDebtExitProjection', () => {
    it('deve calcular corretamente o tempo para sair da dívida', () => {
      const projection = calculateDebtExitProjection({
        netLiquidityCents: -100000, // Dívida de 1000
        recurringIncomeCents: 500000, // Ganha 5000
        recurringExpensesCents: 300000, // Gasta 3000
        budgets: [{ amount_cents: 100000 } as any] // Reserva 1000
      });
      expect(projection.monthsToExit).toBe(1);
    });
  });

  describe('simulateDetailedImpact', () => {
    it('deve calcular impacto de compra à vista com segurança', () => {
      const result = simulateDetailedImpact({
        amountCents: 10000,
        installments: 1,
        netLiquidityCents: 100000,
        monthlySurplus: 50000,
        currentExitDate: null,
        currentBalanceCents: 100000
      });
      expect(result.status).toBe('SAFE');
    });

    it('deve alertar perigo se comprometer muita sobra mensal', () => {
      const result = simulateDetailedImpact({
        amountCents: 90000,
        installments: 2, // 45000 por mês
        netLiquidityCents: 100000,
        monthlySurplus: 50000, // Sobra de 50000, parcela de 45000 (90%)
        currentExitDate: null,
        currentBalanceCents: 100000
      });
      expect(result.status).toBe('DANGER');
      expect(result.impact_percentage).toBe(90);
    });
  });
});
