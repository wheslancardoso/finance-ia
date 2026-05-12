import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { SubscriptionsPage } from '../pages/SubscriptionsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Gerenciamento de Assinaturas (Refatorado)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = createDashboardState({
      accounts: [
        { id: 'acc-sub-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 1000000, color_hex: '#10b981' }
      ],
      recurring_transactions: []
    });

    await setupAuthMock(page, { id: 'user-1' });
    await setupFinancialMocks(page, mockState);
  });

  test('deve criar uma nova assinatura e verificar impacto no Dashboard', async ({ page }) => {
    const subscriptions = new SubscriptionsPage(page);

    await subscriptions.goto();
    await page.waitForLoadState('networkidle');

    await subscriptions.addSubscription('Netflix', '55,90');

    // Verificar se aparece na lista
    await expect(page.getByText('Netflix')).toBeVisible();

    // Verificar impacto no Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Liquidez 10.000,00 - Netflix 55,90 = 9.944,10
    await expect(page.getByTestId('survival-ceiling-value')).toContainText('9.944,10', { timeout: 10000 });
  });

  test('deve editar uma assinatura existente', async ({ page }) => {
    const subscriptions = new SubscriptionsPage(page);
    const subId = 'sub-edit-1';

    mockState.recurring_transactions.push({
      id: subId,
      description: 'Spotify',
      amount_cents: 2000,
      transaction_type: 'EXPENSE',
      account_id: 'acc-sub-1',
      status: 'active',
      next_date: new Date().toISOString(),
      frequency: 'monthly'
    });

    await subscriptions.goto();
    await page.waitForLoadState('networkidle');
    
    // Abrir edição
    await page.getByTestId(`edit-subscription-${subId}`).click();
    await page.getByTestId('subscription-amount-input').fill('34,90');
    await page.getByTestId('subscription-submit-button').click();
    
    await page.getByTestId('status-modal-close').click();
    
    // Verificar se o valor foi atualizado na lista
    await expect(page.getByTestId(`subscription-card-${subId}`)).toContainText('34,90', { timeout: 10000 });
  });

  test('deve pausar e excluir uma assinatura', async ({ page }) => {
    const subscriptions = new SubscriptionsPage(page);
    const subId = 'sub-delete-1';

    mockState.recurring_transactions.push({
      id: subId,
      description: 'Academia',
      amount_cents: 10000,
      transaction_type: 'EXPENSE',
      account_id: 'acc-sub-1',
      status: 'active',
      next_date: new Date().toISOString(),
      frequency: 'monthly'
    });

    await subscriptions.goto();
    await page.waitForLoadState('networkidle');
    
    // Pausar
    await page.getByTestId(`toggle-status-${subId}`).click();
    await expect(page.getByTestId(`toggle-status-${subId}`)).toContainText('Ativar', { timeout: 10000 });
    
    // Excluir
    await page.getByTestId(`delete-subscription-${subId}`).click();
    await page.getByTestId('confirm-button').click();
    
    await expect(page.getByText('Academia')).not.toBeVisible({ timeout: 15000 });
  });
});
