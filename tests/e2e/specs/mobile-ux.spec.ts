import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createInitialState } from '../fixtures/financialState';

test.describe('Experiência Mobile (UX Blindada)', () => {
  const USER_ID = 'mobile-user';

  test.beforeEach(async ({ page, context, isMobile }) => {
    // Pular se não for mobile
    if (!isMobile) {
      test.skip();
    }
    
    await setupAuthMock(page, { id: USER_ID });
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: USER_ID,
      domain: 'localhost',
      path: '/'
    }]);

    const state = createInitialState();
    await setupFinancialMocks(page, state);

    // Ocultar o overlay do Next.js que bloqueia cliques se houver avisos de hidratação
    await page.addStyleTag({ 
      content: '[data-nextjs-dev-overlay], nextjs-portal { display: none !important; pointer-events: none !important; }' 
    });
  });

  test('deve navegar entre páginas usando a barra inferior no mobile', async ({ page }) => {
    // Ir direto para Metas
    await page.goto('/goals');
    await page.waitForURL('**/goals');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); 
    
    // Verificar que a Sidebar está oculta
    await expect(page.locator('aside')).toBeHidden();

    // Navegar de volta para Início usando a barra inferior
    const homeLink = page.getByRole('link', { name: /Início/i });
    await expect(homeLink).toBeVisible();
    
    // Usar dispatchEvent para garantir que o clique ocorra mesmo com overlays de dev
    await homeLink.dispatchEvent('click');
    
    await page.waitForURL(url => url.pathname === '/', { timeout: 15000 });
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
