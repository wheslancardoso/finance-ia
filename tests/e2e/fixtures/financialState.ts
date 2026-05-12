export const createInitialState = (overrides = {}) => {
  return {
    user_profile: {
      id: 'user-1',
      monthly_income_cents: 500000,
      fixed_expenses_cents: 200000,
      accumulated_balance_cents: 100000,
    },
    accounts: [
      { id: 'acc-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 100000, color_hex: '#ffffff' }
    ],
    categories: [],
    transactions: [],
    goals: [],
    recurring_transactions: [],
    month_transactions: [],
    recent_transactions: [],
    budgets: [],
    ...overrides
  };
};

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
