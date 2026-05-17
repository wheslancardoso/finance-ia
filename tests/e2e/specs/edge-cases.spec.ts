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

  test('deve criar parcelamento de cartão de crédito no dia 31 de janeiro de 2026 sem transbordo de dia', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-cc-1', name: 'Cartão Premium', type: 'CREDIT_CARD', balance_cents: 0, closing_day: 31, due_day: 10 }
      ],
      categories: [
        { id: 'cat-1', name: 'Lazer', type: 'EXPENSE' }
      ]
    });
    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

    const openAddModal = async () => {
      const desktopBtn = page.getByTestId('add-transaction-button');
      if (await desktopBtn.isVisible()) {
        await desktopBtn.click();
      } else {
        const mobileBtn = page.getByTestId('mobile-add-button');
        await mobileBtn.waitFor({ state: 'visible' });
        await mobileBtn.click();
      }
    };

    await openAddModal();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();

    await page.getByTestId('transaction-amount-input').fill('500,00');
    await page.getByTestId('transaction-description-input').fill('Compra Parcelada Teste');

    // Selecionar Conta 'Cartão Premium'
    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-cc-1').click();

    // Selecionar Categoria 'Lazer'
    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    // Inserir 5 parcelas
    await page.getByTestId('transaction-installments-input').fill('5');

    // Inserir Data 31/01/2026
    await page.getByTestId('transaction-date-input').fill('2026-01-31');

    // Submeter
    await page.getByTestId('transaction-submit-button').click();

    // Aguardar fechar o modal
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    // Validar as datas geradas no mock state
    const mockState = await page.evaluate(() => (window as any).__E2E_MOCK_STATE__);
    expect(mockState).toBeDefined();
    
    const transactions = mockState.transactions.filter((t: any) => t.description === 'Compra Parcelada Teste');
    expect(transactions.length).toBe(5);

    // Certificar as datas de cada uma das 5 parcelas
    const dates = transactions.map((t: any) => t.date.split('T')[0]).sort();
    expect(dates[0]).toBe('2026-01-31');
    expect(dates[1]).toBe('2026-02-28');
    expect(dates[2]).toBe('2026-03-31');
    expect(dates[3]).toBe('2026-04-30');
    expect(dates[4]).toBe('2026-05-31');
  });
});
