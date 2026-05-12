import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthPage } from '../pages/AuthPage';
import { createDashboardState, stateUser2 } from '../fixtures/financialState';

test.describe('Autenticação e Perfil (Refatorado)', () => {
  let sharedState: any;

  test.beforeEach(async ({ page, context }) => {
    sharedState = createDashboardState({
      user_profile: {
        monthly_income_cents: 500000,
        fixed_expenses_cents: 200000,
      }
    });

    await setupFinancialMocks(page, sharedState);
    
    // Default mock user
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: 'user-1',
      domain: 'localhost',
      path: '/'
    }]);
  });

  test('deve carregar e salvar diretrizes de perfil', async ({ page, context }) => {
    const settings = new SettingsPage(page);
    const auth = new AuthPage(page);

    await setupAuthMock(page, { id: 'user-1' });
    
    await settings.goto();
    await auth.expectLoggedIn();
    
    await settings.expectProfileValues('5000', '2000');

    await settings.fillProfile('6000', '2500');
    const response = await settings.saveProfile();

    expect(response.status()).toBe(200);
    await settings.expectSaveSuccess();

    await page.reload();
    await auth.expectLoggedIn();
    await settings.expectProfileValues('6000', '2500');
  });

  test('deve trocar de usuário e carregar dados diferentes', async ({ page, context }) => {
    const settings = new SettingsPage(page);
    
    // User 1 State (Saldo de 1.000,00)
    const user1State = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta 1', type: 'CHECKING', balance_cents: 100000, color_hex: '#8b5cf6' }],
      recurring_transactions: []
    });
    
    await setupAuthMock(page, { id: 'user-1' });
    await setupFinancialMocks(page, user1State);
    await page.goto('/');
    
    await expect(async () => {
      await expect(page.getByTestId('net-liquidity-value')).toContainText('1.000,00');
    }).toPass({ timeout: 10000 });

    // Trocar mocks para User 2 (Saldo de 2.000,00)
    const user2State = createDashboardState({
      accounts: [{ id: 'acc-2', name: 'Conta 2', type: 'CHECKING', balance_cents: 200000, color_hex: '#ffffff' }],
      recurring_transactions: []
    });
    
    // Limpar TODOS os mocks anteriores antes de registrar os novos
    await page.unroute('**/api/**');
    
    await setupFinancialMocks(page, user2State);
    await setupAuthMock(page, { id: 'user-2' });
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: 'user-2',
      domain: 'localhost',
      path: '/'
    }]);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('net-liquidity-value')).toContainText('2.000,00', { timeout: 10000 });
    
    await settings.goto();
    await page.waitForLoadState('networkidle');
    await settings.updateProfile('6000', '3000');
    
    // Validar que a UI refletiu ou que o comando foi enviado
    await expect(async () => {
      await settings.expectProfileValues('6000', '3000');
    }).toPass({ timeout: 10000 });
  });

  test('deve deslogar e redirecionar para login', async ({ page, context }) => {
    const auth = new AuthPage(page);

    await setupAuthMock(page, { id: 'user-1' });
    await page.goto('/');
    
    await auth.logout();
    await context.clearCookies({ name: 'sb-mock-user-id' });
    await auth.expectLoggedOut();
  });
});
