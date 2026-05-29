import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { AccountsPage } from '../pages/AccountsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Pagamento de Faturas (Refatorado)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    mockState = createDashboardState({
      accounts: [
        { id: 'acc-debit', name: 'Conta Corrente', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981' },
        { 
          id: 'acc-credit', 
          name: 'Cartão Ultra', 
          type: 'CREDIT_CARD', 
          balance_cents: -120000, // R$ 1.200,00 de saldo devedor
          credit_limit_cents: 300000, // R$ 3.000,00 de limite (disponível R$ 1.800,00)
          closed_invoice_cents: 120000, // R$ 1.200,00 de fatura fechada
          open_invoice_cents: 30000, // R$ 300,00 de fatura aberta
          closed_invoice_month: currentMonth,
          open_invoice_month: currentMonth,
          closing_day: 5,
          due_day: 12,
          color_hex: '#6366f1'
        }
      ],
      transactions: [
        {
          id: 'tx-card-spent-2.3',
          description: 'Gasto de Teste no Cartão',
          transaction_type: 'EXPENSE',
          amount_cents: 30000, // R$ 300,00 gasto extra no cartão
          date: new Date().toISOString(),
          account_id: 'acc-credit',
          is_paid: false,
          user_id: 'user-1'
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

    // Pagar fatura total (1.200,00)
    await accountsPage.payInvoice();

    // Modal deve fechar e saldo da conta de débito deve cair (5k - 1.2k = 3.8k)
    await expect(page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('account-card-acc-debit')).toContainText('3.800,00');
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

  test('deve atualizar reativamente o limite de crédito disponível sob pagamento parcial (Test 2.2)', async ({ page }) => {
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    await page.waitForLoadState('networkidle');

    // Inicialmente, deve mostrar Disponível: R$ 1.800,00 no card do cartão (limite 3000 - devedor 1200)
    const card = page.getByTestId('account-card-acc-credit');
    await expect(card.getByText('Disponível: R$ 1.800,00')).toBeVisible();

    // Pagar parcial de R$ 500,00
    await accountsPage.payInvoice('500,00');

    // O modal fecha
    await expect(page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 10000 });

    // O limite disponível deve reativamente atualizar para R$ 2.300,00 (1.800,00 + 500,00)
    await expect(card.getByText('Disponível: R$ 2.300,00')).toBeVisible({ timeout: 10000 });
  });

  test('deve recalcular a projeção de fatura na Time Machine após estorno de transação (Test 2.3)', async ({ page }) => {
    // 1. Acessar o dashboard para validar o total de cartões projetado inicial na Time Machine
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // O total inicial em Cartões Usados no cabeçalho deve incluir o gasto do cartão:
    // closed_invoice_cents (120.000) + tx-card-spent-2.3 (30.000) = R$ 1.500,00
    await expect(page.getByText('Cartões Usados', { exact: false }).first()).toBeVisible();
    await expect(page.locator('span:has-text("R$ 1.500,00")').first()).toBeVisible();

    // 2. Navegar para a página de transações e estornar (excluir) a transação de R$ 300,00
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const txItem = page.getByTestId('transaction-item-tx-card-spent-2.3');
    await expect(txItem).toBeVisible();

    // Clicar no menu de ação da transação
    const menuBtn = txItem.getByTestId('action-menu-button');
    await menuBtn.click();

    // Clicar em Excluir
    const deleteBtn = page.getByTestId('action-delete-button');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirmar exclusão no modal
    const confirmDeleteBtn = page.getByTestId('confirm-delete-button');
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // Transação deve sumir da tela
    await expect(txItem).not.toBeVisible({ timeout: 10000 });

    // 3. Voltar ao Dashboard e certificar que a fatura projetada de cartões decresceu para R$ 1.200,00
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Cartões Usados', { exact: false }).first()).toBeVisible();
    await expect(page.locator('span:has-text("R$ 1.200,00")').first()).toBeVisible();
  });
});
