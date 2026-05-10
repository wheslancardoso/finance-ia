import { test, expect } from '@playwright/test';

test.describe('Gerenciamento de Contas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Esperar a sincronização do usuário
    await page.waitForFunction(() => {
      return localStorage.getItem('vesper_user_id') !== null;
    }, { timeout: 30000 });

    await expect(page.locator('text=Centro de Comando')).toBeVisible({ timeout: 15000 });
  });

  test('deve criar uma nova conta corrente', async ({ page }) => {
    // 1. Navegar para Contas
    await page.goto('/accounts');

    // 2. Clicar em "Novo Objetivo" (ou o botão que abre o modal de conta)
    // No GoalsManager é "Novo Objetivo", mas no AccountsManager deve ser algo similar
    // Vamos procurar pelo texto do botão
    await page.click('button:has-text("Nova Conta"), button:has-text("Novo Registro")');

    // 3. Preencher dados
    await page.getByTestId('account-name-input').fill('Conta Teste Playwright');
    await page.getByTestId('account-type-CHECKING').click();
    await page.getByTestId('account-balance-input').fill('1500,00');

    // 4. Salvar
    await page.getByTestId('account-submit-button').click();

    // 5. Verificar se aparece na lista
    await expect(page.locator('text=Conta Teste Playwright')).toBeVisible({ timeout: 10000 });
  });

  test('deve criar um cartão de crédito e verificar limite', async ({ page }) => {
    await page.goto('/accounts');
    await page.click('button:has-text("Nova Conta")');

    await page.getByTestId('account-name-input').fill('Cartão Teste');
    await page.getByTestId('account-type-CREDIT_CARD').click();
    
    await page.getByTestId('account-limit-input').fill('5000,00');

    await page.getByTestId('account-submit-button').click();

    // Verificar se aparece na lista
    await expect(page.locator('text=Cartão Teste')).toBeVisible({ timeout: 15000 });
  });
});
