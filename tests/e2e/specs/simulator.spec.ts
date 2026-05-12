import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { DashboardPage } from '../pages/DashboardPage';
import { GoalsPage } from '../pages/GoalsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Simulador de Impacto de Gasto (Refatorado)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'log') console.log(`BROWSER [log]: ${msg.text()}`);
      if (msg.type() === 'error') console.log(`BROWSER [error]: ${msg.text()}`);
    });

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
        { id: 'rec-in', description: 'Salário', amount_cents: 1000000, transaction_type: 'INCOME', status: 'active', frequency: 'monthly', next_date: futureDate },
        { id: 'rec-out', description: 'Aluguel', amount_cents: 500000, transaction_type: 'EXPENSE', status: 'active', frequency: 'monthly', next_date: futureDate }
      ]
    });

    await setupAuthMock(page, { id: 'e2e-user' });
    await setupFinancialMocks(page, mockState);
  });

  test('deve simular uma compra à vista e mostrar impacto seguro', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    // Simular compra de 1.000,00 (Liquidez total é 5.000,00)
    await dashboard.simulateSpend('1.000,00', '1');

    await expect(dashboard.simulatorStatusIndicator).toBeVisible();
    
    // Impacto: (1000 / 5000) * 100 = 20%
    await expect(page.getByText(/20\s*%/)).toBeVisible();
    await expect(dashboard.simulatorStatusIndicator.getByText(/Seguro/i)).toBeVisible();
  });

  test('deve simular uma compra parcelada e salvar como meta', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const goals = new GoalsPage(page);
    
    await dashboard.goto();
    await page.waitForLoadState('networkidle');

    // Simular compra de 6.000,00 em 12x (6000 / 5000 = 120% impacto total, mas parcela é 500)
    await dashboard.simulateSpend('6.000,00', '12');

    await expect(dashboard.simulatorStatusIndicator).toBeVisible();
    await expect(page.getByText(/500,00/).first()).toBeVisible(); // Parcela

    // Salvar como meta e aguardar a resposta da rede para evitar race conditions
    const saveResponse = page.waitForResponse(res => res.url().includes('/api/goals') && res.request().method() === 'POST');
    await dashboard.simulatorSaveButton.click();
    await saveResponse;

    // Esperar limpar o input (indicativo de sucesso no mock)
    await expect(dashboard.simulatorAmountInput).toHaveValue('', { timeout: 10000 });

    // Ir para metas e verificar se o parcelamento foi criado
    await goals.goto();
    await page.waitForLoadState('networkidle');
    
    const goalTitle = page.getByTestId('goal-card-title').first();
    await expect(goalTitle).toBeVisible({ timeout: 10000 });
    await expect(goalTitle).toContainText('Parcelamento: 6.000,00');
    await expect(page.getByText(/500,00\s*\/\s*mês/)).toBeVisible();
  });
});
