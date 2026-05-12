import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';

// Mock do Contexto Financeiro para o Storybook
import { FinancialDataContext } from '../src/context/FinancialDataContext';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#050505' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="dark text-white bg-[#050505] min-h-screen p-8">
        <FinancialDataContext.Provider value={{
          categories: [],
          accounts: [],
          transactions: [],
          goals: [],
          budgets: [],
          recurringTransactions: [],
          recentTransactions: [],
          monthTransactions: [],
          futureTransactions: [],
          loading: false,
          refreshData: async () => {},
          lastFetched: Date.now(),
          monthlyIncomeCents: 500000,
          setMonthlyIncomeCents: () => {},
          fixedExpensesCents: 300000,
          setFixedExpensesCents: () => {},
          extraIncomeCents: 0,
          currentMonthExpensesCents: 0,
          accumulatedBalanceCents: 500000,
          recurringIncomeCents: 500000,
          recurringExpensesCents: 300000,
          healthScore: 85,
          scheduledIncomeCents: 0,
          scheduledExpensesCents: 0,
          cardDebtImpactCents: 0,
          totalConsolidatedDebtCents: 0,
          netLiquidityCents: 500000,
          primaryIncomeCents: 500000,
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
            status: 'SAFE',
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
        }}>
          <Story />
        </FinancialDataContext.Provider>
      </div>
    ),
  ],
};

export default preview;