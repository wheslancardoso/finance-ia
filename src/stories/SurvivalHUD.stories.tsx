import type { Meta, StoryObj } from '@storybook/react';
import { SurvivalHUD } from '../src/components/SurvivalHUD';
import { FinancialDataContext } from '../src/context/FinancialDataContext';

const meta: Meta<typeof SurvivalHUD> = {
  title: 'Dashboard/SurvivalHUD',
  component: SurvivalHUD,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SurvivalHUD>;

export const Healthy: Story = {
  decorators: [
    (Story) => (
      <FinancialDataContext.Provider value={{
        accounts: [
          { id: '1', name: 'Banco', type: 'CHECKING', balance_cents: 500000, color_hex: '#8b5cf6' }
        ],
        transactions: [],
        goals: [],
        budgets: [],
        subscriptions: [],
        loading: false,
        refreshData: async () => {},
        scheduledIncomeCents: 500000,
        scheduledExpensesCents: 200000,
        recurringIncomeCents: 500000,
        recurringExpensesCents: 200000,
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
        accounts: [
          { id: '1', name: 'Dívida', type: 'CREDIT_CARD', balance_cents: -800000, color_hex: '#ef4444' }
        ],
        transactions: [],
        goals: [],
        budgets: [],
        subscriptions: [],
        loading: false,
        refreshData: async () => {},
        scheduledIncomeCents: 100000,
        scheduledExpensesCents: 500000,
        recurringIncomeCents: 100000,
        recurringExpensesCents: 500000,
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
        accounts: [],
        transactions: [],
        goals: [],
        budgets: [],
        subscriptions: [],
        loading: true,
        refreshData: async () => {},
        scheduledIncomeCents: 0,
        scheduledExpensesCents: 0,
        recurringIncomeCents: 0,
        recurringExpensesCents: 0,
        healthScore: 0
      }}>
        <Story />
      </FinancialDataContext.Provider>
    ),
  ],
};
