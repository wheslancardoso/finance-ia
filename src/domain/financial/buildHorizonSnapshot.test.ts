import { describe, it, expect } from 'vitest';
import { buildHorizonSnapshot } from './buildHorizonSnapshot';
import { Account, Budget, RecurringTransaction } from '@/lib/db';

describe('buildHorizonSnapshot', () => {
  const mockAccounts: Account[] = [
    {
      id: 'checking-1',
      user_id: 'user-1',
      name: 'Checking Account',
      type: 'CHECKING',
      balance_cents: 100000, // R$ 1.000,00
      institution: 'Bank A',
      color_hex: '#000'
    } as any,
    {
      id: 'credit-1',
      user_id: 'user-1',
      name: 'Credit Card',
      type: 'CREDIT_CARD',
      balance_cents: 0,
      closed_invoice_cents: 20000, // R$ 200,00
      open_invoice_cents: 30000,   // R$ 300,00
      institution: 'Bank B',
      color_hex: '#fff'
    } as any
  ];

  const mockBudgets: Budget[] = [
    {
      id: 'budget-1',
      user_id: 'user-1',
      category: 'Alimentação',
      amount_cents: 20000, // R$ 200,00 de limite
      spent_cents: 5000    // R$ 50,00 gastos no mês atual
    } as any
  ];

  const mockRecurring: RecurringTransaction[] = [
    {
      id: 'rec-1',
      user_id: 'user-1',
      transaction_type: 'INCOME',
      status: 'active',
      amount_cents: 200000, // R$ 2.000,00 de salário
      description: 'Salário',
      frequency: 'monthly',
      is_primary_income: true
    } as any,
    {
      id: 'rec-2',
      user_id: 'user-1',
      transaction_type: 'EXPENSE',
      status: 'active',
      amount_cents: 100000, // R$ 1.000,00 de aluguel
      description: 'Aluguel',
      frequency: 'monthly',
      is_primary_income: false
    } as any
  ];

  it('deve gerar snapshots para exatamente 6 meses (offset 0 a 5)', () => {
    const snapshot = buildHorizonSnapshot({
      accounts: mockAccounts,
      scheduledIncomeCents: 200000,
      scheduledExpensesCents: 100000,
      recurringIncomeCents: 200000,
      recurringExpensesCents: 100000,
      budgets: mockBudgets,
      netLiquidityCents: 50000, // 1000 - 500
      recurringTransactions: mockRecurring,
    });

    expect(snapshot.currentMonth).toBeDefined();
    expect(snapshot.futureMonths).toHaveLength(5);
    expect(snapshot.currentMonth.monthOffset).toBe(0);
    expect(snapshot.futureMonths[0].monthOffset).toBe(1);
    expect(snapshot.futureMonths[4].monthOffset).toBe(5);
  });

  it('deve identificar corretamente os meses em crise', () => {
    // Cenário onde o usuário tem saldo baixo e contas altas, forçando crise
    const poorAccounts = [
      {
        id: 'checking-1',
        type: 'CHECKING',
        balance_cents: 10000, // R$ 100,00
      } as Account,
      {
        id: 'credit-1',
        type: 'CREDIT_CARD',
        closed_invoice_cents: 150000, // R$ 1.500,00 de dívida
        open_invoice_cents: 50000,    // R$ 500,00
      } as Account
    ];

    const snapshot = buildHorizonSnapshot({
      accounts: poorAccounts,
      scheduledIncomeCents: 100000, // Salário insuficiente para cobrir tudo
      scheduledExpensesCents: 120000,
      recurringIncomeCents: 100000,
      recurringExpensesCents: 120000,
      budgets: mockBudgets,
      netLiquidityCents: -190000,
      recurringTransactions: mockRecurring.map(r => r.description === 'Salário' ? { ...r, amount_cents: 100000 } : r),
    });

    // Como o saldo acumulado inicial é -R$ 1.900,00 e o saldo recorrente é deficitário
    // Esperamos que o mês atual esteja em crise
    expect(snapshot.currentMonth.isCrisis).toBe(true);
    expect(snapshot.criticalMonths.length).toBeGreaterThan(0);
    expect(snapshot.criticalMonths).toContain(snapshot.currentMonth.monthLabel);
  });

  it('deve simular impacto de empréstimo e calcular a saída da crise', () => {
    // Cenário: Usuário começa em crise profunda (-R$ 1.900,00)
    const poorAccounts = [
      {
        id: 'checking-1',
        type: 'CHECKING',
        balance_cents: 10000,
      } as Account,
      {
        id: 'credit-1',
        type: 'CREDIT_CARD',
        closed_invoice_cents: 150000,
        open_invoice_cents: 50000,
      } as Account
    ];

    // Simulação de injeção de empréstimo de R$ 2.000,00 no mês 0, pago em 4 parcelas
    const loanSimulation = [
      {
        amount_cents: 200000, // R$ 2.000,00 injetado
        installments: 4,      // 4 parcelas
        isLoan: true,
        type: "INCOME" as const,
        interestRate: 0,      // sem juros para simplificar o teste
        startMonthOffset: 0,
      }
    ];

    const snapshot = buildHorizonSnapshot({
      accounts: poorAccounts,
      scheduledIncomeCents: 100000,
      scheduledExpensesCents: 100000,
      recurringIncomeCents: 100000,
      recurringExpensesCents: 100000,
      budgets: [],
      netLiquidityCents: -190000,
      recurringTransactions: [
        { transaction_type: 'INCOME', status: 'active', amount_cents: 100000, description: 'Salário' } as any,
        { transaction_type: 'EXPENSE', status: 'active', amount_cents: 100000, description: 'Despesa' } as any
      ],
      activeSimulations: loanSimulation
    });

    // Com startMonthOffset = 0, a injeção de R$ 2.000,00 resolve a crise imediatamente
    // no mês atual (offset 0), portanto isCrisis deve ser false e debtExitMonth deve ser null
    expect(snapshot.currentMonth.isCrisis).toBe(false);
    expect(snapshot.debtExitMonth).toBeNull();

    // Cenário 2: Empréstimo injetado apenas no mês 2 (startMonthOffset: 2)
    // O mês atual continua em crise, mas a saída da crise ocorre no mês 2
    const loanSimulationMonth2 = [
      {
        amount_cents: 200000,
        installments: 4,
        isLoan: true,
        type: "INCOME" as const,
        interestRate: 0,
        startMonthOffset: 2,
      }
    ];

    const snapshotMonth2 = buildHorizonSnapshot({
      accounts: poorAccounts,
      scheduledIncomeCents: 100000,
      scheduledExpensesCents: 200000,
      recurringIncomeCents: 100000,
      recurringExpensesCents: 100000,
      budgets: [],
      netLiquidityCents: -190000,
      recurringTransactions: [
        { transaction_type: 'INCOME', status: 'active', amount_cents: 100000, description: 'Salário' } as any,
        { transaction_type: 'EXPENSE', status: 'active', amount_cents: 100000, description: 'Despesa' } as any
      ],
      activeSimulations: loanSimulationMonth2
    });

    // Mês atual deve continuar em crise
    expect(snapshotMonth2.currentMonth.isCrisis).toBe(true);
    // Mas a saída da crise deve ser projetada para o mês 2 (offset 2, que é o futureMonths[1])
    expect(snapshotMonth2.debtExitMonth).toBe(snapshotMonth2.futureMonths[1].monthLabel);
  });
});
