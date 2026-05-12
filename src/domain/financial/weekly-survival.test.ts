import { describe, it, expect } from 'vitest';
import { calculateWeeklySurvival } from '@/domain/financial/financial-logic';

describe('calculateWeeklySurvival', () => {
  it('deve calcular o limite semanal como 25% da sobra mensal', () => {
    const result = calculateWeeklySurvival({
      monthlySurplusCents: 100000, // R$ 1.000,00
      currentMonthTransactions: []
    });

    expect(result.weeklyLimitCents).toBe(25000); // R$ 250,00
    expect(result.remainingCents).toBe(25000);
    expect(result.status).toBe('NORMAL');
  });

  it('deve subtrair gastos variáveis da última semana', () => {
    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);

    const transactions = [
      { date: threeDaysAgo.toISOString(), amount_cents: 5000, transaction_type: 'EXPENSE', is_recurring: false }, // R$ 50,00
      { date: threeDaysAgo.toISOString(), amount_cents: 10000, transaction_type: 'EXPENSE', is_recurring: true }, // Recorrente (ignorado)
    ];

    const result = calculateWeeklySurvival({
      monthlySurplusCents: 100000, // R$ 1.000,00 -> Limite R$ 250,00
      currentMonthTransactions: transactions
    });

    expect(result.weeklySpentCents).toBe(5000);
    expect(result.remainingCents).toBe(20000);
  });

  it('deve retornar status CRITICAL quando o limite é excedido', () => {
    const now = new Date();
    const transactions = [
      { date: now.toISOString(), amount_cents: 30000, transaction_type: 'EXPENSE', is_recurring: false },
    ];

    const result = calculateWeeklySurvival({
      monthlySurplusCents: 100000, // Limite R$ 250,00
      currentMonthTransactions: transactions
    });

    expect(result.status).toBe('CRITICAL');
    expect(result.remainingCents).toBeLessThan(0);
  });

  it('deve retornar status WARNING quando consome mais de 60%', () => {
    const now = new Date();
    const transactions = [
      { date: now.toISOString(), amount_cents: 16000, transaction_type: 'EXPENSE', is_recurring: false },
    ];

    const result = calculateWeeklySurvival({
      monthlySurplusCents: 100000, // Limite R$ 250,00. 60% = 150,00
      currentMonthTransactions: transactions
    });

    expect(result.status).toBe('WARNING');
  });
});
