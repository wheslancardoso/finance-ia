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
  simulateDetailedImpact,
  calculateAdvancedProjection,
  calculateAntifragilityTier,
  isRecurringExpired
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
          next_date: today,
          description: 'Salário normal'
        } as RecurringTransaction,
        { 
          transaction_type: 'EXPENSE', 
          status: 'active', 
          amount_cents: 50000, 
          next_date: today,
          description: 'Faculdade [Vence: 2026-07]'
        } as RecurringTransaction,
      ];
      expect(calculateScheduledIncome(recurring)).toBe(100000);
      expect(calculateScheduledExpenses(recurring)).toBe(50000);
    });

    it('deve calcular totais recorrentes mensais', () => {
      const recurring = [
        { transaction_type: 'INCOME', status: 'active', amount_cents: 300000, description: 'Salário' } as RecurringTransaction,
        { transaction_type: 'EXPENSE', status: 'active', amount_cents: 150000, description: 'Mensalidade' } as RecurringTransaction,
      ];
      expect(calculateRecurringIncome(recurring)).toBe(300000);
      expect(calculateRecurringExpenses(recurring)).toBe(150000);
    });

    it('deve detectar expiração de transações com a tag [Vence: YYYY-MM] corretamente', () => {
      // Vence em Julho de 2026
      const desc = "Faculdade [Vence: 2026-07]";
      
      // Meses anteriores ou igual ao vencimento não devem expirar
      expect(isRecurringExpired(desc, "2026-06")).toBe(false);
      expect(isRecurringExpired(desc, "2026-07")).toBe(false);
      
      // Meses posteriores ao vencimento devem expirar
      expect(isRecurringExpired(desc, "2026-08")).toBe(true);
      expect(isRecurringExpired(desc, "2027-01")).toBe(true);

      // Transações sem a tag nunca expiram
      expect(isRecurringExpired("Academia", "2026-08")).toBe(false);
    });

    it('deve ignorar transações expiradas no cálculo de receitas e despesas recorrentes baseados em data', () => {
      const recurring = [
        { 
          transaction_type: 'EXPENSE', 
          status: 'active', 
          amount_cents: 100000, 
          description: 'Faculdade [Vence: 2026-07]' 
        } as RecurringTransaction
      ];

      // Em julho/2026, a faculdade é contada
      expect(calculateRecurringExpenses(recurring, new Date("2026-07-15"))).toBe(100000);

      // Em agosto/2026, a faculdade é ignorada por estar expirada
      expect(calculateRecurringExpenses(recurring, new Date("2026-08-15"))).toBe(0);
    });
  });

  describe('calculateMonthlyOutlook', () => {
    it('deve calcular o panorama mensal corretamente', () => {
      const result = calculateMonthlyOutlook({
        accounts: mockAccounts,
        scheduledIncomeCents: 50000,
        scheduledExpensesCents: 30000,
        recurringIncomeCents: 500000,
        recurringExpensesCents: 200000,
        budgets: [{ amount_cents: 10000, category_id: '1' } as any],
        netLiquidityCents: 100000,
        monthOffset: 0
      });
      expect(result.balanceAtMonthEnd).toBeGreaterThan(100000);
      expect(result.isHealthy).toBe(true);
    });

    it('deve evitar double-counting de despesas de cartão em currentMonthPendingExpenses', () => {
      const accounts: Account[] = [
        { id: 'checking-1', type: 'CHECKING', balance_cents: 100000 } as any,
        { id: 'card-1', type: 'CREDIT_CARD', open_invoice_cents: 20000, open_invoice_month: new Date().toISOString().slice(0, 7) } as any
      ];

      const allTransactions = [
        // Despesa no cartão de crédito (já contada na open_invoice_cents do card-1)
        { account_id: 'card-1', transaction_type: 'EXPENSE', amount_cents: 20000, is_paid: false, date: new Date().toISOString() } as any,
        // Despesa em conta corrente (não contada no card, deve ser considerada pendente)
        { account_id: 'checking-1', transaction_type: 'EXPENSE', amount_cents: 5000, is_paid: false, date: new Date().toISOString() } as any
      ];

      const result = calculateMonthlyOutlook({
        accounts,
        scheduledIncomeCents: 0,
        scheduledExpensesCents: 5000,
        recurringIncomeCents: 0,
        recurringExpensesCents: 0,
        budgets: [],
        netLiquidityCents: 80000,
        allTransactions,
        monthOffset: 0
      });

      // Saldo projetado no final do mês = Saldo Checking (100000) - Fatura do Cartão (20000) - Despesa Pendente da Checking (5000)
      // Se houvesse double-counting, ele subtrairia a despesa do cartão de 20000 de novo e daria 55000.
      // Correto: 100000 - 20000 - 5000 = 75000.
      expect(result.balanceAtMonthEnd).toBe(75000);
    });

    it('deve subtrair receitas/ajustes de tipo INCOME do total de parcelas futuras do cartão', () => {
      const accounts: Account[] = [
        { id: 'checking-1', type: 'CHECKING', balance_cents: 100000 } as any,
        { id: 'card-1', type: 'CREDIT_CARD', open_invoice_cents: 0, closing_day: 1 } as any
      ];

      const allTransactions = [
        // Compra no cartão (R$ 100,00) que vence no mês alvo
        { id: 't1', account_id: 'card-1', transaction_type: 'EXPENSE', amount_cents: 10000, is_paid: false, date: new Date().toISOString() } as any,
        // Ajuste/estorno de INCOME no cartão (R$ 40,00) que vence no mesmo mês alvo
        { id: 't2', account_id: 'card-1', transaction_type: 'INCOME', amount_cents: 4000, is_paid: false, date: new Date().toISOString() } as any
      ];

      const result = calculateMonthlyOutlook({
        accounts,
        scheduledIncomeCents: 0,
        scheduledExpensesCents: 0,
        recurringIncomeCents: 0,
        recurringExpensesCents: 0,
        budgets: [],
        netLiquidityCents: 100000,
        allTransactions,
        monthOffset: 1 // Projeção para mês futuro
      });

      // No futuro, a dívida do cartão (immediateCardDebt) é o installmentDebt.
      // O installmentDebt deve ser 10000 (Expense) - 4000 (Income) = 6000 cents (R$ 60,00).
      expect(result.immediateCardDebt).toBe(6000);
    });

    it('deve encadear saldo final do mês 0 no saldo inicial de meses futuros', () => {
      const accounts: Account[] = [
        { id: 'checking-1', type: 'CHECKING', balance_cents: 100000 } as any
      ];
      const resultMonth0 = calculateMonthlyOutlook({
        accounts,
        scheduledIncomeCents: 50000,
        scheduledExpensesCents: 30000,
        recurringIncomeCents: 0,
        recurringExpensesCents: 0,
        budgets: [],
        netLiquidityCents: 100000,
        monthOffset: 0
      });
      // Saldo de ativos final de Junho (mês 0) deve ser 100000 + 50000 - 30000 = 120000 (R$ 1.200,00)
      expect(resultMonth0.totalAssets).toBe(120000);

      const recurringTransactions = [
        {
          id: 'rec-inc-1',
          description: 'Salário',
          amount_cents: 10000,
          transaction_type: 'INCOME' as const,
          frequency: 'monthly',
          next_date: new Date().toISOString(),
          status: 'active' as const
        },
        {
          id: 'rec-exp-1',
          description: 'Aluguel',
          amount_cents: 5000,
          transaction_type: 'EXPENSE' as const,
          frequency: 'monthly',
          next_date: new Date().toISOString(),
          status: 'active' as const
        }
      ];

      const resultMonth1 = calculateMonthlyOutlook({
        accounts,
        scheduledIncomeCents: 50000,
        scheduledExpensesCents: 30000,
        recurringIncomeCents: 10000,
        recurringExpensesCents: 5000,
        recurringTransactions,
        budgets: [],
        netLiquidityCents: 100000,
        monthOffset: 1
      });
      // Saldo de partida de Julho deve ser o final de Junho (120000)
      // E os ativos totais no fim de Julho devem ser 120000 + 10000 - 5000 = 125000
      expect(resultMonth1.totalAssets).toBe(125000);
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

    it('deve calcular o impacto positivo de uma receita extra', () => {
      const result = simulateDetailedImpact({
        amountCents: 50000, // R$ 500
        installments: 1,
        netLiquidityCents: 100000,
        monthlySurplus: 50000,
        currentExitDate: null,
        currentBalanceCents: 100000,
        type: 'INCOME'
      });
      expect(result.status).toBe('SAFE');
      expect(result.new_balance_cents).toBe(150000); // R$ 1.000 + R$ 500 = R$ 1.500
      expect(result.new_net_liquidity_cents).toBe(150000);
      expect(result.message).toContain('Excelente!');
    });

    it('deve simular receita acelerando a saida de dividas', () => {
      // Cliente endividado em R$ 1.500 (-150000 cents), sobra de R$ 500 (50000 cents)
      // Tempo original para sair da divida: 1500 / 500 = 3 meses.
      // Entra uma receita extra a vista de R$ 500 (50000 cents). Nova divida liquida: R$ 1.000.
      // Novo tempo para sair da divida: 1000 / 500 = 2 meses.
      // Aceleração: -1 mes!
      const currentExitDate = new Date();
      currentExitDate.setMonth(currentExitDate.getMonth() + 3);

      const result = simulateDetailedImpact({
        amountCents: 50000,
        installments: 1,
        netLiquidityCents: -150000,
        monthlySurplus: 50000,
        currentExitDate,
        currentBalanceCents: 50000,
        type: 'INCOME'
      });

      expect(result.debt_exit_delay_months).toBe(-1); // Acelera em 1 mes!
      expect(result.message).toContain('acelerará sua saída das dívidas em 1 mês');
    });

    it('deve calcular taxa de juros implícita, CET e veredito inteligente de empréstimo', () => {
      const result = simulateDetailedImpact({
        amountCents: 92000,
        installments: 1,
        netLiquidityCents: -50000,
        monthlySurplus: 20000,
        currentExitDate: null,
        currentBalanceCents: 10000,
        type: 'INCOME',
        loanInstallmentCents: 36726,
        loanInstallmentsCount: 3
      });

      expect(result.loan_cet_percentage).toBeGreaterThan(0);
      expect(result.loan_monthly_interest_rate).toBeGreaterThan(0);
      expect(result.loan_verdict_message).toBeDefined();
      expect(result.loan_total_interest_cents).toBe((36726 * 3) - 92000);
      expect(result.loan_monthly_interest_rate! * 100).toBeCloseTo(9.59, 1);
      expect(result.is_debt_swap_advantageous).toBe(true);
      expect(result.status).toBe('SAFE');
      expect(result.message).toContain('Compensa!');
    });
  });

  describe('calculateAdvancedProjection', () => {
    const recurringTransactions: any[] = [
      { amount_cents: 500000, transaction_type: "INCOME", status: "active" },
      { amount_cents: 300000, transaction_type: "EXPENSE", status: "active" }
    ];
    const budgets: any[] = [{ amount_cents: 50000 }];

    it('deve acumular saldo corretamente ao longo de 3 meses', () => {
      // Sobra mensal = 5000 - 3000 - 500 = 1500
      // 3 meses = 4500
      const result = calculateAdvancedProjection({
        liquidityHealthGuard: 100000,
        currentAssetsCents: 100000,
        recurringTransactions,
        futureTransactions: [],
        goals: [],
        budgets,
        monthOffset: 3
      });
      expect(result.projectedBalance).toBe(100000 + (150000 * 3));
    });

    it('deve retornar saldo atual se offset for 0', () => {
      const result = calculateAdvancedProjection({
        liquidityHealthGuard: 100000,
        currentAssetsCents: 100000,
        recurringTransactions,
        futureTransactions: [],
        goals: [],
        budgets,
        monthOffset: 0
      });
      expect(result.projectedBalance).toBe(100000);
    });

    it('deve aplicar sweep automático de dívida na Time Machine se houver reserva configurada', () => {
      const result = calculateAdvancedProjection({
        liquidityHealthGuard: 50000,
        currentAssetsCents: 100000,
        recurringTransactions,
        futureTransactions: [],
        goals: [],
        budgets,
        monthOffset: 1,
        accounts: mockAccounts,
        survivalReserveCents: 100000
      });
      
      expect(result.projectedBalance).toBe(200000);
    });

    it('deve propagar impacto de simulação à vista do mês 0 nos meses futuros', () => {
      const result = calculateAdvancedProjection({
        currentNetLiquidity: 100000,
        currentAssetsCents: 200000,
        recurringTransactions,
        futureTransactions: [],
        goals: [],
        budgets,
        monthOffset: 2,
        activeSimulations: [
          { amount_cents: 50000, installments: 1, type: "EXPENSE" }
        ],
        accounts: mockAccounts
      });
      // Saldo parte de 200000 - 50000 (gasto no mês 0) = 150000
      // + 2 meses de sobra (150000 * 2) = 300000
      // Total: 150000 + 300000 = 450000
      expect(result).toBe(450000);
    });
  });

  describe('calculateAntifragilityTier', () => {
    it('deve retornar Tier 0 (Crise) quando a liquidez for negativa', () => {
      expect(calculateAntifragilityTier(-50000, 100000)).toBe(0);
      expect(calculateAntifragilityTier(-1, 200000)).toBe(0);
    });

    it('deve retornar Tier 1 (Sobrevivente) se a cobertura de despesas for menor que 3 meses', () => {
      expect(calculateAntifragilityTier(200000, 100000)).toBe(1);
      expect(calculateAntifragilityTier(0, 100000)).toBe(1);
    });

    it('deve retornar Tier 2 (Imune) se a cobertura for entre 3 e 6 meses', () => {
      expect(calculateAntifragilityTier(400000, 100000)).toBe(2);
      expect(calculateAntifragilityTier(300000, 100000)).toBe(2);
    });

    it('deve retornar Tier 3 (Antifrágil) se a cobertura for maior ou igual a 6 meses', () => {
      expect(calculateAntifragilityTier(800000, 100000)).toBe(3);
      expect(calculateAntifragilityTier(600000, 100000)).toBe(3);
    });
  });
});

