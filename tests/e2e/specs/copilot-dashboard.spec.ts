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

  test('deve abrir o painel lateral do Copiloto, carregar histórico/memórias do banco, enviar pergunta, obter resposta e simular gasto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

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

    // Mocar a resposta da API de forma robusta interceptando pelo pathname
    await page.route(url => url.pathname.endsWith('/api/chat'), async (route) => {
      const method = route.request().method();
      
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            history: [],
            memoryFacts: ["Focando em economizar para emergências"]
          })
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: "Tudo bem! Analisei seu saldo de R$ 3.000,00. Esse gasto cabe no seu orçamento, mas reduzirá seu teto semanal.\n\n<vesper-simulation>\n{\n  \"type\": \"expense\",\n  \"title\": \"Notebook de Estudos\",\n  \"amount\": 1200.00,\n  \"installments\": 4,\n  \"description\": \"Simulação de compra parcelada de notebook.\",\n  \"impactAnalysis\": \"Reduz seu oxigênio semanal de R$ 750 para R$ 675 durante 4 meses.\"\n}\n</vesper-simulation>",
            memoryFacts: ["Focando em economizar para emergências", "Usuário deseja economizar para notebook de estudos"]
          })
        });
      }
    });

    await dashboard.goto();

    // 1. Abrir o Modo Copiloto pelo botão no cabeçalho
    const toggleButton = page.getByTestId('toggle-copilot-button');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Verificar se a barra lateral do Copilot abriu
    await expect(page.getByText('Vesper Copilot', { exact: false }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Peça análises de compras, metas ou crédito...')).toBeVisible();

    // 2. Verificar se a Memória de Longo Prazo do Jarvis carregou do Supabase
    const memoryHeader = page.getByText('Jarvis Lembra de 1 fatos');
    await expect(memoryHeader).toBeVisible();
    
    // Clicar para expandir o acordeão de memórias do Jarvis
    await memoryHeader.click();
    await expect(page.getByText('Focando em economizar para emergências')).toBeVisible();

    // 3. Enviar pergunta no chat
    const inputChat = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await inputChat.fill('Gostaria de simular a compra de um notebook de 1200 reais parcelado em 4x');
    await page.keyboard.press('Enter');

    // 4. Aguardar a resposta da IA, o Card de Simulação e a Atualização das Memórias Cognitivas
    await expect(page.getByRole('heading', { name: 'Notebook de Estudos' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('R$ 1.200,00')).toBeVisible();
    await expect(page.getByText('Reduz seu oxigênio semanal de R$ 750 para R$ 675')).toBeVisible();
    
    // As memórias cognitivas do Jarvis devem ter sido atualizadas para 2 fatos
    await expect(page.getByText('Jarvis Lembra de 2 fatos')).toBeVisible();
    await expect(page.getByText('Usuário deseja economizar para notebook de estudos')).toBeVisible();

    // Teto semanal inicial deve ser baseado no saldo projetado (R$ 3.000 / 4 = R$ 750)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/750/);

    // 5. Testar ação: "Simular no Caixa" (Simulate)
    const simularBtn = page.getByRole('button', { name: 'Simular Caixa' });
    await expect(simularBtn).toBeVisible();
    await simularBtn.click();

    // Verificar se o botão mudou de estado para "Simulado"
    await expect(page.getByRole('button', { name: 'Simulado' })).toBeVisible();

    // Com a simulação ativa (Notebook de R$ 1.200 em 4x = R$ 300 de gasto no mês corrente):
    // Sobra projetada reduz de R$ 3.000 para R$ 2.700. Teto semanal vira (R$ 2.700 / 4 = R$ 675)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/675/);

    // 6. Testar ação: "Criar Meta" (Goals API)
    const metaBtn = page.getByRole('button', { name: 'Criar Meta' });
    await expect(metaBtn).toBeVisible();
    await metaBtn.click();

    // Deve responder com feedback de sucesso ("Salvo!")
    await expect(page.getByRole('button', { name: 'Salvo!' })).toBeVisible();

    // 7. Testar ação: "Confirmar" agendamento (Transaction / Installment API)
    const confirmarBtn = page.getByRole('button', { name: 'Confirmar' });
    await expect(confirmarBtn).toBeVisible();
    await confirmarBtn.click();

    // Deve responder com feedback de sucesso ("Agendado!")
    await expect(page.getByRole('button', { name: 'Agendado!' })).toBeVisible();
  });

  test('deve testar a limpeza de histórico normal mantendo a memória cognitiva e resetando-a ao forçar reset_all', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    await setupFinancialMocks(page, createDashboardState());

    let deleteRequestedUrl = '';

    await page.route(url => url.pathname.endsWith('/api/chat'), async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            history: [{ role: 'user', text: 'Oi' }, { role: 'model', text: 'Olá!' }],
            memoryFacts: ["Fato lembrado do passado"]
          })
        });
      } else if (method === 'DELETE') {
        deleteRequestedUrl = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    await dashboard.goto();

    // Abrir o Copiloto
    await page.getByTestId('toggle-copilot-button').click();

    // 1. Validar se mensagens e memória de longo prazo carregaram na inicialização
    await expect(page.getByText('Olá!')).toBeVisible();
    const memoryHeader = page.getByText('Jarvis Lembra de 1 fatos');
    await expect(memoryHeader).toBeVisible();

    // 2. Clicar em Limpar Chat (deve chamar o DELETE normal)
    await page.getByRole('button', { name: 'Limpar Chat' }).click();
    await expect(page.getByText('Olá! Chat reiniciado.')).toBeVisible();
    
    // As memórias cognitivas de longo prazo devem ser preservadas na limpeza normal
    await expect(page.getByText('Jarvis Lembra de 1 fatos')).toBeVisible();
    expect(deleteRequestedUrl).toContain('/api/chat');
    expect(deleteRequestedUrl).not.toContain('reset_all=true');

    // 3. Expandir memórias cognitivas e clicar em reset total
    await page.getByText('Jarvis Lembra de 1 fatos').click();
    const resetMemoryBtn = page.getByRole('button', { name: 'Resetar Memória de Longo Prazo' });
    await expect(resetMemoryBtn).toBeVisible();
    await resetMemoryBtn.click();

    // Toda a seção de memórias do Jarvis deve sumir porque foi desintegrada/limpa no reset_all
    await expect(page.getByText('Jarvis Lembra de', { exact: false })).not.toBeVisible();
    expect(deleteRequestedUrl).toContain('reset_all=true');
  });

  test('deve manter o contexto de Time Machine sincronizado e enviá-lo nas análises do Copiloto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    await setupFinancialMocks(page, createDashboardState());

    let payloadEnviado: any = null;

    await page.route(url => url.pathname.endsWith('/api/chat'), async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ history: [], memoryFacts: [] })
        });
      } else if (method === 'POST') {
        payloadEnviado = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: 'Mês futuro analisado.', memoryFacts: [] })
        });
      }
    });

    await dashboard.goto();

    // 1. Viajar no tempo na Time Machine (Avançar 1 mês: de Maio de 2026 para Junho de 2026)
    const nextMonthButton = page.getByRole('button', { name: 'Próximo Mês' });
    await expect(nextMonthButton).toBeVisible();
    await nextMonthButton.click();

    // 2. Abrir o Copiloto
    await page.getByTestId('toggle-copilot-button').click();

    // O indicador temporal deve sincronizar instantaneamente para o mês de Junho
    await expect(page.getByText('Análise focada em junho de 2026')).toBeVisible();

    // 3. Enviar pergunta no chat
    const inputChat = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await inputChat.fill('Qual é a projeção desse mês?');
    await page.keyboard.press('Enter');

    // 4. Aguardar retorno e validar se o payload de Time Machine viajou com os dados corretos de junho de 2026
    await expect(page.getByText('Mês futuro analisado.')).toBeVisible();
    expect(payloadEnviado).not.toBeNull();
    expect(payloadEnviado.monthLabel).toContain('junho de 2026');
    expect(payloadEnviado.monthOffset).toBe(1);
  });
});
