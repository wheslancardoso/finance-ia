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
    // Fixar o relógio em 7 de Maio de 2026 para garantir exatamente 4 semanas restantes no mês de forma determinística
    if (page.clock) {
      await page.clock.setFixedTime(new Date('2026-05-07T12:00:00Z'));
    }
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
      ],
      recurring_transactions: [
        {
          id: 'rec-income-copilot',
          description: 'Salary',
          amount_cents: 300000, // R$ 3.000,00
          transaction_type: 'INCOME',
          status: 'active',
          next_date: '2026-05-28T12:00:00Z',
          frequency: 'monthly',
          user_id: USER_ID
        },
        {
          id: 'rec-expense-copilot',
          description: 'Rent',
          amount_cents: 140000, // R$ 1.400,00
          transaction_type: 'EXPENSE',
          status: 'active',
          next_date: '2026-05-28T12:00:00Z',
          frequency: 'monthly',
          user_id: USER_ID
        }
      ]
    });

    await setupFinancialMocks(page, customState);

    // Mocar a resposta da API de forma robusta interceptando pelo pathname
    await page.route(/\/api\/chat/, async (route) => {
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
            response: "Tudo bem! Analisei seu saldo de R$ 3.000,00. Esse gasto cabe no seu orçamento, mas reduzirá seu teto semanal.\n\n<vesper-simulation>\n{\n  \"type\": \"expense\",\n  \"title\": \"Notebook de Estudos\",\n  \"amount\": 1200.00,\n  \"installments\": 4,\n  \"description\": \"Simulação de compra parcelada de notebook.\",\n  \"impactAnalysis\": \"Reduz seu oxigênio semanal de R$ 400 para R$ 325 durante 4 meses.\"\n}\n</vesper-simulation>",
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
    await expect(page.getByText('Reduz seu oxigênio semanal de R$ 400 para R$ 325')).toBeVisible();
    
    // As memórias cognitivas do Jarvis devem ter sido atualizadas para 2 fatos
    await expect(page.getByText('Jarvis Lembra de 2 fatos')).toBeVisible();
    await expect(page.getByText('Usuário deseja economizar para notebook de estudos')).toBeVisible();

    // Teto semanal inicial deve ser baseado no saldo projetado (R$ 1.600 / 4 = R$ 400, reduzido por abundância para R$ 330)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/330/);

    // 5. Testar ação: "Simular no Caixa" (Simulate)
    const simularBtn = page.getByRole('button', { name: 'Simular Caixa' });
    await expect(simularBtn).toBeVisible();
    await simularBtn.click({ force: true });

    // Verificar se o botão mudou de estado para "Simulado"
    await expect(page.getByRole('button', { name: 'Simulado' })).toBeVisible();

    // Com a simulação activa (Notebook de R$ 1.200 em 4x = R$ 300 de gasto no mês corrente):
    // Sobra projetada reduz de R$ 1.600 para R$ 1.300. Teto semanal vira (R$ 1.300 / 4 = R$ 325, reduzido para R$ 307)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/307/);

    // 6. Testar ação: "Criar Meta" (Goals API)
    const metaBtn = page.getByRole('button', { name: 'Criar Meta' });
    await expect(metaBtn).toBeVisible();
    await metaBtn.click({ force: true });

    // Deve responder com feedback de sucesso ("Salvo!")
    await expect(page.getByRole('button', { name: 'Salvo!' })).toBeVisible();

    // 7. Testar ação: "Confirmar" agendamento (Transaction / Installment API)
    const confirmarBtn = page.getByRole('button', { name: 'Confirmar' });
    await expect(confirmarBtn).toBeVisible();
    await confirmarBtn.click({ force: true });

    // Deve responder com feedback de sucesso ("Agendado!")
    await expect(page.getByRole('button', { name: 'Agendado!' })).toBeVisible();

    // 8. Navegar para transações e certificar o agendamento real das parcelas (Test 4.3)
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Notebook de Estudos').first()).toBeVisible({ timeout: 10000 });
  });

  test('deve testar a limpeza de histórico normal mantendo a memória cognitiva e resetando-a ao forçar reset_all', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    await setupFinancialMocks(page, createDashboardState());

    let deleteRequestedUrl = '';

    await page.route(/\/api\/chat/, async (route) => {
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

    await page.route(/\/api\/chat/, async (route) => {
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

  test('deve lidar com indisponibilidade do Gemini (Offline 503) exibindo erro amigável (Test 4.1)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    await setupFinancialMocks(page, createDashboardState());

    // Intercepta POST /api/chat para simular 503
    await page.route(/\/api\/chat/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ history: [], memoryFacts: [] })
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Gemini service is temporarily unavailable.' })
        });
      }
    });

    await dashboard.goto();

    // Abrir o Copiloto
    await page.getByTestId('toggle-copilot-button').click();

    // Enviar mensagem
    const inputChat = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await inputChat.fill('Olá');
    await page.keyboard.press('Enter');

    // Chat deve exibir mensagem de erro amigável
    await expect(page.getByText('tive um pequeno problema ao processar seu pedido')).toBeVisible({ timeout: 15000 });
  });

  test('deve injetar reativamente memórias de medo do Jarvis no dashboard físico (Test 4.2)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    const state = createDashboardState({
      accounts: [
        { 
          id: 'acc-credit-nubank', 
          name: 'Cartão Nubank', 
          type: 'CREDIT_CARD', 
          balance_cents: 0,
          credit_limit_cents: 200000,
          user_id: USER_ID 
        }
      ]
    });

    await setupFinancialMocks(page, state);

    // Moca a rota GET /api/chat para retornar preocupação do Nubank
    await page.route(/\/api\/chat/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            history: [],
            memoryFacts: ["Usuário teme estourar cartão Nubank"]
          })
        });
      }
    });

    // Injetar os fatos diretamente no localStorage antes de ir para o dashboard para garantir a reatividade
    await page.addInitScript(() => {
      localStorage.setItem('vesper_jarvis_memories', JSON.stringify(["Usuário teme estourar cartão Nubank"]));
    });

    await dashboard.goto();

    // Abrir o Copiloto para carregar memórias do chat
    await page.getByTestId('toggle-copilot-button').click();

    // Navegar para a página de contas onde o AccountCard do Nubank é renderizado
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');

    // O dashboard físico deve reativamente renderizar o badge de teto rigoroso no Nubank
    const nubankCard = page.getByTestId('account-card-acc-credit-nubank');
    await expect(nubankCard.getByTestId('jarvis-fear-badge')).toBeVisible({ timeout: 10000 });
    await expect(nubankCard.getByText('Teto Rigoroso')).toBeVisible();
  });
});
