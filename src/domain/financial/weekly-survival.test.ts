import { describe, it, expect } from 'vitest';
import { calculateWeeklySurvival } from '@/domain/financial/financial-logic';
import { Transaction } from '@/lib/db';

describe('calculateWeeklySurvival', () => {
  it('deve calcular o limite semanal baseado na sobra mensal ou ativos', () => {
    const result = calculateWeeklySurvival({
      recurringIncomeCents: 150000, // Ganha 1.500
      recurringExpensesCents: 50000, // Gasta 500 = sobra 1.000
      monthOffset: 0,
      targetAssetsCents: 0,
      currentMonthTransactions: []
    });

    // Se a sobra mensal é 1.000 e falta cerca de 4 ou 5 semanas no mês (dependendo da data), 
    // ele vai dividir 1.000 / semanas restantes do mês. Vamos apenas testar se está no range esperado ou maior que 50.
    expect(result.weeklyLimitCents).toBeGreaterThan(5000); 
    expect(result.status).toBe('NORMAL');
  });

  it('deve subtrair gastos variáveis da última semana', () => {
    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);

    const transactions = [
      { id: '1', date: threeDaysAgo.toISOString(), amount_cents: 5000, transaction_type: 'EXPENSE' }, // R$ 50,00 variável
      { id: '2', date: threeDaysAgo.toISOString(), amount_cents: 10000, transaction_type: 'EXPENSE', source_metadata: { recurring_id: 'rec1' } }, // Recorrente (ignorado)
    ] as unknown as Transaction[];

    const result = calculateWeeklySurvival({
      recurringIncomeCents: 150000,
      recurringExpensesCents: 50000, // Sobra 1000
      monthOffset: 0,
      targetAssetsCents: 0,
      currentMonthTransactions: transactions
    });

    expect(result.weeklySpentCents).toBe(5000);
  });

  it('deve retornar status CRITICAL quando o limite é excedido', () => {
    const now = new Date();
    const transactions = [
      { id: '1', date: now.toISOString(), amount_cents: 150000, transaction_type: 'EXPENSE' }, // Gastou R$ 1.500 na semana atual, sobra era só 1000 no mês todo
    ] as unknown as Transaction[];

    const result = calculateWeeklySurvival({
      recurringIncomeCents: 150000,
      recurringExpensesCents: 50000,
      monthOffset: 0,
      targetAssetsCents: 0,
      currentMonthTransactions: transactions
    });

    expect(result.status).toBe('CRITICAL');
    expect(result.remainingCents).toBeLessThan(0);
  });

  it('deve retornar status WARNING quando consome mais de 60%', () => {
    const now = new Date();
    const transactions = [
      { id: '1', date: now.toISOString(), amount_cents: 16000, transaction_type: 'EXPENSE' },
    ] as unknown as Transaction[];

    const result = calculateWeeklySurvival({
      recurringIncomeCents: 50000,
      recurringExpensesCents: 40000, // Sobra R$ 100 por mês. Teto = R$ 50 (mínimo). 16/50 = 32% (NORMAL).
      // Se gastou 3500 (R$ 35), 35/50 = 70% (WARNING).
      monthOffset: 0,
      targetAssetsCents: 0,
      currentMonthTransactions: [{ id: '1', date: now.toISOString(), amount_cents: 3500, transaction_type: 'EXPENSE' } as unknown as Transaction]
    });

    expect(result.status).toBe('WARNING');
  });
});
