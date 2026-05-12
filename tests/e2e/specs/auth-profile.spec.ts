import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthPage } from '../pages/AuthPage';
import { createInitialState, stateUser2 } from '../fixtures/financialState';

test.describe('Autenticação e Perfil (Refatorado)', () => {
  let sharedState: any;

  test.beforeEach(async ({ page }) => {
    sharedState = createInitialState();

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

  test('deve trocar de usuário e carregar dados diferentes', async ({ page }) => {
    const settings = new SettingsPage(page);
    
    await setupAuthMock(page, { id: 'user-1' });
    await page.goto('/');
    
    await expect(async () => {
      await expect(page.getByTestId('net-liquidity-value')).toContainText('1.000,00');
    }).toPass({ timeout: 10000 });

    // Trocar mocks para User 2
    await page.unroute('**/api/financial-state*');
    await setupFinancialMocks(page, stateUser2);
    await setupAuthMock(page, { id: 'user-2' });
    
    await page.reload();
    await expect(page.getByTestId('net-liquidity-value')).toContainText('2.000,00', { timeout: 10000 });
    
    await settings.updateProfile('6000', '3000');
    
    // Validar que a UI refletiu ou que o comando foi enviado
    await expect(async () => {
      await settings.expectProfileValues('6000', '3000');
    }).toPass({ timeout: 10000 });
  });

  test('deve deslogar e redirecionar para login', async ({ page }) => {
    const auth = new AuthPage(page);

    await setupAuthMock(page, { id: 'user-1' });
    await page.goto('/');
    
    await auth.logout();
    await auth.expectLoggedOut();
  });
});
