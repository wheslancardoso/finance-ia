import { test, expect } from '@playwright/test';

test.describe('Dashboard Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase
    await page.route('**/*.supabase.co/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // Limpeza radical
    await page.goto('http://localhost:3001');
    await page.evaluate(async () => {
      localStorage.clear();
      const DB_NAME = 'VesperDB';
      const dbs = await indexedDB.databases();
      if (dbs.map(db => db.name).includes(DB_NAME)) {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase(DB_NAME);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      }
    });

    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Centro de Comando')).toBeVisible({ timeout: 30000 });
  });

  test('should display initial financial stats correctly without NaN', async ({ page }) => {
    // Verificar cards usando data-testid
    const liquidity = page.getByTestId('net-liquidity-value');
    const debt = page.getByTestId('total-debt-value');
    const health = page.getByTestId('health-score-value');

    await expect(liquidity).toBeVisible();
    await expect(debt).toBeVisible();
    await expect(health).toBeVisible();

    // Validar que não são NaN
    const liqText = await liquidity.textContent();
    const debtText = await debt.textContent();
    const healthText = await health.textContent();

    expect(liqText).not.toContain('NaN');
    expect(debtText).not.toContain('NaN');
    expect(healthText).not.toContain('NaN');

    // Valores iniciais devem ser zero
    expect(liqText).toMatch(/R\$\s*0,00/);
    expect(debtText).toMatch(/R\$\s*0,00/);
  });

  test('should update dashboard stats after adding an account and transaction', async ({ page }) => {
    // 1. Adicionar Conta
    await page.getByTestId('nav-contas').click();
    await page.waitForURL('**/accounts');
    
    await page.getByTestId('add-account-button').click();
    await page.getByTestId('account-name-input').fill('Conta E2E');
    await page.getByTestId('account-balance-input').fill('10000'); // R$ 10.000,00
    await page.getByTestId('account-type-CHECKING').click();
    await page.getByTestId('account-submit-button').click();
    
    await expect(page.getByTestId('add-account-modal')).not.toBeVisible();

    // 2. Voltar e Verificar
    await page.getByTestId('nav-dashboard').click();
    await page.waitForURL('**/');
    
    await expect(page.getByTestId('net-liquidity-value')).toContainText(/10\.000,00/, { timeout: 15000 });

    // 3. Adicionar Transação
    await page.getByTestId('add-transaction-button').click();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();
    
    await page.getByTestId('transaction-amount-input').fill('2500'); // R$ 2.500,00
    await page.getByTestId('transaction-description-input').fill('Gasto Teste');
    
    // Selecionar Conta (robusto para shadcn/Radix Select)
    await page.getByTestId('transaction-account-select').click();
    await page.waitForSelector('[role="option"]', { state: 'visible' });
    await page.getByRole('option', { name: 'Conta E2E', exact: false }).click();
    
    await page.getByTestId('transaction-submit-button').click();
    await expect(page.getByTestId('add-transaction-modal')).not.toBeVisible();

    // 4. Verificar Saldo Final (10.000 - 2.500 = 7.500)
    await expect(page.getByTestId('net-liquidity-value')).toContainText(/7\.500,00/, { timeout: 15000 });
  });
});
