export const createInitialState = (overrides = {}) => ({
  user_profile: {
    monthly_income_cents: 0,
    fixed_expenses_cents: 0,
    accumulated_balance_cents: 0,
    financial_health_score: 100,
  },
  accounts: [],
  categories: [
    { id: 'cat-1', name: 'Gasto', type: 'EXPENSE', color_hex: '#ff0000', user_id: 'mock-user' },
    { id: 'cat-2', name: 'Renda', type: 'INCOME', color_hex: '#00ff00', user_id: 'mock-user' }
  ],
  goals: [],
  recurring_transactions: [],
  budgets: [],
  transactions: [],
  ...overrides
});

export const stateUser2 = createInitialState({
  user_profile: {
    id: 'user-2',
    monthly_income_cents: 800000,
    fixed_expenses_cents: 300000,
    accumulated_balance_cents: 200000,
  },
  accounts: [
    { id: 'acc-2', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, color_hex: '#ffffff' }
  ]
});
export const createDashboardState = (overrides = {}) => {
  // O Playwright mocka o relógio para 2026-05-07T12:00:00Z na maioria dos testes e2e
  // Usar uma data fixa compatível garante que as recurring transactions 
  // caiam no mesmo mês (Maio) que a UI está renderizando no teste.
  const futureDate = "2026-05-28T12:00:00.000Z";
  
  return createInitialState({
    user_profile: {
      monthly_income_cents: 500000, // 5k
      fixed_expenses_cents: 0,      // Zerado para não duplicar com as recorrentes abaixo
      accumulated_balance_cents: 0, 
      financial_health_score: 85,
    },
    recurring_transactions: [
      {
        id: 'rec-income-1',
        description: 'Salário',
        amount_cents: 500000,
        transaction_type: 'INCOME',
        status: 'active',
        next_date: futureDate,
        frequency: 'monthly'
      },
      {
        id: 'rec-expense-1',
        description: 'Gasto de Teste',
        amount_cents: 200000,
        transaction_type: 'EXPENSE',
        status: 'active',
        next_date: futureDate,
        frequency: 'monthly'
      }
    ],
    accounts: [
      { id: 'acc-dash-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 0, color_hex: '#8b5cf6' }
    ],
    ...overrides
  });
};
