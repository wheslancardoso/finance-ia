
import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Teto de Sobrevivência Semanal', () => {
  const USER_ID = 'weekly-user';

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, { id: USER_ID });
  });

  test('deve exibir o card de sobrevivência semanal apenas quando em modo crise ou sobrevivência', async ({ page }) => {
    // 1. Caso Saudável (Não deve aparecer)
    const healthyState = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: 1000000, user_id: USER_ID }],
      recurring_transactions: [
        { id: 'rec-1', amount_cents: 500000, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' }
      ]
    });
    
    await setupFinancialMocks(page, healthyState);
    await page.goto('/');
    
    await expect(page.getByTestId('weekly-survival-remaining')).not.toBeVisible();

    // 2. Caso de Sobrevivência (Deve aparecer)
    const survivalState = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: -500000, user_id: USER_ID }], // Liquidez negativa
      recurring_transactions: [
        { id: 'rec-1', amount_cents: 1000000, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' },
        { id: 'rec-2', amount_cents: 500000, transaction_type: 'EXPENSE', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' }
      ]
    });
    // Sobra mensal = 10k - 5k = 5k. Limite semanal = 1.25k (R$ 1.250,00)

    await setupFinancialMocks(page, survivalState);
    await page.goto('/');
    
    const card = page.getByTestId('weekly-survival-remaining');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/1\.250,00/);
  });

  test('deve atualizar o status para WARNING ao consumir mais de 60% do limite', async ({ page }) => {
     const survivalState = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: -100000, user_id: USER_ID }],
      recurring_transactions: [
        { id: 'rec-1', amount_cents: 400000, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' }
      ],
      // Sobra 4k -> Limite semanal 1k (R$ 1.000,00)
      transactions: [
        { id: 'tx-1', amount_cents: 65000, transaction_type: 'EXPENSE', date: new Date().toISOString(), is_recurring: false, description: 'Gasto Alto' }
      ]
    });

    await setupFinancialMocks(page, survivalState);
    await page.goto('/');
    
    const status = page.getByTestId('weekly-survival-status');
    await expect(status).toContainText(/Cuidado/i);
  });
});
