import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';

test.describe('Migration Flow (ADR-004)', () => {
  const USER_ID = 'migration-user';

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, { id: USER_ID });
    
    await setupFinancialMocks(page, {
      user_profile: { id: USER_ID, monthly_income_cents: 500000 },
      accounts: [
        { id: 'acc-1', name: 'Nubank', type: 'CREDIT_CARD', balance_cents: 0, credit_limit_cents: 1000000, color_hex: '#8A05BE', user_id: USER_ID }
      ],
      categories: [{ id: 'cat-1', name: 'Aluguel', icon_name: 'Home', color_hex: '#FF0000', user_id: USER_ID }],
      transactions: [],
      invoices: []
    });
    
    await page.goto('/');
  });

  test('deve criar parcelamento começando em uma parcela específica', async ({ page, isMobile }) => {
    // Abrir modal de transação de acordo com o dispositivo
    if (isMobile) {
      await page.getByTestId('mobile-add-button').click({ force: true });
    } else {
      await page.getByTestId('add-transaction-button').click();
    }
    
    await page.getByTestId('transaction-description-input').fill('Notebook Antigo');
    await page.getByTestId('transaction-amount-input').fill('1200,00');
    
    // Selecionar cartão
    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-1').click();
    
    // Ativar parcelas (automático ao selecionar cartão)
    
    // Total de parcelas
    await page.getByTestId('transaction-installments-input').fill('12');
    
    // Definir que estamos na parcela 4
    await page.getByTestId('starting-installment-input').fill('4');
    
    // Salvar
    await page.getByTestId('transaction-submit-button').click();
    
    // Esperar modal fechar para garantir processamento
    await expect(page.getByTestId('add-transaction-modal')).not.toBeVisible();
    
    // Ir para aba de Linha do Tempo para ver as transações
    await page.getByRole('button', { name: 'Timeline' }).click();

    // Verificar se as transações foram criadas (de 4 a 12 = 9 parcelas)
    // No mock, a UI deve mostrar 4/12
    await expect(page.getByText('4/12', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('deve permitir ajustar saldo da fatura e marcar como pago sem débito', async ({ page }) => {
    // Ir para aba de contas via URL (mais robusto entre mobile/desktop)
    await page.goto('/accounts');
    
    // Esperar o card carregar
    await expect(page.getByText('Nubank')).toBeVisible();
    
    // Clicar em Informar Saldo
    await page.getByTestId('adjust-invoice-button').click();
    
    // Ajustar para 250,00
    await page.getByTestId('invoice-adjustment-input').fill('250,00');
    await page.getByTestId('invoice-adjustment-save-button').click();
    
    // Verificar se o valor apareceu
    await expect(page.getByTestId('invoice-amount')).toContainText('250,00', { timeout: 15000 });
    
    // 3. Marcar como pago
    await page.getByTestId('mark-as-paid-button').click();
    await page.getByRole('button', { name: 'Sim, já paguei' }).click();
    
    // 4. Validar que a fatura foi zerada
    await expect(page.getByTestId('invoice-amount')).toContainText('0,00', { timeout: 15000 });
  });
});
