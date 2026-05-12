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
          accounts: [],
          transactions: [],
          goals: [],
          budgets: [],
          subscriptions: [],
          loading: false,
          refreshData: async () => {},
          scheduledIncomeCents: 0,
          scheduledExpensesCents: 0,
          recurringIncomeCents: 500000,
          recurringExpensesCents: 300000,
          healthScore: 85
        }}>
          <Story />
        </FinancialDataContext.Provider>
      </div>
    ),
  ],
};

export default preview;