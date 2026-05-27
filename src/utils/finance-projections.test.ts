import { describe, it, expect } from 'vitest';
import { getProjectedDetails } from './finance-projections';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';

describe('finance-projections', () => {
  const today = new Date();
  const nextMonth = addMonths(today, 1);

  describe('getProjectedDetails', () => {
    it('deve projetar saldo com orçamentos no mês atual', () => {
      const budgets = [
        { amount_cents: 50000, spent_this_month: 20000, category: 'Food' }
      ];
      const result = getProjectedDetails(100000, today, [], budgets);
      
      // Saldo inicial: 100000
      // Orçamento restante: 50000 - 20000 = 30000
      // Saldo projetado: 100000 - 30000 = 70000
      expect(result.totalBalance).toBe(70000);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toContain('Reserva: Food');
    });

    it('deve projetar saldo com itens recorrentes para o mês seguinte', () => {
      const recurringItems: any[] = [
        {
          id: 'r1',
          amount_cents: 500000, // Ganha 5000
          transaction_type: 'INCOME',
          frequency: 'monthly',
          next_date: startOfMonth(nextMonth).toISOString(),
          description: 'Salário'
        },
        {
          id: 'r2',
          amount_cents: 100000, // Gasta 1000
          transaction_type: 'EXPENSE',
          frequency: 'monthly',
          next_date: startOfMonth(nextMonth).toISOString(),
          description: 'Aluguel'
        }
      ];

      const targetDate = endOfMonth(nextMonth);
      const result = getProjectedDetails(100000, targetDate, recurringItems, []);

      // Mês atual: 100000
      // Mês seguinte: + 500000 - 100000 = + 400000
      // Total: 500000
      expect(result.totalBalance).toBe(500000);
      
      // Deve ter 2 transações no mês seguinte (Salário e Aluguel)
      // Se não houver outras no mês atual que caiam na projeção
      const incomeTx = result.transactions.find(t => t.description === 'Salário');
      const expenseTx = result.transactions.find(t => t.description === 'Aluguel');
      
      expect(incomeTx).toBeDefined();
      expect(expenseTx).toBeDefined();
    });

    it('deve projetar múltiplos meses à frente', () => {
      const twoMonthsAhead = addMonths(today, 2);
      const budgets = [{ amount_cents: 100000, spent_this_month: 100000 }]; // Gasta 1000 todo mês

      const result = getProjectedDetails(500000, twoMonthsAhead, [], budgets);
      
      // Mês 0 (atual): 0 restante (1000 - 1000)
      // Mês 1: - 100000
      // Mês 2: - 100000
      // Total: 500000 - 200000 = 300000
      expect(result.totalBalance).toBe(300000);
    });

    it('deve lidar com frequências diferentes (semanal)', () => {
      // Configurar um item semanal que ocorre 4 vezes no mês seguinte
      const nextMonthStart = startOfMonth(nextMonth);
      const recurringItems: any[] = [
        {
          id: 'weekly-1',
          amount_cents: 10000,
          transaction_type: 'EXPENSE',
          frequency: 'weekly',
          next_date: nextMonthStart.toISOString(),
          description: 'Feira'
        }
      ];

      const targetDate = endOfMonth(nextMonth);
      const result = getProjectedDetails(100000, targetDate, recurringItems, []);
      
      // No mês seguinte teremos pelo menos 4 ocorrências (7, 14, 21, 28 dias após o início)
      const weeklyTxs = result.transactions.filter(t => t.description === 'Feira');
      expect(weeklyTxs.length).toBeGreaterThanOrEqual(4);
    });

    it('deve lidar com frequências quinzenais (biweekly)', () => {
      const nextMonthStart = startOfMonth(nextMonth);
      const recurringItems: any[] = [
        {
          id: 'biweekly-1',
          amount_cents: 5000,
          transaction_type: 'EXPENSE',
          frequency: 'weekly',
          next_date: nextMonthStart.toISOString(),
          description: 'Cabelo [Freq: every_14_days]'
        }
      ];

      const targetDate = endOfMonth(nextMonth);
      const result = getProjectedDetails(100000, targetDate, recurringItems, []);
      
      const biweeklyTxs = result.transactions.filter(t => t.description === 'Cabelo');
      expect(biweeklyTxs.length).toBe(3);
    });

    it('deve lidar com frequências de dias personalizados (ex: a cada 20 dias)', () => {
      const nextMonthStart = startOfMonth(nextMonth);
      const recurringItems: any[] = [
        {
          id: 'custom-days-1',
          amount_cents: 8000,
          transaction_type: 'EXPENSE',
          frequency: 'daily',
          next_date: nextMonthStart.toISOString(),
          description: 'Lazer Flex [Freq: every_20_days]'
        }
      ];

      const targetDate = endOfMonth(nextMonth);
      const result = getProjectedDetails(100000, targetDate, recurringItems, []);
      
      const customTxs = result.transactions.filter(t => t.description === 'Lazer Flex');
      // No dia 1 e no dia 21 do mês alvo
      expect(customTxs.length).toBe(2);
    });

    it('deve respeitar a integridade cronológica diária para despesas recorrentes futuras', () => {
      const futureDate = new Date(today.getFullYear(), today.getMonth(), 30);
      const targetBefore = new Date(today.getFullYear(), today.getMonth(), 27);
      const targetAfter = new Date(today.getFullYear(), today.getMonth(), 30);

      const recurringItems: any[] = [
        {
          id: 'rec-future-exp',
          amount_cents: 5000,
          transaction_type: 'EXPENSE',
          frequency: 'once',
          next_date: futureDate.toISOString(),
          description: 'Corte de Cabelo'
        }
      ];

      const resultBefore = getProjectedDetails(100000, targetBefore, recurringItems, []);
      expect(resultBefore.totalBalance).toBe(100000);

      const resultAfter = getProjectedDetails(100000, targetAfter, recurringItems, []);
      expect(resultAfter.totalBalance).toBe(95000);
    });

    it('deve respeitar a integridade cronológica diária para receitas recorrentes futuras', () => {
      const futureDate = new Date(today.getFullYear(), today.getMonth(), 30);
      const targetBefore = new Date(today.getFullYear(), today.getMonth(), 27);
      const targetAfter = new Date(today.getFullYear(), today.getMonth(), 30);

      const recurringItems: any[] = [
        {
          id: 'rec-future-inc',
          amount_cents: 3000,
          transaction_type: 'INCOME',
          frequency: 'once',
          next_date: futureDate.toISOString(),
          description: 'Venda de Item'
        }
      ];

      const resultBefore = getProjectedDetails(100000, targetBefore, recurringItems, []);
      expect(resultBefore.totalBalance).toBe(100000);

      const resultAfter = getProjectedDetails(100000, targetAfter, recurringItems, []);
      expect(resultAfter.totalBalance).toBe(103000);
    });

    it('deve respeitar a integridade cronológica diária para transações reais futuras (futureTransactions)', () => {
      const futureDate = new Date(today.getFullYear(), today.getMonth(), 30);
      const targetBefore = new Date(today.getFullYear(), today.getMonth(), 27);
      const targetAfter = new Date(today.getFullYear(), today.getMonth(), 30);

      const futureTransactions: any[] = [
        {
          id: 'tx-future-exp',
          amount_cents: 8000,
          transaction_type: 'EXPENSE',
          date: futureDate.toISOString(),
          description: 'Compra futura parcelada'
        }
      ];

      const resultBefore = getProjectedDetails(100000, targetBefore, [], [], [], futureTransactions);
      expect(resultBefore.totalBalance).toBe(100000);

      const resultAfter = getProjectedDetails(100000, targetAfter, [], [], [], futureTransactions);
      expect(resultAfter.totalBalance).toBe(92000);
    });
  });
});
