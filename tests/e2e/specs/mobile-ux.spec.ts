import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createInitialState } from '../fixtures/financialState';

test.describe('Experiência Mobile (UX Blindada)', () => {
  const USER_ID = 'mobile-user';

  test.beforeEach(async ({ page, context }) => {
    // Forçar viewport mobile se não estiver usando o projeto mobile-chrome
    // Mas o Playwright recomenda usar os projetos do config.
    await setupAuthMock(page, { id: USER_ID });
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: USER_ID,
      domain: 'localhost',
      path: '/'
    }]);

    const state = createInitialState();
    await setupFinancialMocks(page, state);
  });

  test('deve navegar entre páginas usando a barra inferior no mobile', async ({ page }) => {
    // Ir direto para Metas
    await page.goto('/goals');
    await page.waitForURL('**/goals');
    
    // Verificar que a Sidebar está oculta
    await expect(page.locator('aside')).toBeHidden();

    // Navegar de volta para Início usando a barra inferior
    const homeLink = page.getByTestId('mobile-nav-home');
    await expect(homeLink).toBeVisible();
    await homeLink.click({ force: true });
    
    await page.waitForURL(url => url.pathname === '/', { timeout: 10000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('deve abrir o modal de nova transação pelo botão central', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no botão central "+"
    await page.getByTestId('mobile-add-button').click({ force: true });

    // Verificar se o modal abriu
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();
  });
});
