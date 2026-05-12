import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthPage } from '../pages/AuthPage';
import { createDashboardState, stateUser2, createInitialState } from '../fixtures/financialState';

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

    // Ocultar o overlay do Next.js
    await page.addStyleTag({ 
      content: '[data-nextjs-dev-overlay], nextjs-portal { display: none !important; pointer-events: none !important; }' 
    });
  });

  test('deve carregar e salvar diretrizes de perfil', async ({ page, context }) => {
    const settingsPage = new SettingsPage(page);
    const auth = new AuthPage(page);

    await setupAuthMock(page, { id: 'user-1' });
    
    await settingsPage.goto();
    await auth.expectLoggedIn();
    
    await settingsPage.expectProfileValues('5000,00', '2000,00');
    
    // Salvar novos valores
    await settingsPage.updateProfile('6000,00', '2500,00');
    await settingsPage.expectSaveSuccess();
    
    // Recarregar e verificar
    await page.reload();
    await settingsPage.expectProfileValues('6000,00', '2500,00');
  });

  test('deve trocar de usuário e carregar dados diferentes', async ({ page, context }) => {
    const settings = new SettingsPage(page);
    const auth = new AuthPage(page);
    
    // User 1 State (Saldo de 1.000,00)
    const user1State = createDashboardState({
      user_profile: {
        monthly_income_cents: 500000,
        fixed_expenses_cents: 200000,
      },
      accounts: [{ id: 'acc-1', name: 'Conta 1', type: 'CHECKING', balance_cents: 100000, color_hex: '#8b5cf6' }],
      recurring_transactions: []
    });
    
    await setupAuthMock(page, { id: 'user-1' });
    await setupFinancialMocks(page, user1State);
    await page.goto('/');
    
    await expect(async () => {
      await expect(page.getByTestId('net-liquidity-value')).toContainText('1.000,00');
    }).toPass({ timeout: 10000 });

    // Verificar valores do User 1
    await settings.goto();
    await settings.expectProfileValues('5000,00', '2000,00');

    // Trocar para User 2
    await auth.logout();
    await setupAuthMock(page, { id: 'user-2' });
    await context.addCookies([{ name: 'sb-mock-user-id', value: 'user-2', domain: 'localhost', path: '/' }]);
    
    // Novo Mock para User 2
    const state2 = createInitialState();
    state2.user_profile.monthly_income_cents = 600000;
    state2.user_profile.fixed_expenses_cents = 300000;
    await setupFinancialMocks(page, state2);
    
    await page.goto('/login'); // Garantir que está limpo
    await page.goto('/settings');
    
    await expect(async () => {
      await settings.expectProfileValues('6000,00', '3000,00');
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
