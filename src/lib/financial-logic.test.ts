import { describe, it, expect } from 'vitest';
import { 
  calculateTotalConsolidatedDebt, 
  calculateAccumulatedBalance, 
  calculateNetLiquidity,
  calculateMonthlyOutlook,
  calculateDebtExitProjection
} from './financial-logic';
import { Account, Budget } from '@/lib/db';

describe('financial-logic', () => {
  const mockAccounts: Account[] = [
    {
      id: '1',
      user_id: 'user1',
      name: 'Conta Corrente',
      type: 'CHECKING',
      balance_cents: 100000, // R$ 1.000,00
      institution: 'Bank A',
      color: '#000'
    },
    {
      id: '2',
      user_id: 'user1',
      name: 'Cartão de Crédito',
      type: 'CREDIT_CARD',
      balance_cents: 0,
      closed_invoice_cents: 20000, // R$ 200,00
      open_invoice_cents: 30000,   // R$ 300,00
      institution: 'Bank B',
      color: '#fff'
    },
    {
      id: '3',
      user_id: 'user1',
      name: 'Investimento',
      type: 'INVESTMENT',
      balance_cents: 50000,  // R$ 500,00
      institution: 'Bank C',
      color: '#ccc'
    }
  ];

  describe('calculateTotalConsolidatedDebt', () => {
    it('deve somar faturas abertas e fechadas de cartões de crédito', () => {
      const debt = calculateTotalConsolidatedDebt(mockAccounts);
      expect(debt).toBe(50000); // 20000 + 30000
    });

    it('deve retornar 0 se não houver contas de cartão', () => {
      const debt = calculateTotalConsolidatedDebt([mockAccounts[0], mockAccounts[2]]);
      expect(debt).toBe(0);
    });

    it('deve retornar 0 para array vazio', () => {
      expect(calculateTotalConsolidatedDebt([])).toBe(0);
    });
  });

  describe('calculateAccumulatedBalance', () => {
    it('deve somar saldos de contas que não são cartão de crédito', () => {
      const balance = calculateAccumulatedBalance(mockAccounts);
      expect(balance).toBe(150000); // 100000 + 50000
    });

    it('deve retornar 0 se houver apenas cartões', () => {
      const balance = calculateAccumulatedBalance([mockAccounts[1]]);
      expect(balance).toBe(0);
    });
  });

  describe('calculateNetLiquidity', () => {
    it('deve subtrair a dívida do saldo acumulado', () => {
      const net = calculateNetLiquidity(mockAccounts);
      expect(net).toBe(100000); // 150000 - 50000
    });
  });

  describe('calculateMonthlyOutlook', () => {
    const budgets: Budget[] = [
      { id: 'b1', user_id: 'u1', category_id: 'c1', amount_cents: 20000, spent_cents: 5000, month: '2024-05' }
    ];

    it('deve calcular o panorama mensal corretamente', () => {
      const outlook = calculateMonthlyOutlook({
        accounts: mockAccounts,
        scheduledIncomeCents: 50000,
        scheduledExpensesCents: 10000,
        budgets,
        netLiquidityCents: 100000
      });

      // Liquidez: 150000
      // Dívida total: 50000
      // Receita agendada: 50000
      // Despesa agendada: 10000
      // Reserva de orçamento: 20000 - 5000 = 15000
      // balanceAtMonthEnd = 150000 + 50000 - (10000 + 50000) - 15000 = 200000 - 60000 - 15000 = 125000
      
      expect(outlook.balanceAtMonthEnd).toBe(125000);
      expect(outlook.isHealthy).toBe(true);
      expect(outlook.isCritical).toBe(false);
    });

    it('deve marcar como crítico se o saldo projetado for negativo', () => {
      const outlook = calculateMonthlyOutlook({
        accounts: mockAccounts,
        scheduledIncomeCents: 0,
        scheduledExpensesCents: 200000,
        budgets: [],
        netLiquidityCents: 100000
      });

      // 150000 + 0 - (200000 + 50000) - 0 = 150000 - 250000 = -100000
      expect(outlook.balanceAtMonthEnd).toBe(-100000);
      expect(outlook.isCritical).toBe(true);
    });
  });

  describe('calculateDebtExitProjection', () => {
    it('deve retornar mesesToExit como 0 se a liquidez for positiva', () => {
      const projection = calculateDebtExitProjection({
        netLiquidityCents: 10000,
        recurringIncomeCents: 500000,
        recurringExpensesCents: 300000,
        budgets: []
      });
      expect(projection.monthsToExit).toBe(0);
    });

    it('deve calcular corretamente o tempo para sair da dívida', () => {
      const projection = calculateDebtExitProjection({
        netLiquidityCents: -100000, // Dívida de 1000
        recurringIncomeCents: 500000, // Ganha 5000
        recurringExpensesCents: 300000, // Gasta 3000
        budgets: [{ amount_cents: 100000 } as any] // Reserva 1000
      });
      // Sobra mensal = 500000 - 300000 - 100000 = 100000
      // Meses = |-100000| / 100000 = 1
      expect(projection.monthsToExit).toBe(1);
    });

    it('deve retornar 999 se a sobra mensal for negativa ou zero', () => {
      const projection = calculateDebtExitProjection({
        netLiquidityCents: -100000,
        recurringIncomeCents: 300000,
        recurringExpensesCents: 300000,
        budgets: []
      });
      expect(projection.monthsToExit).toBe(999);
    });
  });
});
