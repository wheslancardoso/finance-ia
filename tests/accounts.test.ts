import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Gestão de Contas', () => {
  let sharedState: any;


  test.beforeEach(async ({ page }) => {
    sharedState = {
      user_profile: {
        id: '2a8d83e2-17b5-434d-91d9-2a963bc841da',
        monthly_income_cents: 500000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 100000,
      },
      accounts: [
        { 
          id: '550e8400-e29b-41d4-a716-446655440003', 
          name: 'Nubank Principal', 
          type: 'CHECKING', 
          balance_cents: 100000, 
          color_hex: '#8b5cf6' 
        }
      ],
      categories: [],
      transactions: [],
      goals: [],
      recurring_transactions: [],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };

    await setupFinancialMocks(page, sharedState);

    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', '2a8d83e2-17b5-434d-91d9-2a963bc841da');
    });

    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
  });

  test('deve criar uma nova conta corrente e verificar atualização do dashboard', async ({ page }) => {
    await page.getByTestId('add-account-button').click();
    await expect(page.getByTestId('add-account-modal')).toBeVisible();

    await page.getByTestId('account-name-input').fill('Investimentos XP');
    await page.getByTestId('account-type-SAVINGS').click();
    await page.getByTestId('account-balance-input').fill('5000,00');
    
    await page.getByTestId('account-submit-button').click();
    await expect(page.getByTestId('add-account-modal')).not.toBeVisible();

    // Verificar na lista de contas
    await expect(page.locator('text=Investimentos XP')).toBeVisible();
    await expect(page.locator('text=R$ 5.000,00')).toBeVisible();

    // Verificar no Dashboard (HUD de Liquidez Real)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Liquidez Real = acc-1 (1000) + nova conta (5000) = 6000
    await expect(page.getByTestId('net-liquidity-value')).toContainText('6.000,00');
  });

  test('deve criar um cartão de crédito e validar campos específicos', async ({ page }) => {
    await page.getByTestId('add-account-button').click();
    await page.getByTestId('account-type-CREDIT_CARD').click();

    await page.getByTestId('account-name-input').fill('Visa Infinite');
    await page.getByTestId('account-limit-input').fill('10000,00');
    await page.getByTestId('account-closing-day-input').fill('5');
    
    // O vencimento deve ser preenchido automaticamente (5 + 7 = 12)
    await expect(page.getByTestId('account-due-day-input')).toHaveValue('12');

    await page.getByTestId('account-submit-button').click();
    await expect(page.locator('text=Visa Infinite')).toBeVisible();
    await expect(page.locator('text=Total: R$ 10.000,00')).toBeVisible();
  });

  test('deve editar uma conta existente', async ({ page }) => {
    const card = page.getByTestId('account-card-550e8400-e29b-41d4-a716-446655440003');
    await card.getByTestId('action-menu-button').click();
    await page.getByTestId('action-edit-button').click();

    await page.getByTestId('account-name-input').fill('Nubank Atualizado');
    await page.getByTestId('account-balance-input').fill('1500,00');
    await page.getByTestId('account-submit-button').click();

    await expect(page.getByTestId('account-card-550e8400-e29b-41d4-a716-446655440003')).toContainText('Nubank Atualizado');
    await expect(page.getByTestId('account-card-550e8400-e29b-41d4-a716-446655440003')).toContainText('1.500,00');
  });

  test('deve excluir uma conta e atualizar liquidez', async ({ page }) => {
    // Verificar liquidez inicial
    await page.goto('/');
    await expect(page.getByTestId('net-liquidity-value')).toContainText('1.000,00');
    
    await page.goto('/accounts');
    const card = page.getByTestId('account-card-550e8400-e29b-41d4-a716-446655440003');
    await card.getByTestId('action-menu-button').click();
    await page.getByTestId('action-delete-button').click();

    // Confirmar exclusão
    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('account-card-550e8400-e29b-41d4-a716-446655440003')).not.toBeVisible();

    // Verificar liquidez zerada no dashboard
    await page.goto('/');
    await expect(page.getByTestId('net-liquidity-value')).toContainText('0,00');
  });
});
