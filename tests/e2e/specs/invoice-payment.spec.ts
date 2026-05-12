import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { AccountsPage } from '../pages/AccountsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Pagamento de Faturas (Refatorado)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = createDashboardState({
      accounts: [
        { id: 'acc-debit', name: 'Conta Corrente', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981' },
        { 
          id: 'acc-credit', 
          name: 'Cartão Ultra', 
          type: 'CREDIT_CARD', 
          balance_cents: -150000, 
          credit_limit_cents: 1000000, 
          closed_invoice_cents: 150000,
          closing_day: 5,
          due_day: 12,
          color_hex: '#6366f1'
        }
      ]
    });

    await setupAuthMock(page, { id: 'user-1' });
    await setupFinancialMocks(page, mockState);
  });

  test('deve pagar fatura agora e atualizar saldos', async ({ page }) => {
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    await page.waitForLoadState('networkidle');

    // Pagar fatura total (1.500,00)
    await accountsPage.payInvoice();

    // Modal deve fechar e saldo da conta de débito deve cair (5k - 1.5k = 3.5k)
    await expect(page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('account-card-acc-debit')).toContainText('3.500,00');
  });

  test('deve permitir pagamento parcial e atualizar saldos proporcionalmente', async ({ page }) => {
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    await page.waitForLoadState('networkidle');

    // Pagar apenas 500,00
    await accountsPage.payInvoice('500,00');

    await expect(page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('account-card-acc-debit')).toContainText('4.500,00');
  });
});
