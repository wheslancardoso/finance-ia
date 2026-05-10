import { test, expect } from '@playwright/test';

test.describe('Fluxo de Transações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Esperar a sincronização do usuário
    await page.waitForFunction(() => {
      return localStorage.getItem('vesper_user_id') !== null;
    }, { timeout: 30000 });

    await expect(page.locator('text=Centro de Comando')).toBeVisible({ timeout: 15000 });
  });

  test('deve criar uma despesa simples e validar no extrato', async ({ page }) => {
    // 1. Abrir modal de nova transação
    // Procurar pelo botão que abre o modal (AddTransactionModal)
    // Normalmente está no Dashboard ou FAB
    await page.click('button:has-text("Novo Registro"), button:has-text("Transação")');

    // 2. Preencher dados da transação usando data-testid
    await page.getByTestId('transaction-amount-input').fill('42,50');
    await page.getByTestId('transaction-description-input').fill('Teste Playwright ' + Date.now());

    // 3. Selecionar Conta e Categoria (opcional, mas bom testar)
    // Como são custom selects, precisamos clicar e depois selecionar a opção
    const accountSelect = page.getByTestId('transaction-account-select');
    await accountSelect.click();
    // Selecionar a primeira conta disponível que não seja o placeholder
    await page.locator('div[class*="hover:bg-white/5"]').first().click();

    const categorySelect = page.getByTestId('transaction-category-select');
    await categorySelect.click();
    await page.locator('div[class*="hover:bg-white/5"]').first().click();

    // 4. Salvar
    await page.getByTestId('transaction-submit-button').click();

    // 5. Verificar se o modal fechou e se a transação aparece na lista de recentes
    await expect(page.getByTestId('transaction-amount-input')).not.toBeVisible();
    
    // Validar no extrato (RecentTransactions ou Dashboard)
    // Procurar pelo valor formatado
    await expect(page.locator('text=42,50').first()).toBeVisible({ timeout: 10000 });
  });

  test('deve criar uma compra parcelada e verificar projeção', async ({ page }) => {
    await page.click('button:has-text("Novo Registro")');

    await page.getByTestId('transaction-amount-input').fill('1200,00');
    await page.getByTestId('transaction-description-input').fill('Notebook Gamer');

    // Ativar parcelamento
    const installmentToggle = page.locator('button:has-text("Parcelar")');
    if (await installmentToggle.isVisible()) {
      await installmentToggle.click();
      const installmentInput = page.locator('input[type="number"]');
      await installmentInput.fill('12');
    }

    await page.getByTestId('transaction-submit-button').click();

    // Validar se o valor da parcela (100,00) aparece no Dashboard ou Extrato
    await expect(page.locator('text=100,00').first()).toBeVisible({ timeout: 10000 });
  });
});
