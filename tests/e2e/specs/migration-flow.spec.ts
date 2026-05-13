import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';

test.describe('Migration Flow (ADR-004)', () => {
  const USER_ID = 'migration-user';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
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

  test('deve criar parcelamento começando em uma parcela específica', async ({ page }) => {
    // Abrir modal de transação
    await page.getByTestId('add-transaction-button').click();
    
    await page.getByPlaceholder('O que você comprou?').fill('Notebook Antigo');
    await page.getByPlaceholder('0,00').fill('1200,00');
    
    // Selecionar cartão
    await page.getByText('Selecionar Conta').click();
    await page.getByText('Nubank').click();
    
    // Ativar parcelas
    await page.getByText('Parcelar').click();
    
    // Total de parcelas
    await page.locator('input[type="number"]').first().fill('12');
    
    // Definir que estamos na parcela 4
    await page.getByTestId('starting-installment-input').fill('4');
    
    // Salvar
    await page.getByRole('button', { name: 'Confirmar Lançamento' }).click();
    
    // Verificar se as transações foram criadas (de 4 a 12 = 9 parcelas)
    // No mock, a UI deve mostrar 4/12
    await expect(page.getByText('4/12')).toBeVisible({ timeout: 15000 });
  });

  test('deve permitir ajustar saldo da fatura e marcar como pago sem débito', async ({ page }) => {
    // Ir para aba de contas
    await page.getByTestId('nav-contas').click();
    
    // Esperar o card carregar
    await expect(page.getByText('Nubank')).toBeVisible();
    
    // Clicar em Informar Saldo
    await page.getByText('Informar Saldo').click();
    
    // Ajustar para 250,00
    await page.getByPlaceholder('0,00').fill('250,00');
    await page.getByRole('button', { name: 'Salvar' }).click();
    
    // Verificar se o valor apareceu
    await expect(page.getByText('R$ 250,00')).toBeVisible({ timeout: 15000 });
    
    // Clicar em Já Paguei
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Já Paguei' }).click();
    
    // O valor deve zerar (ou não ser visível se o mock zerar)
    await expect(page.getByText('R$ 250,00')).not.toBeVisible({ timeout: 15000 });
  });
});
