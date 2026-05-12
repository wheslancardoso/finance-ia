import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { AccountsPage } from '../pages/AccountsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Transferências entre Contas (Refatorado)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = createDashboardState({
      accounts: [
        { id: 'acc-checking', name: 'Conta Corrente', type: 'CHECKING', balance_cents: 1000000, color_hex: '#10b981' },
        { id: 'acc-savings', name: 'Reserva', type: 'SAVINGS', balance_cents: 500000, color_hex: '#8b5cf6' }
      ]
    });

    await setupAuthMock(page, { id: 'user-1' });
    await setupFinancialMocks(page, mockState);
  });

  test('deve realizar uma transferência entre duas contas com sucesso e atualizar saldos', async ({ page }) => {
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    await page.waitForLoadState('networkidle');

    // Transferir 2.000,00 da Corrente para Reserva
    await accountsPage.makeTransfer('acc-checking', 'acc-savings', '2.000,00');

    // Verificar se os saldos foram atualizados na UI
    // Corrente: 10k -> 8k
    // Reserva: 5k -> 7k
    await expect(page.getByTestId('account-card-acc-checking')).toContainText('8.000,00');
    await expect(page.getByTestId('account-card-acc-savings')).toContainText('7.000,00');
    
    // Verificar HUD de Liquidez (deve permanecer inalterado ou refletir o total consolidado)
    await expect(page.getByTestId('hud-net-liquidity')).toContainText('15.000,00');
  });

  test('deve impedir transferência para a mesma conta', async ({ page }) => {
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    await page.waitForLoadState('networkidle');

    await accountsPage.openTransferButton.click();
    await accountsPage.transferAmountInput.fill('100,00');
    
    // Selecionar mesma conta em ambos
    await page.getByTestId('transfer-from-account-select').click();
    await page.getByTestId('transfer-account-from-acc-checking').click();
    
    await page.getByTestId('transfer-to-account-select').click();
    await page.getByTestId('transfer-account-to-acc-checking').click();
    
    await accountsPage.transferSubmitButton.click();

    await expect(page.getByText('Contas Idênticas')).toBeVisible();
  });
});
