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
    
    // Na nova lógica (Sobrevivência), a liquidez mostrada é o respiro REAL imediato.
    // Saldo (0) - Dívidas do Mês (0) = 0. 
    // O sistema não antecipa mais os 5k de renda que ainda não caíram no saldo.
    await dashboard.expectLiquidity(/R\$\s?0,00/);
    
    // O Teto semanal, no entanto, continua sendo baseado na SOBRA PROJETADA do fim do mês
    // para que o usuário saiba quanto pode gastar de forma segura.
    // Sobra Projetada (3k) / 4 = 750
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/750.*00/, { timeout: 15000 });
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
      // Deve mostrar mensagem de erro no header unificado (net-liquidity-value mostra "Ajuste Necessário" ou data)
      await expect(page.getByTestId('net-liquidity-value')).toContainText(/Ajuste Necessário/i);
      await expect(page.getByText(/Alerta de Crise/i)).toBeVisible();
      await expect(page.getByText(/Crítico/i).first()).toBeVisible();
    }).toPass({ timeout: 15000 });
  });

  test('deve refletir mudanças de assinaturas no saldo projetado', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const subs = new SubscriptionsPage(page);

    await setupFinancialMocks(page, createDashboardState());
    await dashboard.goto();
    
    // Teto semanal inicial: 750
    await expect(page.getByTestId('survival-ceiling-value')).toContainText(/750.*00/, { timeout: 15000 });

    await subs.goto();
    await subs.addSubscription('Gasto Gigante', '2000,00', '28');
    
    await dashboard.goto();
    
    // Sobra inicial 3k - 2k novo = 1k sobra. 1k / 4 = 250
    const finalCeiling = page.getByTestId('survival-ceiling-value');
    await expect(finalCeiling).toContainText(/250,00/, { timeout: 15000 });
  });
});
