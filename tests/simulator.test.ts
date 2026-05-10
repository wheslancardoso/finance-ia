import { test, expect } from '@playwright/test';

test.describe('Simulador de Impacto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Esperar a sincronização do usuário
    await page.waitForFunction(() => {
      return localStorage.getItem('vesper_user_id') !== null;
    }, { timeout: 30000 });

    // Esperar o carregamento do Dashboard
    await expect(page.locator('text=Centro de Comando')).toBeVisible({ timeout: 20000 });
  });

  test('deve simular uma compra parcelada e salvar como meta', async ({ page }) => {
    // 1. Localizar o Simulador (está no Dashboard)
    const simulator = page.getByTestId('simulator-amount-input');
    await expect(simulator).toBeVisible();

    // 2. Preencher valor
    await simulator.fill('5000,00');

    // 3. Selecionar parcelas (12x)
    await page.getByTestId('simulator-installments-select').selectOption('12');

    // 4. Verificar se o indicador de status apareceu
    // Note: No meu código anterior, adicionei data-testid="simulator-status-indicator" se result existe
    await expect(page.getByTestId('simulator-status-indicator')).toBeVisible({ timeout: 5000 });

    // 5. Verificar o custo mensal calculado (5000 / 12 = 416,67 aproximadamente)
    // O sistema formata como R$ 416,67
    await expect(page.locator('text=416,67')).toBeVisible();

    // 6. Clicar em "Planejar esta Compra"
    await page.getByTestId('simulator-save-button').click();

    // 7. Navegar para a página de Metas para verificar se foi criada
    // Podemos clicar no link da Sidebar ou ir direto para /goals
    await page.goto('/goals');

    // 8. Verificar se a meta aparece na lista
    // O nome da meta contém o valor formatado, usamos regex para ser resiliente a pontos/espaços
    await expect(page.locator('[data-testid="goal-card-title"]')).toHaveText(/Parcelamento:.*5.*000,00/, { timeout: 15000 });
  });
});
