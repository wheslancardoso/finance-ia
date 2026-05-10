import { test, expect } from '@playwright/test';

test.describe('Fluxo de Metas e Simulador', () => {
  test.beforeEach(async ({ page }) => {
    // Capturar logs do console do navegador
    page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));

    // Acessar a aplicação
    await page.goto('/');
    
    // Esperar a sincronização inicial (SyncUser / FinancialDataContext)
    // O ID deve estar resolvido para que as escritas funcionem
    await page.waitForFunction(() => {
      return localStorage.getItem('vesper_user_id') !== null;
    }, { timeout: 30000 });

    // Garantir que o dashboard carregou
    await expect(page.locator('text=Centro de Comando')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000); // Tempo para logs
  });

  test('deve realizar uma simulação e salvar como meta de planejamento', async ({ page }) => {
    // 1. Localizar o Simulador de Impacto
    const simulatorInput = page.getByTestId('simulator-amount-input');
    await simulatorInput.scrollIntoViewIfNeeded();
    
    // 2. Preencher valor e parcelas
    await simulatorInput.fill('1500,50');
    
    const installmentsSelect = page.getByTestId('simulator-installments-select');
    await installmentsSelect.selectOption('12');

    // 3. Verificar se o resultado da simulação apareceu (Custo Mensal)
    await expect(page.locator('text=Custo Mensal')).toBeVisible({ timeout: 5000 });

    const saveButton = page.getByTestId('simulator-save-button');
    await saveButton.click();
    
    // Pequeno delay para garantir persistência local e retorno da API
    await page.waitForTimeout(2000);

    // 5. Navegar para a página de Metas e verificar persistência
    await page.goto('/goals');

    // O nome gerado é "Parcelamento: 1500,50"
    const goalTitle = page.getByTestId('goal-card-title').filter({ hasText: /Parcelamento:/ });
    await expect(goalTitle).toBeVisible({ timeout: 15000 });
    await expect(goalTitle).toContainText('1500,50');
  });

  test('deve criar uma meta manual e realizar um aporte', async ({ page }) => {
    // 1. Criar uma conta para o aporte
    await page.goto('/accounts');
    await page.getByTestId('add-account-button').click();
    await page.getByTestId('account-name-input').fill('Conta de Teste');
    await page.getByTestId('account-balance-input').fill('5000,00');
    await page.getByTestId('account-type-CHECKING').click();
    await page.getByTestId('account-submit-button').click();
    await page.waitForTimeout(2000);

    // 2. Criar a meta
    await page.goto('/goals');
    await page.getByTestId('add-goal-button').click();
    await page.getByTestId('goal-name-input').fill('Meta E2E');
    await page.getByTestId('goal-target-input').fill('1000,00');
    await page.getByTestId('goal-submit-button').click();
    await page.waitForTimeout(2000);

    // 3. Realizar aporte
    const goalCard = page.getByTestId('goal-card').filter({ hasText: 'Meta E2E' });
    await goalCard.getByTestId('goal-contribution-button').click();

    // 4. Preencher aporte
    await page.getByTestId('contribution-amount-input').fill('200,00');
    await page.getByTestId('contribution-account-item').first().click();
    await page.getByTestId('contribution-submit-button').click();

    // 5. Verificar progresso (200 / 1000 = 20%)
    // Usamos regex para ser resiliente a 20% ou 20.0% e evitar problemas de ponto/vírgula
    await expect(goalCard).toContainText(/20.*Completo/, { timeout: 15000 });
  });
});
