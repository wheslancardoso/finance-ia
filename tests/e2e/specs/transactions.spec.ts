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
      accounts: [
        { id: 'acc-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 100000 }
      ],
      transactions: [
        { 
          id: 't1', 
          description: 'Mercado Central', 
          amount_cents: -15000, 
          date: new Date().toISOString(), 
          category: { name: 'Alimentação', color_hex: '#ef4444' }, 
          account: { name: 'Conta Principal' },
          account_id: 'acc-1', 
          user_id: USER_ID 
        },
        { 
          id: 't2', 
          description: 'Assinatura Netflix', 
          amount_cents: -5590, 
          date: new Date().toISOString(), 
          category: { name: 'Lazer', color_hex: '#8b5cf6' }, 
          account: { name: 'Conta Principal' },
          account_id: 'acc-1', 
          user_id: USER_ID 
        },
        { 
          id: 't3', 
          description: 'Pix Recebido', 
          amount_cents: 200000, 
          date: new Date().toISOString(), 
          category: { name: 'Renda', color_hex: '#10b981' }, 
          account: { name: 'Conta Principal' },
          account_id: 'acc-1', 
          user_id: USER_ID 
        }
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

  test('deve editar uma transação e persistir a mudança', async ({ page }) => {
    const transPage = new TransactionsPage(page);
    await transPage.goto();
    
    // Editar 'Mercado Central' para 'Supermercado Premium'
    await transPage.editTransaction('t1', 'Supermercado Premium');
    
    // Validar que a mudança foi refletida
    await expect(async () => {
      await expect(page.getByText(/Supermercado Premium/i).first()).toBeVisible();
    }).toPass({ timeout: 10000 });
    
    await expect(page.getByText(/Mercado Central/i)).not.toBeVisible();
  });
});
