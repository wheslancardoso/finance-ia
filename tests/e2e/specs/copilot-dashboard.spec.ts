import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { DashboardPage } from '../pages/DashboardPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Modo Copiloto de IA (Modo Jarvis) e Simulações no Chat', () => {
  const USER_ID = 'copilot-user';

  test.beforeEach(async ({ page }) => {
    // Logar mensagens do console do browser para facilitar depuração
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    await setupAuthMock(page, { id: USER_ID });
  });

  test('deve abrir o painel lateral do Copiloto, enviar pergunta, obter resposta e simular gasto em tempo real', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    // Setup de contas no banco com saldo inicial para a simulação
    const customState = createDashboardState({
      accounts: [
        { 
          id: 'acc-copilot-1', 
          name: 'Checking Account', 
          type: 'CHECKING', 
          balance_cents: 300000, // R$ 3.000,00
          credit_limit_cents: 0,
          user_id: USER_ID 
        }
      ]
    });

    await setupFinancialMocks(page, customState);

    // Mocar a resposta da API do chatbot do Gemini para retornar uma simulação XML estruturada
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: "Tudo bem! Analisei seu saldo de R$ 3.000,00. Esse gasto cabe no seu orçamento, mas reduzirá seu teto semanal.\n\n<vesper-simulation>\n{\n  \"type\": \"expense\",\n  \"title\": \"Notebook de Estudos\",\n  \"amount\": 1200.00,\n  \"installments\": 4,\n  \"description\": \"Simulação de compra parcelada de notebook.\",\n  \"impactAnalysis\": \"Reduz seu oxigênio semanal de R$ 750 para R$ 675 durante 4 meses.\"\n}\n</vesper-simulation>"
        })
      });
    });

    await dashboard.goto();

    // 1. Abrir o Modo Copiloto pelo botão no cabeçalho
    const toggleButton = page.getByTestId('toggle-copilot-button');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Verificar se a barra lateral do Copilot abriu
    await expect(page.getByText('Vesper Copilot', { exact: false }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Peça análises de compras, metas ou crédito...')).toBeVisible();

    // 2. Enviar pergunta no chat
    const inputChat = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await inputChat.fill('Gostaria de simular a compra de um notebook de 1200 reais parcelado em 4x');
    await page.keyboard.press('Enter');

    // 3. Aguardar a resposta da IA e o Card de Simulação ser renderizado
    await expect(page.getByText('Notebook de Estudos')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('R$ 1.200,00')).toBeVisible();
    await expect(page.getByText('Reduz seu oxigênio semanal de R$ 750 para R$ 675')).toBeVisible();

    // Teto semanal inicial deve ser baseado no saldo projetado (R$ 3.000 / 4 = R$ 750)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/750/);

    // 4. Testar ação: "Simular no Caixa" (Simulate)
    const simularBtn = page.getByRole('button', { name: 'Simular Caixa' });
    await expect(simularBtn).toBeVisible();
    await simularBtn.click();

    // Verificar se o botão mudou de estado para "Simulado"
    await expect(page.getByRole('button', { name: 'Simulado' })).toBeVisible();

    // Com a simulação ativa (Notebook de R$ 1.200 em 4x = R$ 300 de gasto no mês corrente):
    // Sobra projetada reduz de R$ 3.000 para R$ 2.700. Teto semanal vira (R$ 2.700 / 4 = R$ 675)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/675/);

    // 5. Testar ação: "Criar Meta" (Goals API)
    const metaBtn = page.getByRole('button', { name: 'Criar Meta' });
    await expect(metaBtn).toBeVisible();
    await metaBtn.click();

    // Deve responder com feedback de sucesso ("Salvo!")
    await expect(page.getByRole('button', { name: 'Salvo!' })).toBeVisible();

    // 6. Testar ação: "Confirmar" agendamento (Transaction / Installment API)
    const confirmarBtn = page.getByRole('button', { name: 'Confirmar' });
    await expect(confirmarBtn).toBeVisible();
    await confirmarBtn.click();

    // Deve responder com feedback de sucesso ("Agendado!")
    await expect(page.getByRole('button', { name: 'Agendado!' })).toBeVisible();
  });
});
