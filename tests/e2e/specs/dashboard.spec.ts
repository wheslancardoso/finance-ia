import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { DashboardPage } from '../pages/DashboardPage';
import { SubscriptionsPage } from '../pages/SubscriptionsPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Dashboard e Projeções (Refatorado)', () => {
  const USER_ID = 'dashboard-user';
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    await setupAuthMock(page, { id: USER_ID });
  });

  test('deve exibir métricas de saúde financeira corretamente no modo saudável', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await setupFinancialMocks(page, createDashboardState());
    await dashboard.goto();
    
    // 5k - 2k = 3k
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/3.*000.*00/, { timeout: 15000 });
    
    await expect(page.getByTestId('survival-status-message')).toContainText(/Atenção ao Orçamento/i);
  });

  test('deve entrar em MODO CRISE quando a liquidez é negativa', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    
    // Forçar crise: saldo negativo + despesas maiores que receitas
    const crisisState = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta', type: 'CHECKING', balance_cents: -500000, user_id: USER_ID }],
      recurring_transactions: [
        { id: 'rec-1', amount_cents: 0, transaction_type: 'INCOME', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' },
        { id: 'rec-2', amount_cents: 1000000, transaction_type: 'EXPENSE', status: 'active', next_date: new Date().toISOString(), frequency: 'monthly' }
      ]
    });
    
    await setupFinancialMocks(page, crisisState);
    await dashboard.goto();
    
    await expect(async () => {
      const msg = page.getByTestId('survival-status-message');
      await expect(msg).toContainText(/MODO CRISE ATIVADO/i);
    }).toPass({ timeout: 15000 });
  });

  test('deve refletir mudanças de assinaturas no saldo projetado', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const subs = new SubscriptionsPage(page);

    await setupFinancialMocks(page, createDashboardState());
    await dashboard.goto();
    
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/3.*000.*00/, { timeout: 15000 });

    await subs.goto();
    await subs.addSubscription('Gasto Gigante', '2000,00');
    
    await dashboard.goto();
    
    // 3k inicial - 2k novo = 1k
    const finalCeiling = page.getByTestId('survival-ceiling-value');
    await expect(finalCeiling).toContainText(/1\.000,00/, { timeout: 15000 });
  });
});
