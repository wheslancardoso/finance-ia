import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Simulador de Impacto', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      user_profile: {
        monthly_income_cents: 1000000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 500000,
        financial_health_score: 85,
      },
      accounts: [
        { id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981' }
      ],
      categories: [],
      transactions: [],
      goals: [],
      recurring_transactions: [
        {
          id: 'rec-1',
          description: 'Salário',
          amount_cents: 1000000,
          transaction_type: 'INCOME',
          status: 'active',
          next_date: new Date(new Date().getTime() + 86400000).toISOString(),
          frequency: 'monthly'
        },
        {
          id: 'rec-2',
          description: 'Aluguel',
          amount_cents: 200000,
          transaction_type: 'EXPENSE',
          status: 'active',
          next_date: new Date(new Date().getTime() + 86400000).toISOString(),
          frequency: 'monthly'
        }
      ],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };

    await setupFinancialMocks(page, mockState);

    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', 'user-1');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Centro de Comando')).toBeVisible({ timeout: 20000 });
  });

  test('deve simular uma compra parcelada e salvar como meta', async ({ page }) => {
    const simulator = page.getByTestId('simulator-amount-input');
    await expect(simulator).toBeVisible();

    await simulator.fill('5000,00');
    await page.getByTestId('simulator-installments-select').selectOption('12');

    await expect(page.getByTestId('simulator-status-indicator')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=416,67')).toBeVisible();

    await page.getByTestId('simulator-save-button').click();

    await page.goto('/goals');
    await expect(page.locator('[data-testid="goal-card-title"]')).toHaveText(/Parcelamento:.*5.*000,00/, { timeout: 15000 });
  });
});
