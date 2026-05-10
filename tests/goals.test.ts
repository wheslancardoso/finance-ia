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

    // O nome gerado é "Compra Planejada: R$ 1.500,50"
    // Usamos um locator mais flexível para o texto da meta
    const goalTitle = page.getByTestId('goal-card-title').filter({ hasText: /Compra Planejada:/ });
    await expect(goalTitle).toBeVisible({ timeout: 15000 });
    await expect(goalTitle).toContainText('1.500,50');
  });
});
