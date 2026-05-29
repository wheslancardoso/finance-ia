import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { DashboardPage } from '../pages/DashboardPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Projection Alignment (Time Machine)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();

    mockState = createDashboardState({
      user_profile: {
        monthly_income_cents: 1000000,
        fixed_expenses_cents: 0,
        accumulated_balance_cents: 500000,
        financial_health_score: 85,
      },
      accounts: [
        { id: 'acc-sim-1', name: 'Conta', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981' }
      ],
      recurring_transactions: [
        { id: 'rec-in', description: 'Salário', amount_cents: 1000000, transaction_type: 'INCOME', status: 'active', frequency: 'monthly', next_date: futureDate }
      ]
    });

    await setupAuthMock(page, { id: 'e2e-user' });
    await setupFinancialMocks(page, mockState);
  });

  test('deve refletir impacto de simulação em meses futuros', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');
    
    // 2. Localizar o saldo inicial projetado
    const initialLiquidityText = await page.getByTestId('net-liquidity-value').textContent();
    const initialLiquidity = initialLiquidityText ? parseFloat(initialLiquidityText.replace(/[^0-9,-]/g, '').replace(',', '.')) : 0;

    // 3. Preencher Simulador (R$ 1.200 em 12x = R$ 100/mês)
    await dashboard.simulateSpend('1200', '12');
    
    // Verificar se o status mudou
    await expect(dashboard.simulatorStatusIndicator).toBeVisible();

    // 4. Navegar para o Próximo Mês
    await page.getByLabel('Próximo Mês').click();
    
    // 5. Verificar se o badge de impacto ativo aparece no cabeçalho
    await expect(page.getByText(/Impacto Simulado Ativo/i)).toBeVisible();

    // 6. Verificar se a transação simulada aparece na Timeline
    await page.getByRole('button', { name: /Timeline/i }).click();
    await expect(page.getByText('Simulado: Compra (2/12)')).toBeVisible();

    // 7. Verificar se o saldo projetado no cabeçalho mudou (opcional: apenas verificar se existe)
    const futureLiquidityText = await page.getByTestId('net-liquidity-value').textContent();
    expect(futureLiquidityText).not.toBeNull();
  });

  test('deve projetar transações recorrentes na virada de ano e em fevereiro de ano bissexto sem transbordo de dia', async ({ page }) => {
    // Definir o clock para Fevereiro/2028 (ano bissexto)
    await page.clock.setFixedTime(new Date('2028-02-15T12:00:00Z'));
    const dashboard = new DashboardPage(page);

    const bissextoState = createDashboardState({
      accounts: [
        { id: 'acc-bissexto', name: 'Conta Principal', type: 'CHECKING', balance_cents: 500000, user_id: 'e2e-user' } // R$ 5.000,00
      ],
      recurring_transactions: [
        // Salário que cai no dia 29
        {
          id: 'rec-bissexto-in',
          description: 'Salário Bissexto',
          amount_cents: 200000,
          transaction_type: 'INCOME',
          status: 'active',
          frequency: 'monthly',
          next_date: '2028-02-29T12:00:00Z',
          user_id: 'e2e-user'
        }
      ]
    });

    await setupFinancialMocks(page, bissextoState);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    // Em Fevereiro/2028 (mês corrente no mock), o saldo inicial é R$ 5.000,00
    await expect(page.getByRole('heading', { name: 'R$ 5.000,00' })).toBeVisible();

    // Navegar para Março/2028 (próximo mês)
    await page.getByRole('button', { name: 'Próximo Mês' }).click();

    // Em Março/2028, a receita recorrente de Fevereiro (2.000) foi acumulada, saldo = R$ 7.000,00
    await expect(page.getByRole('heading', { name: 'R$ 7.000,00' })).toBeVisible();
    
    // Navegar mais 10 meses até Janeiro/2029 (total de 11 meses de acúmulo de receitas de Fev/2028 a Dez/2028)
    // Saldo = 5.000 (inicial) + 2.000 * 11 = R$ 27.000,00
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: 'Próximo Mês' }).click();
    }
    
    // Deve exibir o saldo acumulado matematicamente correto e a virada de ano no seletor temporal
    await expect(page.getByRole('heading', { name: 'R$ 27.000,00' })).toBeVisible();
    await expect(page.getByText('2029').first()).toBeVisible();
  });

  test('deve consolidar e exibir coexistência de múltiplas simulações ativas de naturezas distintas', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Modo Copiloto lateral em duas colunas é apenas para Desktop');
    const dashboard = new DashboardPage(page);

    const multiSimState = createDashboardState({
      accounts: [
        { id: 'acc-multi-sim', name: 'Conta Principal', type: 'CHECKING', balance_cents: 100000, user_id: 'e2e-user' } // R$ 1.000,00
      ],
      recurring_transactions: []
    });

    await setupFinancialMocks(page, multiSimState);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    // Simular usando a interatividade do chat do Copiloto duas simulações
    await page.getByTestId('toggle-copilot-button').click();

    // Mocar a resposta da API do Copilot para simular duas coisas
    await page.route(/\/api\/chat/, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: "Múltiplas simulações.\n\n<vesper-simulation>\n{\n  \"type\": \"loan\",\n  \"title\": \"Empréstimo Extra\",\n  \"amount\": 3000.00,\n  \"installments\": 6,\n  \"interestRate\": 0,\n  \"customInstallment\": 500.00,\n  \"description\": \"Crédito Extra.\"\n}\n</vesper-simulation>\n\n<vesper-simulation>\n{\n  \"type\": \"expense\",\n  \"title\": \"Notebook Gamer\",\n  \"amount\": 1200.00,\n  \"installments\": 4,\n  \"description\": \"Notebook.\"\n}\n</vesper-simulation>",
            memoryFacts: []
          })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [], memoryFacts: [] }) });
      }
    });

    const inputChat = page.getByPlaceholder('Peça análises de compras, metas ou crédito...');
    await inputChat.fill('Simular empréstimo de 3000 e notebook de 1200 em 4x');
    await page.keyboard.press('Enter');

    // Clicar em "Simular Caixa" para o Empréstimo Extra (primeiro botão)
    const simularBtn1 = page.getByRole('button', { name: 'Simular Caixa' }).first();
    await expect(simularBtn1).toBeVisible({ timeout: 15000 });
    await simularBtn1.click();

    // Clicar em "Simular Caixa" para o Notebook Gamer (como o primeiro botão mudou de nome para 'Simulado', o segundo botão agora é o único com 'Simular Caixa')
    const simularBtn2 = page.getByRole('button', { name: 'Simular Caixa' }).first();
    await expect(simularBtn2).toBeVisible();
    await simularBtn2.click();

    // Validar impacto combinado na Time Machine
    // Notebook Gamer: R$ 1200 / 4 = R$ 300/mês de saídas
    // Empréstimo Extra: R$ 3000 / 6 = R$ 500/mês de saídas
    // Total saídas simuladas = R$ 800,00
    await expect(page.locator('span:has-text("R$ 800,00")').first()).toBeVisible();

    // Saldo inicial = 1.000 + 3.000 (injeção empréstimo) - 800 (parcelas) = R$ 3.200,00
    const netLiquidityText = await page.getByTestId('net-liquidity-value').textContent();
    expect(netLiquidityText).toContain('3.200,00');
  });
});
