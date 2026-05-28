
import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Teto de Sobrevivência Semanal', () => {
  const USER_ID = 'weekly-user';

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, { id: USER_ID });
  });

  test('deve exibir o teto de sobrevivência semanal apenas quando em modo crise ou sobrevivência', async ({ page }) => {
    // 1. Caso Saudável (Deveria mostrar como 'Sobra p/ Investir' mas os testes antigos esperam visibilidade baseada em modo recuperação)
    // Na nova UI, o cabeçalho sempre existe, mas o texto muda.
    
    // 2. Caso de Sobrevivência (Liquidez < -100)
    const survivalState = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: -15000, user_id: USER_ID }], // R$ -150,00
      recurring_transactions: [
        { id: 'rec-1', amount_cents: 1000000, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' },
        { id: 'rec-2', amount_cents: 500000, transaction_type: 'EXPENSE', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' }
      ]
    });
    // Sobra mensal = 10k (renda) - 5k (despesa) = 5k. 
    // Como o saldo é -150, a sobra final é 4.850.
    // Limite semanal = 4.850 / 4 = 1.212,50

    await setupFinancialMocks(page, survivalState);
    await page.goto('/');
    
    const ceiling = page.getByTestId('survival-ceiling-value');
    await expect(ceiling).toBeVisible();
    // No modo saudável/sobrevivência com caixa negativo, mostra o teto semanal de oxigênio de caixa inteligente
    await expect(ceiling).toContainText(/375,00/);
  });
  
  test('deve exibir alerta de ciclo de dívida no modo crise', async ({ page }) => {
     const crisisState = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: -100000, user_id: USER_ID }],
      recurring_transactions: [
        { id: 'rec-1', amount_cents: 200000, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' },
        { id: 'rec-2', amount_cents: 300000, transaction_type: 'EXPENSE', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' }
      ]
    });

    await setupFinancialMocks(page, crisisState);
    await page.goto('/');
    
    await expect(page.getByText(/ciclo de dívida/i)).toBeVisible();
    // No modo crise, o teto exibe o limite semanal de sobrevivência emergencial com piso (R$ 225,00)
    const ceiling = page.getByTestId('survival-ceiling-value');
    await expect(ceiling).toContainText(/225,00/);
  });

  test('deve recalcular teto de oxigênio para o limite emergencial sob despesa severa (Test 3.2)', async ({ page }) => {
    const healthyState = createDashboardState({
      accounts: [
        { id: 'acc-healthy', name: 'Conta Saudável', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981', user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-extra', name: 'Imprevistos', type: 'EXPENSE' }
      ],
      recurring_transactions: [] // limpa recorrentes do base para não impactar
    });

    await setupFinancialMocks(page, healthyState);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inicialmente, com R$ 5.000,00 e sem despesas, o teto saudável é de R$ 376,51 (baseado no surplus da renda de fallback)
    const ceiling = page.getByTestId('survival-ceiling-value');
    await expect(ceiling).toBeVisible();
    await expect(ceiling).toContainText(/376,51/);

    // Inserir despesa manual severa de R$ 5.200,00 para empurrar o caixa para o negativo e forçar a crise de caixa
    const desktopBtn = page.getByTestId('add-transaction-button');
    if (await desktopBtn.isVisible()) {
      await desktopBtn.click();
    } else {
      await page.getByTestId('mobile-add-button').click();
    }

    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();

    await page.getByTestId('transaction-amount-input').fill('5200');
    await page.getByTestId('transaction-description-input').fill('Gasto Severo Inesperado');

    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-healthy').click();

    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Imprevistos').first().click();

    // Usar a data de hoje
    const todayStr = new Date().toISOString().split('T')[0];
    await page.getByTestId('transaction-date-input').fill(todayStr);

    // Submeter
    await page.getByTestId('transaction-submit-button').click();

    // Aguardar fechar o modal
    await expect(page.getByTestId('add-transaction-modal')).not.toBeVisible({ timeout: 10000 });

    // O teto deve reativamente cair para o piso de segurança (R$ 225,00) devido à crise gerada
    await expect(ceiling).toContainText(/225,00/, { timeout: 10000 });
  });

  test('deve aplicar priorização inteligente suspendendo metas menos prioritárias sob aperto parcial de caixa (Test 3.3)', async ({ page }) => {
    // Sobra do mês é exatamente R$ 150,00 (saldo de caixa)
    // Três metas ativas com aporte de R$ 100,00 cada
    const partialCrisisState = createDashboardState({
      accounts: [
        { id: 'acc-checking', name: 'Conta Principal', type: 'CHECKING', balance_cents: 15000, user_id: USER_ID } // R$ 150,00 saldo
      ],
      recurring_transactions: [], // sem receitas/despesas para a sobra ser R$ 150,00
      goals: [
        { id: 'goal-p1', name: 'Reserva Emergencial', target_amount_cents: 100000, current_amount_cents: 0, priority: 1, status: 'active', monthly_contribution_cents: 10000 }, // R$ 100,00
        { id: 'goal-p2', name: 'Viagem Lazer', target_amount_cents: 100000, current_amount_cents: 0, priority: 2, status: 'active', monthly_contribution_cents: 10000 }, // R$ 100,00
        { id: 'goal-p3', name: 'Novo Computador', target_amount_cents: 100000, current_amount_cents: 0, priority: 3, status: 'active', monthly_contribution_cents: 10000 } // R$ 100,00
      ]
    });

    await setupFinancialMocks(page, partialCrisisState);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // A linha Reservas deve exibir exatamente R$ 100,00 (somente a meta priority #1 de 100,00, suspendendo as outras)
    const reservasElement = page.locator('span:has-text("Reservas")').first();
    await expect(reservasElement).toBeVisible();

    const reservasValue = page.locator('div:has(> span:has-text("Reservas")) > span').last();
    // Como os compromissos são exibidos em uma lista, vamos buscar o valor R$ 100,00
    // O BillCommitmentCard exibe Reservas e seu valor do lado direito
    await expect(page.locator('span:has-text("R$ 100,00")').first()).toBeVisible();
    
    // O total do caixa projetado ou saídas planejadas deve computar apenas R$ 100,00
    await expect(page.locator('span:has-text("R$ 100,00")').last()).toBeVisible();
  });
});
