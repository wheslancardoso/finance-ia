import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { DashboardPage } from '../pages/DashboardPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Cenários de Sobrevivência do Vesper Copilot e Projeções E2E', () => {
  const USER_ID = 'copilot-user';

  test.beforeEach(async ({ page }) => {
    // Capturar logs do console do navegador
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    await setupAuthMock(page, { id: USER_ID });
    
    // Fixar o relógio em 7 de Maio de 2026 de forma determinística
    if (page.clock) {
      await page.clock.setFixedTime(new Date('2026-05-07T12:00:00Z'));
    }
  });

  test('deve validar cenário de empréstimo com juros Price e consistência de caixa em Junho/2026', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    // Setup do estado com os dados reais de Junho/2026 fornecidos pelo usuário
    const customState = createDashboardState({
      accounts: [
        {
          id: '1b53b7d2-a7e5-414e-9878-b50739461d5e',
          name: 'Nubank',
          type: 'CHECKING',
          balance_cents: 41300, // R$ 413,00 de caixa inicial
          credit_limit_cents: 0,
          user_id: USER_ID
        },
        {
          id: 'a08c1855-400f-4b69-a2ee-c2bedfcd84f3',
          name: 'Cartão Nubank',
          type: 'CREDIT_CARD',
          balance_cents: 0,
          credit_limit_cents: 480000,
          closed_invoice_cents: 111087, // R$ 1.110,87
          closed_invoice_month: '2026-06',
          closing_day: 4,
          due_day: 11,
          user_id: USER_ID
        },
        {
          id: '0ef2dcbf-c649-4396-b54a-b28b3ac2c6a4',
          name: 'Cartão Inter',
          type: 'CREDIT_CARD',
          balance_cents: 0,
          credit_limit_cents: 235000,
          closed_invoice_cents: 43374, // R$ 433,74
          closed_invoice_month: '2026-06',
          closing_day: 6,
          due_day: 13,
          user_id: USER_ID
        },
        {
          id: 'ef114ea7-3ef0-487d-8a7a-bf3b70cb6477',
          name: 'Cartão Mercado Pago',
          type: 'CREDIT_CARD',
          balance_cents: -96388,
          credit_limit_cents: 180000,
          closed_invoice_cents: 76020, // R$ 760,20
          closed_invoice_month: '2026-06',
          closing_day: 9,
          due_day: 16,
          user_id: USER_ID
        },
        {
          id: 'ee0fcbfa-ab6e-45f6-8951-f5d016ce7f9f',
          name: 'Cartão PicPay',
          type: 'CREDIT_CARD',
          balance_cents: 0,
          credit_limit_cents: 270000,
          closed_invoice_cents: 44955, // R$ 449,55
          closed_invoice_month: '2026-06',
          closing_day: 9,
          due_day: 16,
          user_id: USER_ID
        },
        {
          id: 'e9b55a15-5b4a-4df0-821b-bcf322b41b6c',
          name: 'SParcelado',
          type: 'CREDIT_CARD',
          balance_cents: 0,
          credit_limit_cents: 324000,
          closed_invoice_cents: 9586, // R$ 95,86
          closed_invoice_month: '2026-06',
          closing_day: 3,
          due_day: 10,
          user_id: USER_ID
        },
        {
          id: '65779ec4-febc-4bb7-836e-b1e7263cbacb',
          name: 'Cartão Neon',
          type: 'CREDIT_CARD',
          balance_cents: 0,
          credit_limit_cents: 90000,
          closed_invoice_cents: 7108, // R$ 71,08
          closed_invoice_month: '2026-06',
          closing_day: 1,
          due_day: 8,
          user_id: USER_ID
        }
      ],
      transactions: [
        {
          id: 't-card-nubank',
          description: 'Fatura Nubank',
          transaction_type: 'EXPENSE',
          amount_cents: 111087, // R$ 1.110,87
          date: '2026-05-15T12:00:00Z',
          account_id: 'a08c1855-400f-4b69-a2ee-c2bedfcd84f3',
          is_paid: false,
          user_id: USER_ID
        },
        {
          id: 't-card-inter',
          description: 'Fatura Inter',
          transaction_type: 'EXPENSE',
          amount_cents: 43374, // R$ 433,74
          date: '2026-05-15T12:00:00Z',
          account_id: '0ef2dcbf-c649-4396-b54a-b28b3ac2c6a4',
          is_paid: false,
          user_id: USER_ID
        },
        {
          id: 't-card-mp',
          description: 'Fatura Mercado Pago',
          transaction_type: 'EXPENSE',
          amount_cents: 76020, // R$ 760,20
          date: '2026-05-15T12:00:00Z',
          account_id: 'ef114ea7-3ef0-487d-8a7a-bf3b70cb6477',
          is_paid: false,
          user_id: USER_ID
        },
        {
          id: 't-card-picpay',
          description: 'Fatura PicPay',
          transaction_type: 'EXPENSE',
          amount_cents: 44955, // R$ 449,55
          date: '2026-05-15T12:00:00Z',
          account_id: 'ee0fcbfa-ab6e-45f6-8951-f5d016ce7f9f',
          is_paid: false,
          user_id: USER_ID
        },
        {
          id: 't-card-sparcelado',
          description: 'Fatura SParcelado',
          transaction_type: 'EXPENSE',
          amount_cents: 9586, // R$ 95,86
          date: '2026-05-15T12:00:00Z',
          account_id: 'e9b55a15-5b4a-4df0-821b-bcf322b41b6c',
          is_paid: false,
          user_id: USER_ID
        },
        {
          id: 't-card-neon',
          description: 'Fatura Neon',
          transaction_type: 'EXPENSE',
          amount_cents: 7108, // R$ 71,08
          date: '2026-05-15T12:00:00Z',
          account_id: '65779ec4-febc-4bb7-836e-b1e7263cbacb',
          is_paid: false,
          user_id: USER_ID
        }
      ],
      recurring_transactions: [
        {
          id: 'rt-salary',
          description: 'Salário',
          transaction_type: 'INCOME',
          amount_cents: 222471, // R$ 2.224,71
          status: 'active',
          is_primary_income: true,
          next_date: '2026-06-02',
          user_id: USER_ID
        },
        {
          id: 'rt-faculdade',
          description: 'Faculdade [Vence: 2026-07]',
          transaction_type: 'EXPENSE',
          amount_cents: 58640, // R$ 586,40
          status: 'active',
          is_primary_income: false,
          next_date: '2026-06-09',
          user_id: USER_ID
        },
        {
          id: 'rt-emprestimo-mp',
          description: 'Empréstimo Mercado Pago [Vence: 2027-05]',
          transaction_type: 'EXPENSE',
          amount_cents: 13229, // R$ 132,29
          status: 'active',
          is_primary_income: false,
          next_date: '2026-06-09',
          user_id: USER_ID
        },
        {
          id: 'rt-combustivel',
          description: 'Combústivel',
          transaction_type: 'EXPENSE',
          amount_cents: 18000, // R$ 180,00
          status: 'active',
          is_primary_income: false,
          next_date: '2026-06-18',
          user_id: USER_ID
        },
        {
          id: 'rt-cabelo',
          description: 'Corte de cabelo',
          transaction_type: 'EXPENSE',
          amount_cents: 5000, // R$ 50,00
          status: 'active',
          is_primary_income: false,
          next_date: '2026-06-30',
          user_id: USER_ID
        }
      ]
    });

    await setupFinancialMocks(page, customState);

    // Mocar rota do Copilot (API Chat) para retornar os cenários de sobrevivência
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
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: "Entendi total. Vamos analisar June/2026.\n\nCenário 1: Sem empréstimo, cobrindo com cartões.\nCenário 2: Pegando R$ 1.400,00 de empréstimo.\n\n<vesper-simulation>\n{\n  \"type\": \"loan\",\n  \"title\": \"Empréstimo de sobrevivência\",\n  \"amount\": 1400.00,\n  \"installments\": 6,\n  \"interestRate\": 0,\n  \"customInstallment\": 230.00,\n  \"description\": \"Empréstimo para cobrir aperto de caixa temporário.\",\n  \"impactAnalysis\": \"Saída mensal da parcela fica em R$ 230,00.\"\n}\n</vesper-simulation>",
            memoryFacts: ["Usuário em alta vulnerabilidade financeira de caixa", "FGTS em agosto de R$ 1.500"]
          })
        });
      }
    });

    await dashboard.goto();

    // 1. Navegar para o mês projetado de Junho de 2026
    const nextMonthBtn = page.getByRole('button', { name: 'Próximo Mês' });
    await expect(nextMonthBtn).toBeVisible();
    await nextMonthBtn.click();

    // Confirmar que estamos em Junho/2026 e que os compromissos base somam R$ 3.869,99
    // As despesas projetadas na planilha devem somar R$ 3.869,99
    await expect(page.getByText(/R\$\s?3\.869,99/).first()).toBeVisible();

    // 2. Abrir Copiloto e enviar pergunta
    await page.getByTestId('toggle-copilot-button').click();
    const chatInput = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await chatInput.fill('Qual cenário é melhor para junho: empréstimo ou usar cartão?');
    await page.keyboard.press('Enter');

    // 3. Validar card de simulação interativa de empréstimo no chat
    await expect(page.getByRole('heading', { name: 'Empréstimo de sobrevivência' })).toBeVisible({ timeout: 15000 });
    // Deve exibir o valor com fallback de customInstallment (ou 6x de R$ 230,00)
    await expect(page.getByText('(ou 6x de R$ 230,00)')).toBeVisible();

    // 4. Ativar "Simular Caixa"
    const simularBtn = page.getByRole('button', { name: 'Simular Caixa' });
    await expect(simularBtn).toBeVisible();
    await simularBtn.click();

    // Como limitamos a planilha a 5 itens por padrão, expandimos para ver os itens ocultos além dos 5 primeiros
    const verTodosBtn = page.getByRole('button', { name: /Ver todos/i });
    if (await verTodosBtn.isVisible()) {
      await verTodosBtn.click();
    }

    // 5. Validar impacto no dashboard físico
    // O item "Simulado" na planilha deve exibir R$ 230,00
    await expect(page.getByText(/Simulado:/).first()).toBeVisible();
    await expect(page.locator('span:has-text("R$ 230,00")').first()).toBeVisible();

    // O "Total" na planilha de despesas deve saltar para R$ 4.099,99 (R$ 3.869,99 + R$ 230,00)
    await expect(page.locator('span:has-text("R$ 4.099,99")').first()).toBeVisible();

    // 6. Desativar simulação e verificar retorno
    await page.getByRole('button', { name: 'Simulado' }).click();
    await expect(page.locator('span:has-text("R$ 3.869,99")').first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /Simulado:/ })).not.toBeVisible();
  });

  test('deve suspender aportes de metas ativas reativamente sob crise de caixa e reativá-las dinamicamente ao reabastecer o saldo', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Estado inicial com liquidez negativa (Nubank tem R$ 100,00 de caixa, compromisso de R$ 1.500,00)
    // Contribuição de metas ativas é R$ 150,00
    const crisisState = createDashboardState({
      accounts: [
        {
          id: 'acc-checking',
          name: 'Nubank',
          type: 'CHECKING',
          balance_cents: 10000, // R$ 100,00
          credit_limit_cents: 0,
          user_id: USER_ID
        }
      ],
      recurring_transactions: [
        {
          id: 'rt-rent',
          description: 'Aluguel',
          transaction_type: 'EXPENSE',
          amount_cents: 150000, // R$ 1.500,00
          status: 'active',
          next_date: '2026-06-10',
          user_id: USER_ID
        }
      ],
      goals: [
        {
          id: 'goal-emergency',
          name: 'Reserva Emergência',
          target_amount_cents: 1000000,
          current_amount_cents: 50000,
          priority: 1,
          color_hex: '#10b981',
          status: 'active',
          monthly_contribution_cents: 15000 // R$ 150,00/mês
        }
      ]
    });

    await setupFinancialMocks(page, crisisState);
    await dashboard.goto();

    // Navegar para Junho/2026
    const nextMonthBtn = page.getByRole('button', { name: 'Próximo Mês' });
    await expect(nextMonthBtn).toBeVisible();
    await nextMonthBtn.click();

    // Sob crise de caixa, a meta de R$ 150,00 deve ser suspensa.
    // O saldo projetado final deve refletir apenas Nubank (100) - Aluguel (1.500) = R$ -1.400,00
    const balanceVal = page.getByTestId('net-liquidity-value');
    await expect(balanceVal).toContainText(/-R\$\s?1\.400,00/);

    // Agora reabastecemos o saldo do usuário para ter liquidez positiva
    const healthyState = createDashboardState({
      accounts: [
        {
          id: 'acc-checking',
          name: 'Nubank',
          type: 'CHECKING',
          balance_cents: 300000, // Aumenta para R$ 3.000,00
          credit_limit_cents: 0,
          user_id: USER_ID
        }
      ],
      recurring_transactions: [
        {
          id: 'rt-rent',
          description: 'Aluguel',
          transaction_type: 'EXPENSE',
          amount_cents: 150000,
          status: 'active',
          next_date: '2026-06-10',
          user_id: USER_ID
        }
      ],
      goals: [
        {
          id: 'goal-emergency',
          name: 'Reserva Emergência',
          target_amount_cents: 1000000,
          current_amount_cents: 50000,
          priority: 1,
          color_hex: '#10b981',
          status: 'active',
          monthly_contribution_cents: 15000
        }
      ]
    });

    // Mocar novamente com estado saudável e atualizar a página
    await setupFinancialMocks(page, healthyState);
    await page.reload();

    // Navegar novamente para Junho/2026 após reload
    await expect(page.getByRole('button', { name: 'Próximo Mês' })).toBeVisible();
    await page.getByRole('button', { name: 'Próximo Mês' }).click();

    // Sob situação saudável (saldo inicial de R$ 3.000,00), a meta ativa deve ser cobrada (150,00)
    // O saldo projetado final deve refletir Nubank (3.000) - Aluguel (1.500) - Meta (150) = R$ 1.350,00
    const balanceVal2 = page.getByTestId('net-liquidity-value');
    await expect(balanceVal2).toContainText(/R\$\s?1\.350,00/);
  });

  test('deve simular cenário de rotativo do cartão via Copiloto e validar o impacto orçamentário no dashboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    const customState = createDashboardState({
      accounts: [
        {
          id: 'acc-checking',
          name: 'Nubank',
          type: 'CHECKING',
          balance_cents: 10000, // R$ 100,00 de caixa
          credit_limit_cents: 0,
          user_id: USER_ID
        },
        {
          id: 'acc-credit-nubank',
          name: 'Cartão Nubank',
          type: 'CREDIT_CARD',
          balance_cents: 0,
          credit_limit_cents: 200000,
          closed_invoice_cents: 150000, // Fatura de R$ 1.500,00
          closed_invoice_month: '2026-06',
          closing_day: 4,
          due_day: 11,
          user_id: USER_ID
        }
      ],
      transactions: [
        {
          id: 't-card-nubank',
          description: 'Fatura Nubank',
          transaction_type: 'EXPENSE',
          amount_cents: 150000,
          date: '2026-05-15T12:00:00Z',
          account_id: 'acc-credit-nubank',
          is_paid: false,
          user_id: USER_ID
        }
      ]
    });

    await setupFinancialMocks(page, customState);

    // Mocar rota do Copilot (API Chat) para retornar o cenário do rotativo
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
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: "Entendi. Se você pagar apenas o mínimo da fatura (rotativo), você pagará o mínimo de R$ 225,00 e o restante (R$ 1.275,00) será financiado com juros de 14% a.m., gerando um encargo de R$ 178,50 de juros no mês seguinte.\n\n<vesper-simulation>\n{\n  \"type\": \"expense\",\n  \"title\": \"Juros Rotativo Nubank\",\n  \"amount\": 178.50,\n  \"installments\": 1,\n  \"interestRate\": 0,\n  \"description\": \"Juros decorrentes do financiamento do saldo devedor da fatura no rotativo.\",\n  \"impactAnalysis\": \"Adiciona uma saída extra de R$ 178,50 no mês seguinte.\"\n}\n</vesper-simulation>",
            memoryFacts: ["Usuário optou por simular rotativo do cartão Nubank"]
          })
        });
      }
    });

    await dashboard.goto();

    // 1. Ir para Junho/2026
    const nextMonthBtn = page.getByRole('button', { name: 'Próximo Mês' });
    await expect(nextMonthBtn).toBeVisible();
    await nextMonthBtn.click();

    // 2. Abrir Copiloto e enviar mensagem
    await page.getByTestId('toggle-copilot-button').click();
    const chatInput = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await chatInput.fill('Qual o impacto de entrar no rotativo do cartão Nubank?');
    await page.keyboard.press('Enter');

    // 3. Validar card de simulação interativa de rotativo
    await expect(page.getByRole('heading', { name: 'Juros Rotativo Nubank' })).toBeVisible({ timeout: 15000 });

    // 4. Ativar "Simular Caixa"
    const simularBtn = page.getByRole('button', { name: 'Simular Caixa' });
    await expect(simularBtn).toBeVisible();
    await simularBtn.click();

    // Como limitamos a planilha a 5 itens por padrão, expandimos para ver os itens ocultos além dos 5 primeiros
    const verTodosBtn = page.getByRole('button', { name: /Ver todos/i });
    if (await verTodosBtn.isVisible()) {
      await verTodosBtn.click();
    }

    // 5. Validar impacto no dashboard físico
    // O item "Simulado" na planilha deve exibir R$ 178,50
    await expect(page.getByText(/Simulado:/).first()).toBeVisible();
    await expect(page.getByText(/R\$\s?178,50/).first()).toBeVisible();

    // O "Total" na planilha de despesas deve subir correspondendo ao valor simulado de R$ 178,50
    // O total inicial era R$ 3.500,00. Agora deve ser R$ 3.678,50
    await expect(page.getByText(/R\$\s?3\.678,50/).first()).toBeVisible();
  });
});

