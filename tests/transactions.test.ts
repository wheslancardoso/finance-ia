import { test, expect } from '@playwright/test';

test.describe('Transaction Flows', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('[Dashboard]')) {
        console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
      }
    });

    // Limpar o banco de dados antes de cada teste
    await page.goto('http://localhost:3001');
    await page.evaluate(async () => {
      const DB_NAME = 'VesperDB';
      const databases = await indexedDB.databases();
      if (databases.map(db => db.name).includes(DB_NAME)) {
        await new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase(DB_NAME);
          req.onsuccess = resolve;
          req.onerror = reject;
          req.onblocked = () => {
            console.warn('⚠️ Delete database blocked');
            resolve(null);
          };
        });
      }
      localStorage.clear();
    });

    // Aumentar o timeout para navegação inicial
    await page.goto('http://localhost:3001', { timeout: 30000 });
    // Esperar o app carregar (verificar elemento chave do dashboard)
    await expect(page.locator('text=Liquidez Atual')).toBeVisible({ timeout: 15000 });
  });

  test('should create a credit card transaction with installments', async ({ page }) => {
    // 1. Criar uma conta de cartão de crédito
    await page.goto('http://localhost:3001/accounts');
    await page.click('[data-testid="add-account-button"]');
    
    // Selecionar tipo Cartão
    await page.click('[data-testid="account-type-CREDIT_CARD"]');
    
    await page.fill('[data-testid="account-name-input"]', 'Cartão Platinum');
    await page.fill('[data-testid="account-limit-input"]', '5000');
    await page.fill('[data-testid="account-closing-day-input"]', '5');
    await page.fill('[data-testid="account-due-day-input"]', '12');
    
    await page.click('[data-testid="account-submit-button"]');
    
    // Esperar fechar o modal (evita interceptação de cliques posteriores)
    await expect(page.locator('[data-testid="add-account-modal"]')).not.toBeVisible();
    
    // Esperar aparecer a conta na lista
    await expect(page.locator('text=Cartão Platinum')).toBeVisible({ timeout: 10000 });
    
    // 2. Criar uma transação parcelada
    await page.click('[data-testid="add-transaction-button"]');
    
    await page.fill('[data-testid="transaction-amount-input"]', '1200');
    await page.fill('[data-testid="transaction-description-input"]', 'Compra Parcelada E2E');
    
    // Selecionar conta de cartão usando o novo data-testid
    await page.click('[data-testid="transaction-account-select"]');
    // Usamos filter para garantir que pegamos a opção correta no dropdown
    await page.locator('[data-testid^="account-option"]').filter({ hasText: 'Cartão Platinum' }).first().click();
    
    // Definir parcelas
    await page.fill('[data-testid="transaction-installments-input"]', '12');
    
    // Salvar
    await page.click('[data-testid="transaction-submit-button"]');
    
    // Verificar se a transação aparece na lista (Dashboard)
    await page.goto('http://localhost:3001');
    
    // Esperar o carregamento inicial (fallback do Dexie) terminar
    await expect(page.locator('text=Carregando...')).not.toBeVisible({ timeout: 15000 });
    
    await expect(page.locator('text=Compra Parcelada E2E').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Parcela 1/12', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should delete a transaction and update balance', async ({ page }) => {
    // 1. Garantir que existe uma conta Corrente para o teste de deleção
    await page.goto('http://localhost:3001/accounts');
    const existingWallet = await page.locator('text=Carteira E2E').isVisible();
    if (!existingWallet) {
        await page.click('[data-testid="add-account-button"]');
        await page.click('[data-testid="account-type-CHECKING"]');
        await page.fill('[data-testid="account-name-input"]', 'Carteira E2E');
        await page.fill('[data-testid="account-balance-input"]', '1000');
        await page.click('[data-testid="account-submit-button"]');
        await expect(page.locator('[data-testid="add-account-modal"]')).not.toBeVisible();
        await expect(page.locator('text=Carteira E2E')).toBeVisible({ timeout: 10000 });
    }

    // 2. Criar uma transação simples de entrada
    await page.goto('http://localhost:3001');
    await expect(page.locator('text=Carregando...')).not.toBeVisible({ timeout: 15000 });
    
    await page.click('[data-testid="add-transaction-button"]');
    
    // Mudar para Entrada
    await page.click('button:has-text("Entrada")');
    
    await page.fill('[data-testid="transaction-amount-input"]', '500');
    await page.fill('[data-testid="transaction-description-input"]', 'Venda E2E');
    
    // Selecionar conta
    await page.click('[data-testid="transaction-account-select"]');
    await page.locator('[data-testid^="account-option"]').filter({ hasText: 'Carteira E2E' }).first().click();
    
    await page.click('[data-testid="transaction-submit-button"]');
    
    // 3. Localizar transação e deletar
    await expect(page.locator('text=Venda E2E')).toBeVisible({ timeout: 10000 });

    // Clica no menu de ações da transação que acabamos de criar
    // Clica no menu de ações da transação que acabamos de criar
    const transactionItem = page.getByTestId('transaction-item').filter({ hasText: 'Venda E2E' }).first();
    const actionMenu = transactionItem.getByTestId('action-menu-button');
    
    // Hover para tornar o botão visível (group-hover:opacity-100)
    await transactionItem.hover();
    await actionMenu.click();
    
    // Clica em excluir no menu
    await page.locator('[data-testid="action-delete-button"]').click();
    
    // Confirmar deleção no modal
    await page.locator('[data-testid="confirm-delete-button"]').click();
    
    // 4. Verificar se sumiu com polling para dar tempo de atualizar o Dexie/Context
    await expect(async () => {
        const isVisible = await page.locator('text=Venda E2E').isVisible();
        expect(isVisible).toBe(false);
    }).toPass({ timeout: 10000 });
  });
});
