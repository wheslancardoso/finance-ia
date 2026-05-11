import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Pagamento de Fatura', () => {
  test.describe.configure({ mode: 'serial' });
  let mockState: any;
  
  test.beforeEach(async ({ page }) => {
    mockState = {
      user_profile: {
        accumulated_balance_cents: 1000000, // 10k
        monthly_income_cents: 500000,
        financial_health_score: 85
      },
      accounts: [
        {
          id: 'acc-debit',
          name: 'Conta Corrente',
          type: 'CHECKING',
          balance_cents: 500000, // 5k
          user_id: 'user-1',
          color_hex: '#10b981'
        },
        {
          id: 'acc-credit',
          name: 'Cartão Ultra',
          type: 'CREDIT_CARD',
          balance_cents: -150000,
          credit_limit_cents: 1000000,
          closed_invoice_cents: 150000, // 1.5k
          closed_invoice_month: '2026-05',
          closing_day: 5,
          due_day: 12,
          user_id: 'user-1',
          color_hex: '#6366f1'
        }
      ],
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'EXPENSE', color_hex: '#ef4444', user_id: 'user-1' }
      ],
      goals: [],
      month_transactions: [],
      recent_transactions: [],
      month_stats: {
        income: 0,
        debit_expense: 0,
        credit_expense: 0,
        investments: 0
      },
      recurring_transactions: [],
      budgets: []
    };

    // Adicionar mock para a nova rota de pagamento de fatura
    await page.route('**/api/accounts/pay-invoice', async (route) => {
      const payload = route.request().postDataJSON();
      console.log('[MOCK] Paying invoice:', payload);
      
      // Simular atualização do estado
      if (!payload.alreadyPaid) {
        // Deduzir da conta de débito
        const debitAcc = mockState.accounts.find((a: any) => a.id === payload.paymentAccountId);
        if (debitAcc) {
          debitAcc.balance_cents -= payload.amountCents;
          console.log(`[MOCK] Debit Account balance updated: ${debitAcc.balance_cents}`);
        }
      }
      
      // Limpar fatura fechada no mock
      const creditAcc = mockState.accounts.find((a: any) => a.id === payload.creditCardAccountId);
      if (creditAcc) {
        creditAcc.closed_invoice_cents = 0;
        console.log(`[MOCK] Credit Card invoice cleared`);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, closedInvoiceStr: '2026-05-01' }),
      });
    });


    await setupFinancialMocks(page, mockState);
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
  });

  test('deve pagar fatura agora e atualizar saldos', async ({ page }) => {
    // 1. Localizar o card do cartão de crédito
    const creditCard = page.locator('text=Cartão Ultra');
    await expect(creditCard).toBeVisible({ timeout: 15000 });

    // 2. Abrir modal de pagamento
    await page.click('[data-testid="pay-invoice-button"]');

    // 3. Verificar se o valor está correto (1.500,00)
    const amountInput = page.locator('input[value="1500,00"]');
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // 4. Selecionar conta de débito (pode já estar selecionada)
    // Se precisar clicar no dropdown:
    // await page.click('text=Debitar de');
    // await page.click('text=Conta Corrente');

    // 5. Confirmar pagamento
    await page.click('[data-testid="confirm-payment-button"]');

    test.setTimeout(60000);
    // 6. Verificar se o modal fechou
    await expect(page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 20000 });

    // 7. Verificar se o saldo da conta corrente diminuiu (5000 - 1500 = 3500)
    await expect(page.getByTestId('account-balance-acc-debit')).toContainText('3.500,00', { timeout: 10000 });
  });

  test('deve marcar como "Já Paguei" apenas para liberar limite', async ({ page }) => {
    await expect(page.locator('text=Cartão Ultra')).toBeVisible({ timeout: 15000 });
    await page.click('[data-testid="pay-invoice-button"]');

    // Clicar em "Já Paguei"
    await page.click('button:has-text("Já Paguei")');

    // Verificar se o modal fechou
    await expect(page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 20000 });

    // Saldo da conta corrente não deve mudar
    await expect(page.getByTestId('account-balance-acc-debit')).toContainText('5.000,00', { timeout: 10000 });
  });
});
