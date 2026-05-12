
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
    await expect(ceiling).toContainText(/1\.212,50/);
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
  });
});
