import type { Meta, StoryObj } from '@storybook/react';
import SurvivalHUD from '../components/SurvivalHUD';
import { FinancialDataContext } from '../context/FinancialDataContext';

const meta: Meta<typeof SurvivalHUD> = {
  title: 'Dashboard/SurvivalHUD',
  component: SurvivalHUD,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SurvivalHUD>;

const baseContext = {
  categories: [],
  accounts: [],
  transactions: [],
  goals: [],
  budgets: [],
  recurringTransactions: [],
  recentTransactions: [],
  monthTransactions: [],
  futureTransactions: [],
  allTransactions: [],
  loading: false,
  refreshData: async () => {},
  lastFetched: Date.now(),
  monthlyIncomeCents: 0,
  setMonthlyIncomeCents: () => {},
  fixedExpensesCents: 0,
  setFixedExpensesCents: () => {},
  extraIncomeCents: 0,
  currentMonthExpensesCents: 0,
  accumulatedBalanceCents: 0,
  recurringIncomeCents: 0,
  recurringExpensesCents: 0,
  healthScore: 0,
  scheduledIncomeCents: 0,
  scheduledExpensesCents: 0,
  cardDebtImpactCents: 0,
  totalConsolidatedDebtCents: 0,
  netLiquidityCents: 0,
  primaryIncomeCents: 0,
  userId: 'mock-user',
  toggleTransactionPaid: async () => {},
  upsertTransaction: async () => ({}),
  deleteTransaction: async () => {},
  deleteTransactionSeries: async () => {},
  updateTransactionSeries: async () => {},
  createInstallmentSeries: async () => {},
  upsertAccount: async () => {},
  deleteAccount: async () => {},
  upsertGoal: async () => ({}),
  updateGoalBalance: async () => {},
  simulatePurchaseImpact: async () => ({
    current_surplus_cents: 0,
    simulated_surplus_cents: 0,
    status: 'SAFE' as const,
    message: '',
    impact_percentage: 0
  }),
  getGoalRecommendations: async () => ({
    surplus_cents: 0,
    real_surplus_cents: 0,
    recommendations: []
  }),
  getIncomeMix: () => [],
  getNetWorthHistory: () => [],
  createTransfer: async () => {},
  skipRecurringOccurrence: async () => {},
  deleteRecurringTransaction: async () => {},
  isGamificationEnabled: false,
  setGamificationEnabled: () => {},
  payRecurringOccurrence: async () => {},
  survivalReserveCents: 0,
  setSurvivalReserveCents: () => {},
  weeklyLimitOverrideCents: 0,
  setWeeklyLimitOverrideCents: () => {},
};

export const Healthy: Story = {
  decorators: [
    (Story) => (
      <FinancialDataContext.Provider value={{
        ...baseContext,
        accounts: [
          { id: '1', user_id: 'mock-user', name: 'Banco', type: 'CHECKING', balance_cents: 500000, color_hex: '#8b5cf6' }
        ],
        scheduledIncomeCents: 500000,
        scheduledExpensesCents: 200000,
        healthScore: 95
      }}>
        <Story />
      </FinancialDataContext.Provider>
    ),
  ],
};

export const SurvivalMode: Story = {
  decorators: [
    (Story) => (
      <FinancialDataContext.Provider value={{
        ...baseContext,
        accounts: [
          { id: '1', user_id: 'mock-user', name: 'Dívida', type: 'CREDIT_CARD', balance_cents: -800000, color_hex: '#ef4444' }
        ],
        scheduledIncomeCents: 100000,
        scheduledExpensesCents: 500000,
        healthScore: 30
      }}>
        <Story />
      </FinancialDataContext.Provider>
    ),
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => (
      <FinancialDataContext.Provider value={{
        ...baseContext,
        loading: true
      }}>
        <Story />
      </FinancialDataContext.Provider>
    ),
  ],
};
