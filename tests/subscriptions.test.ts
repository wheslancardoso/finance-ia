import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe.configure({ mode: 'serial' });

test.describe('Gerenciamento de Fluxos Recorrentes (Assinaturas)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      accounts: [
        { id: 'acc-1', name: 'Conta Corrente', type: 'CHECKING', balance_cents: 1000000, color_hex: '#10b981', user_id: 'vesper-user-id' }
      ],
      categories: [
        { id: 'cat-1', name: 'Aluguel', type: 'EXPENSE', color_hex: '#ef4444', user_id: 'vesper-user-id' }
      ],
      recurring_transactions: [],
      goals: [],
      budgets: [],
      recent_transactions: [],
      month_transactions: [],
      user_profile: {
        monthly_income_cents: 500000,
        fixed_expenses_cents: 0,
        accumulated_balance_cents: 1000000,
        financial_health_score: 85
      }
    };
    await setupFinancialMocks(page, mockState);
    
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

    // Set user ID in localStorage and clear DB
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('vesper_user_id', 'vesper-user-id');
      // @ts-ignore
      if (window.indexedDB) {
        window.indexedDB.deleteDatabase('vesper_db');
      }
    });
  });

  test('deve criar um novo gasto fixo e verificar impacto no Survival HUD', async ({ page }) => {
    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');

    // 1. Abrir modal
    await page.getByTestId('add-subscription-button').click();
    
    // Esperar pelo modal de forma mais resiliente
    const modal = page.locator('[data-testid="add-subscription-modal"]');
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    // 2. Preencher formulário
    await page.getByTestId('subscription-description-input').fill('Aluguel Mensal');
    await page.getByTestId('subscription-amount-input').fill('2.000,00');
    
    // Selecionar categoria (Aluguel)
    await page.getByTestId('subscription-category-select').click();
    await page.getByTestId('category-option-cat-1').click();

    // Selecionar conta (Conta Corrente)
    await page.getByTestId('subscription-account-select').click();
    await page.getByTestId('account-option-acc-1').click();

    // 3. Salvar
    await page.getByTestId('subscription-submit-button').click();

    // 4. Verificar sucesso (StatusModal)
    await expect(page.getByText('Fluxo Criado')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('status-modal-close').click();

    // Verificar se aparece na lista
    await expect(page.getByText('Aluguel Mensal')).toBeVisible();

    // 5. Verificar impacto no Survival HUD (Dashboard)
    // O context já deve ter sido atualizado pelo refreshData() dentro do modal
    // mas fazemos um reload para garantir que o Dashboard pegue os novos dados
    await page.goto('/');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const survivalValue = page.getByTestId('survival-ceiling-value');
    await expect(survivalValue).toBeVisible();
    
    const hudValue = await survivalValue.innerText();
    console.log(`[DEBUG_TEST] HUD VALUE: "${hudValue}"`);

    // O valor deve ter caído de R$ 10.000,00 para R$ 8.000,00
    // (Liquidez 10.000 - Gasto Agendado 2.000)
    await expect(survivalValue).toContainText('8.000,00');
  });

  test('deve editar uma assinatura existente', async ({ page }) => {
    const futureDate = new Date();
    futureDate.setDate(28);

    mockState.recurring_transactions.push({
      id: 'sub-edit',
      description: 'Academia',
      amount_cents: 10000,
      transaction_type: 'EXPENSE',
      category_id: 'cat-1',
      account_id: 'acc-1',
      status: 'active',
      next_date: futureDate.toISOString(),
      category: mockState.categories[0],
      account: mockState.accounts[0]
    });

    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');
    
    await page.getByTestId('edit-subscription-sub-edit').click();
    await page.getByTestId('subscription-amount-input').fill('150,00');
    await page.getByTestId('subscription-submit-button').click();
    
    // Fechar modal de sucesso e esperar sumir
    const closeBtn = page.getByTestId('status-modal-close');
    await closeBtn.click();
    await expect(closeBtn).not.toBeVisible();
    
    // Verificar se o valor foi atualizado na lista (o context já deve ter atualizado)
    await expect(page.getByTestId('subscription-card-sub-edit')).toContainText('150,00', { timeout: 15000 });
  });

  test('deve pausar e excluir uma assinatura', async ({ page }) => {
    const futureDate = new Date();
    futureDate.setDate(28);

    mockState.recurring_transactions.push({
      id: 'sub-ops',
      description: 'Streaming',
      amount_cents: 5000,
      transaction_type: 'EXPENSE',
      category_id: 'cat-1',
      account_id: 'acc-1',
      status: 'active',
      next_date: futureDate.toISOString(),
      category: mockState.categories[0],
      account: mockState.accounts[0]
    });

    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');
    
    const toggleBtn = page.getByTestId('toggle-status-sub-ops');
    await toggleBtn.click();
    
    await expect(page.getByTestId('toggle-status-sub-ops')).toContainText('Ativar', { timeout: 10000 });
    
    await page.getByTestId('delete-subscription-sub-ops').click();
    await page.getByTestId('confirm-button').click();
    
    await expect(page.getByText('Streaming')).not.toBeVisible({ timeout: 15000 });
  });
});
