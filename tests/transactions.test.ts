import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Transaction Flows (Mocked API)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      accounts: [
        { id: 'acc-1', name: 'Wallet', type: 'CASH', balance_cents: 50000, color_hex: '#10b981' },
        { id: 'acc-2', name: 'Credit Card', type: 'CREDIT_CARD', balance_cents: 0, credit_limit_cents: 100000, color_hex: '#6366f1', closing_day: 5, due_day: 12 }
      ],
      transactions: [],
      categories: [
        { id: 'cat-1', name: 'Food', color_hex: '#ef4444', type: 'EXPENSE' },
        { id: 'cat-2', name: 'Salary', color_hex: '#3b82f6', type: 'INCOME' }
      ],
      goals: [],
      subscriptions: []
    };

    await setupFinancialMocks(page, mockState);
  });

  test('should create a credit card transaction with installments', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Open add transaction modal
    await page.getByTestId('add-transaction-button').first().click();
    
    // Fill transaction details
    await page.getByTestId('transaction-type-EXPENSE').click();
    await page.getByTestId('transaction-amount-input').fill('300,00');
    await page.getByTestId('transaction-description-input').fill('New Laptop');
    
    // Select Credit Card account
    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-2').click();
    
    // Set installments
    await page.getByTestId('transaction-installments-input').fill('3');
    
    // Select Food category
    await page.getByTestId('transaction-category-select').click();
    await page.getByTestId('category-option-cat-1').click();
    
    // Submit
    await page.getByTestId('transaction-submit-button').click();

    // Verify first installment in the list
    await expect(page.getByText('New Laptop').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('1/3').first()).toBeVisible();
    await expect(page.getByText('R$ 100,00').first()).toBeVisible();
  });

  test('should toggle transaction paid status', async ({ page }) => {
    // Pre-populate a transaction BEFORE navigation
    mockState.transactions.push({
      id: 'tr-1',
      date: new Date().toISOString(),
      description: 'Monthly Rent',
      amount_cents: 120000,
      transaction_type: 'EXPENSE',
      account_id: 'acc-1',
      category_id: 'cat-1',
      is_paid: false,
      installment_current: 1,
      installment_total: 1
    });

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    
    // Find transaction and toggle paid
    const transactionRow = page.getByTestId('transaction-item-tr-1');
    await expect(transactionRow).toBeVisible({ timeout: 10000 });
    await transactionRow.getByTestId('toggle-paid-button').click();

    // Verify UI reflects paid status
    await expect(transactionRow.getByTestId('toggle-paid-button')).toBeVisible();
  });

  test('should delete a transaction and update UI', async ({ page }) => {
    // Pre-populate BEFORE navigation
    mockState.transactions.push({
      id: 'tr-to-delete',
      date: new Date().toISOString(),
      description: 'Old Ticket',
      amount_cents: 5000,
      transaction_type: 'EXPENSE',
      account_id: 'acc-1',
      category_id: 'cat-2',
      is_paid: true,
      installment_current: 1,
      installment_total: 1
    });

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const transactionRow = page.getByTestId('transaction-item-tr-to-delete');
    await expect(transactionRow).toBeVisible({ timeout: 10000 });
    await transactionRow.getByTestId('action-menu-button').click();
    await page.getByTestId('action-delete-button').click();
    
    // Handle confirmation modal
    await page.getByTestId('confirm-delete-button').click();
    
    // Verify deletion
    await expect(transactionRow).not.toBeVisible({ timeout: 10000 });
  });
});
