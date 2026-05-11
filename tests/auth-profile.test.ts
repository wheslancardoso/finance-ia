import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Autenticação e Perfil', () => {
  let sharedState: any;

  test.beforeEach(async ({ page }) => {
    sharedState = {
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
      budgets: []
    };

    // Mock API para salvar perfil
    await page.route('**/api/user-profile', async (route) => {
      const payload = route.request().postDataJSON();
      Object.assign(sharedState.user_profile, payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, ...payload }),
      });
    });

    await setupFinancialMocks(page, sharedState);
  });

  test('deve carregar e salvar diretrizes de perfil', async ({ page }) => {
    // Configurar localStorage MANUALMENTE sem usar init script persistente
    await page.goto('/login'); // Ir para uma página neutra primeiro
    await page.evaluate(() => localStorage.setItem('vesper_user_id', 'user-1'));
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const incomeInput = page.getByTestId('profile-income-input');
    const expensesInput = page.getByTestId('profile-expenses-input');
    
    await expect(incomeInput).toHaveValue('5000');
    await expect(expensesInput).toHaveValue('2000');

    await incomeInput.fill('6000');
    await expensesInput.fill('2500');
    await page.getByTestId('profile-save-button').click();

    await expect(page.getByText('Configurações Salvas')).toBeVisible();

    await page.reload();
    await expect(incomeInput).toHaveValue('6000');
    await expect(expensesInput).toHaveValue('2500');
  });

  test('deve trocar de usuário e carregar dados diferentes', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('vesper_user_id', 'user-1'));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('net-liquidity-value')).toContainText('1.000,00');

    // Novo estado para User 2
    const stateUser2 = {
      user_profile: {
        id: 'user-2',
        monthly_income_cents: 800000,
        fixed_expenses_cents: 300000,
        accumulated_balance_cents: 200000,
      },
      accounts: [
        { id: 'acc-2', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, color_hex: '#ffffff' }
      ],
      categories: [],
      transactions: [],
      goals: [],
      recurring_transactions: [],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };

    // Override route for User 2
    await page.unroute('**/api/financial-state*');
    await setupFinancialMocks(page, stateUser2);

    await page.evaluate(() => {
      localStorage.setItem('vesper_user_id', 'user-2');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('net-liquidity-value')).toContainText('2.000,00', { timeout: 10000 });
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-income-input')).toHaveValue('8000');
  });

  test('deve deslogar e redirecionar para login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('vesper_user_id', 'user-1'));
    await page.goto('/');
    await page.getByText('Sair da Conta').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
