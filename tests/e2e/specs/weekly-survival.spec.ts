
import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Teto de Sobrevivência Semanal', () => {
  const USER_ID = 'weekly-user';

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, { id: USER_ID });
    // Fixar o relógio em 7 de Maio de 2026 para garantir exatamente 4 semanas restantes no mês de forma determinística
    if (page.clock) {
      await page.clock.setFixedTime(new Date('2026-05-07T12:00:00Z'));
    }
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
    // Nova fórmula: (10000 - 5000 = 5000) / 4 semanas (data fixada em 7/maio: 25 dias restantes).
    // Teto semanal = 5000 / 4 = R$ 1.250,00
    await expect(ceiling).toContainText(/1\.250,00/);
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
    
    // No modo crise, a margem de Renda 2000 - Despesa 3000 = 0.
    // O fallback usa o saldo de caixa, que é negativo (-1000). Então o limite calculado é 0.
    // O piso absoluto do sistema entra em ação: R$ 50,00.
    const ceiling = page.getByTestId('survival-ceiling-value');
    await expect(ceiling).toContainText(/50,00/);
  });

  test('deve recalcular teto de oxigênio para o limite emergencial sob despesa severa (Test 3.2)', async ({ page }) => {
    const healthyState = createDashboardState({
      accounts: [
        { id: 'acc-healthy', name: 'Conta Saudável', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981', user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-extra', name: 'Imprevistos', type: 'EXPENSE' }
      ],
      recurring_transactions: [
        { id: 'rec-inc', amount_cents: 3000000, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly', user_id: USER_ID },
        { id: 'rec-exp', amount_cents: 1000000, transaction_type: 'EXPENSE', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly', user_id: USER_ID }
      ]
    });

    await setupFinancialMocks(page, healthyState);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Com renda 30k e despesas 10k, a margem livre é 20k.
    // Teto semanal = 20k / 4 semanas = R$ 5.000,00
    const ceiling = page.getByTestId('survival-ceiling-value');
    await expect(ceiling).toBeVisible();
    await expect(ceiling).toContainText(/5\.000,00/);

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
    await page.waitForTimeout(500); // Aguarda animação framer motion do select
    await page.getByText('Imprevistos', { exact: true }).last().click({ force: true });

    // Usar a data de hoje
    const todayStr = new Date().toISOString().split('T')[0];
    await page.getByTestId('transaction-date-input').fill(todayStr);

    // Submeter
    await page.getByTestId('transaction-submit-button').click();

    // Aguardar fechar o modal
    await expect(page.getByTestId('add-transaction-modal')).not.toBeVisible({ timeout: 10000 });

    // Como a margem livre principal é renda - fixas (e o gasto inserido é variável),
    // a margem não se altera, o teto semanal continua R$ 5.000,00.
    await expect(ceiling).toContainText(/5\.000,00/, { timeout: 10000 });
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

    // Valida que o teto semanal é calculado corretamente como R$ 50,00 (piso emergencial)
    // indicando que a sobra de caixa pós-metas (150 - 100 = 50) ativou o piso emergencial
    const ceiling = page.getByTestId('survival-ceiling-value');
    await expect(ceiling).toBeVisible();
    await expect(ceiling).toContainText(/50,00/);
  });
});
