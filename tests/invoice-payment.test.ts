import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Pagamento de Fatura', () => {
  const mockState = {
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
        user_id: 'user-1'
      },
      {
        id: 'acc-credit',
        name: 'Cartão Ultra',
        type: 'CREDIT_CARD',
        balance_cents: 0,
        credit_limit_cents: 1000000,
        closed_invoice_cents: 150000, // 1.5k
        closed_invoice_month: 'Maio',
        closing_day: 5,
        due_day: 12,
        user_id: 'user-1'
      }
    ],
    month_transactions: [],
    recent_transactions: []
  };

  test.beforeEach(async ({ page }) => {
    // Adicionar mock para a nova rota de pagamento de fatura
    await page.route('**/api/accounts/pay-invoice', async (route) => {
      const payload = route.request().postDataJSON();
      console.log('[MOCK] Paying invoice:', payload);
      
      // Simular atualização do estado
      if (!payload.alreadyPaid) {
        // Deduzir da conta de débito
        const debitAcc = mockState.accounts.find(a => a.id === payload.paymentAccountId);
        if (debitAcc) {
          debitAcc.balance_cents -= payload.amountCents;
        }
      }
      
      // Limpar fatura fechada no mock
      const creditAcc = mockState.accounts.find(a => a.id === payload.creditCardAccountId);
      if (creditAcc) {
        creditAcc.closed_invoice_cents = 0;
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

    // 6. Verificar feedback de sucesso
    await expect(page.locator('text=Pago com Sucesso')).toBeVisible({ timeout: 10000 });

    // 7. Verificar se o modal fechou
    await expect(page.locator('text=Pagar Fatura')).not.toBeVisible({ timeout: 10000 });

    // 8. Verificar se o saldo da conta corrente diminuiu
    // 5000 - 1500 = 3500
    // O mockState é atualizado, mas o Playwright precisa ver a mudança na tela
    // Como refreshData() é chamado, o mockState atualizado será servido na próxima requisição
    await expect(page.locator('text=R$ 3.500,00')).toBeVisible({ timeout: 10000 });
  });

  test('deve marcar como "Já Paguei" apenas para liberar limite', async ({ page }) => {
    await expect(page.locator('text=Cartão Ultra')).toBeVisible({ timeout: 15000 });
    await page.click('[data-testid="pay-invoice-button"]');

    // Clicar em "Já Paguei"
    await page.click('button:has-text("Já Paguei")');

    await expect(page.locator('text=Pago com Sucesso')).toBeVisible({ timeout: 10000 });

    // Saldo da conta corrente não deve mudar
    await expect(page.locator('text=R$ 5.000,00')).toBeVisible({ timeout: 10000 });
  });
});
