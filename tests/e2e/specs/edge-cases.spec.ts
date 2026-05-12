import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createInitialState } from '../fixtures/financialState';

test.describe('Cenários de Borda e Resiliência (Blindagem)', () => {
  const USER_ID = 'edge-user';

  test.beforeEach(async ({ page, context }) => {
    await setupAuthMock(page, { id: USER_ID });
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: USER_ID,
      domain: 'localhost',
      path: '/'
    }]);
  });

  test('deve exibir empty state quando não há contas cadastradas', async ({ page }) => {
    const emptyState = createInitialState();
    emptyState.accounts = [];
    emptyState.user_profile.accumulated_balance_cents = 0;
    emptyState.user_profile.financial_health_score = 0;
    
    await setupFinancialMocks(page, emptyState);
    await page.goto('/');

    // Verificar se exibe valor zerado sem quebrar
    await expect(page.getByTestId('net-liquidity-value')).toContainText('0,00');
  });

  test('deve lidar com erro 500 da API e mostrar estado de erro ou cache', async ({ page }) => {
    // Interceptar a rota de estado financeiro e forçar erro 500
    await page.route('**/api/financial-state*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/');
    
    // O app deve lidar com o erro sem dar White Screen of Death
    // Verificamos se o container principal do Dashboard ainda é renderizado através de um elemento estável
    await expect(page.getByTestId('net-liquidity-value')).toBeVisible();
  });

  test('deve permitir criar meta com valor mínimo e validar integridade', async ({ page }) => {
    const state = createInitialState();
    await setupFinancialMocks(page, state);
    await page.goto('/goals');
    
    // Aguardar o loading do context desaparecer
    await expect(page.getByText(/Sincronizando/i)).not.toBeVisible({ timeout: 15000 });

    // Usar test-ids do GoalsPage e garantir que o elemento está pronto
    const addButton = page.getByTestId('add-goal-button').first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    await page.getByTestId('goal-name-input').fill('Meta Mínima');
    await page.getByTestId('goal-target-input').fill('0,01'); // Valor mínimo
    await page.getByTestId('goal-submit-button').click();

    await expect(page.getByTestId('goal-card-title').filter({ hasText: 'Meta Mínima' })).toBeVisible();
  });
});
