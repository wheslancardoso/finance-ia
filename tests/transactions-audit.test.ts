import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Auditoria de Transações', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      user_profile: {
        monthly_income_cents: 1000000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 1500000,
      },
      accounts: [
        { id: 'acc-1', name: 'Nubank', type: 'CHECKING', balance_cents: 1000000, color_hex: '#8b5cf6' }
      ],
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'EXPENSE', icon: 'Utensils', color: '#ef4444' }
      ],
      transactions: [
        {
          id: 'tx-1',
          description: 'Supermercado BH',
          amount_cents: 15000,
          transaction_type: 'EXPENSE',
          date: new Date().toISOString(),
          account_id: 'acc-1',
          category_id: 'cat-1',
          is_paid: false,
          category: { name: 'Alimentação' }
        },
        {
          id: 'tx-2',
          description: 'Aluguel Mensal',
          amount_cents: 250000,
          transaction_type: 'EXPENSE',
          date: new Date().toISOString(),
          account_id: 'acc-1',
          category_id: 'cat-1',
          is_paid: false,
          category: { name: 'Moradia' }
        }
      ],
      goals: [],
      recurring_transactions: [],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };
    mockState.month_transactions = [...mockState.transactions];

    await setupFinancialMocks(page, mockState);

    await page.route('**/api/transactions*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockState.transactions) });
      } else if (route.request().method() === 'DELETE') {
        const id = new URL(route.request().url()).searchParams.get('id');
        mockState.transactions = mockState.transactions.filter((t: any) => t.id !== id);
        mockState.month_transactions = mockState.month_transactions.filter((t: any) => t.id !== id);
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', '2a8d83e2-17b5-434d-91d9-2a963bc841da');
    });

    await page.goto('/transactions');
    await page.waitForSelector('.animate-spin', { state: 'detached' });
  });

  test('deve filtrar transações por busca de texto', async ({ page }) => {
    await expect(page.getByTestId(/^transaction-item-/)).toHaveCount(2);
    await page.getByTestId('transaction-search-input').fill('Aluguel');
    await expect(page.getByTestId(/^transaction-item-/)).toHaveCount(1);
    await expect(page.getByText('Aluguel Mensal')).toBeVisible();
  });

  test('deve abrir modal de edição ao clicar em uma transação', async ({ page }) => {
    // Localizar item de forma robusta
    const item = page.locator('div[data-testid="transaction-item-tx-1"]');
    await expect(item).toBeVisible();
    
    // Clicar no menu de ações
    const menuBtn = item.locator('button[data-testid="action-menu-button"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    
    // Esperar pelo texto "Editar" e clicar (usando toPass para lidar com animações do menu)
    await expect(async () => {
      const editBtn = page.getByText('Editar', { exact: false });
      await expect(editBtn).toBeVisible();
      await editBtn.click({ force: true });
    }).toPass({ timeout: 10000 });

    await expect(page.getByTestId('add-transaction-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('transaction-description-input')).toHaveValue('Supermercado BH');
  });

  test('deve excluir uma transação e atualizar a lista', async ({ page }) => {
    const item = page.locator('div[data-testid="transaction-item-tx-2"]');
    await item.locator('button[data-testid="action-menu-button"]').click({ force: true });
    
    const deleteBtn = page.locator('button:has-text("Excluir")');
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click({ force: true });

    await page.getByTestId('confirm-delete-button').click();
    await expect(page.locator('div[data-testid="transaction-item-tx-2"]')).not.toBeVisible();
  });
});
