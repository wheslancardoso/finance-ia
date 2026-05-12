import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';
import { setupAuthMock } from './mocks/authMocks';

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
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        Object.assign(sharedState.user_profile, payload);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, ...payload }),
        });
      } else {
        await route.continue();
      }
    });

    await setupFinancialMocks(page, sharedState);
  });

  test('deve carregar e salvar diretrizes de perfil', async ({ page }) => {
    await setupAuthMock(page, { id: 'user-1' });
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // O botão 'Sair da Conta' é um sinal seguro de que o Auth resolveu
    await expect(page.getByRole('button', { name: /Sair da Conta/i })).toBeVisible({ timeout: 15000 });

    const incomeInput = page.getByTestId('profile-income-input');
    const expensesInput = page.getByTestId('profile-expenses-input');
    
    await expect(incomeInput).toHaveValue('5000', { timeout: 15000 });
    await expect(expensesInput).toHaveValue('2000', { timeout: 15000 });

    await incomeInput.fill('6000');
    await expensesInput.fill('2500');
    await page.getByTestId('profile-save-button').click();

    await expect(page.getByText('Configurações Salvas')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /Sair da Conta/i })).toBeVisible();
    
    await expect(page.getByTestId('profile-income-input')).toHaveValue('6000');
    await expect(page.getByTestId('profile-expenses-input')).toHaveValue('2500');
  });

  test('deve trocar de usuário e carregar dados diferentes', async ({ page }) => {
    await setupAuthMock(page, { id: 'user-1' });
    
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

    // Aplicar mocks para User 2 ANTES de configurar o novo auth
    await page.unroute('**/api/financial-state*');
    await setupFinancialMocks(page, stateUser2);
    
    // Trocar usuário
    await setupAuthMock(page, { id: 'user-2' });
    
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('net-liquidity-value')).toContainText('2.000,00', { timeout: 10000 });
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-income-input')).toHaveValue('8000');
  });

  test('deve deslogar e redirecionar para login', async ({ page }) => {
    await setupAuthMock(page, { id: 'user-1' });
    await page.goto('/');
    await page.getByText('Sair da Conta').click();
    
    // Ao deslogar via UI, o app deve chamar supabase.auth.signOut()
    // Como estamos com mocks, precisamos garantir que o redirecionamento aconteça
    await expect(page).toHaveURL(/\/login/);
  });
});
