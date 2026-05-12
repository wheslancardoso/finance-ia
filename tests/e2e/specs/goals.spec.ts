import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { GoalsPage } from '../pages/GoalsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Gestão de Metas (Refatorado)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();

    mockState = createDashboardState({
      accounts: [
        { id: 'acc-goals-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 1000000, color_hex: '#10b981' }
      ],
      recurring_transactions: [], // Zerar para que Projetado == Atual
      goals: [
        {
          id: 'goal-1',
          name: 'Viagem para Japão',
          target_amount_cents: 2000000,
          current_amount_cents: 500000,
          color_hex: '#8b5cf6',
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        }
      ]
    });

    await setupAuthMock(page, { id: 'user-1' });
    await setupFinancialMocks(page, mockState);
  });

  test('deve criar uma nova meta com sucesso', async ({ page }) => {
    const goalsPage = new GoalsPage(page);
    await goalsPage.goto();
    await page.waitForLoadState('networkidle');

    await goalsPage.createGoal('Reserva de Emergência', '10.000,00', '1.000,00');
    
    await expect(page.getByTestId('goal-card-title').filter({ hasText: 'Reserva de Emergência' })).toBeVisible();
  });

  test('deve realizar um aporte em uma meta existente e atualizar liquidez', async ({ page }) => {
    const goalsPage = new GoalsPage(page);
    await goalsPage.goto();
    await page.waitForLoadState('networkidle');

    // Aporte de 500,00 na meta 'Viagem para Japão' (id: goal-1)
    await goalsPage.makeContribution('goal-1', '500,00');
    
    await expect(page.getByText('Aporte Realizado')).toBeVisible();
    await page.getByTestId('status-modal-close').click();
    
    // Validar novo saldo da meta (5.000 + 500 = 5.500)
    await expect(page.getByTestId('goal-card-goal-1')).toContainText(/5\.500,00/);
    
    // Validar impacto na liquidez (10.000 - 500 = 9.500)
    await expect(page.getByTestId('hud-net-liquidity')).toContainText('9.500,00');
  });

  test('deve excluir uma meta', async ({ page }) => {
    const goalsPage = new GoalsPage(page);
    await goalsPage.goto();
    await page.waitForLoadState('networkidle');

    await goalsPage.deleteGoal('goal-1');
    
    await expect(page.getByTestId('goal-card-title').filter({ hasText: 'Viagem para Japão' })).not.toBeVisible();
  });

  test('deve abrir aporte a partir de uma recomendação inteligente', async ({ page }) => {
    const goalsPage = new GoalsPage(page);
    await goalsPage.goto();
    await page.waitForLoadState('networkidle');

    const rec = page.getByTestId('goal-recommendation-item').first();
    await expect(rec).toBeVisible();
    await rec.click();
    
    await expect(page.getByText('Realizar Aporte')).toBeVisible();
    await expect(page.getByTestId('contribution-goal-name')).toHaveText('Viagem para Japão');
  });
});
