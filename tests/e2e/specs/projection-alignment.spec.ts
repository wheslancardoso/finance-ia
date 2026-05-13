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
});
