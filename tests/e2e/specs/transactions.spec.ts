import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { TransactionsPage } from '../pages/TransactionsPage';
import { createInitialState } from '../fixtures/financialState';

test.describe('Auditoria de Transações (Refatorado)', () => {
  const USER_ID = 'trans-user';
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = createInitialState({
      transactions: [
        { id: 't1', description: 'Mercado Central', amount_cents: -15000, date: new Date().toISOString(), category: 'Food', account_id: 'acc-1', user_id: USER_ID },
        { id: 't2', description: 'Assinatura Netflix', amount_cents: -5590, date: new Date().toISOString(), category: 'Entertainment', account_id: 'acc-1', user_id: USER_ID },
        { id: 't3', description: 'Pix Recebido', amount_cents: 200000, date: new Date().toISOString(), category: 'Income', account_id: 'acc-1', user_id: USER_ID }
      ]
    });
    await setupFinancialMocks(page, mockState);
    await setupAuthMock(page, { id: USER_ID });
  });

  test('deve listar transações e filtrar por busca', async ({ page }) => {
    const transPage = new TransactionsPage(page);
    await transPage.goto();
    
    await expect(async () => {
      await transPage.expectTransactionVisible('Mercado Central');
      await transPage.expectTransactionVisible('Assinatura Netflix');
    }).toPass({ timeout: 10000 });
    
    await transPage.filterByText('Netflix');
    
    await expect(async () => {
      await transPage.expectTransactionVisible('Assinatura Netflix');
      await expect(page.getByText('Mercado Central')).not.toBeVisible();
    }).toPass({ timeout: 10000 });
  });
});
