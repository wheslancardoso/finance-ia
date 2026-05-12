import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Simulador de Impacto', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
    
    mockState = {
      user_profile: {
        monthly_income_cents: 1000000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 500000,
        financial_health_score: 85,
      },
      accounts: [
        { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Conta', type: 'CHECKING', balance_cents: 500000, color_hex: '#10b981' }
      ],
      categories: [],
      transactions: [],
      goals: [],
      recurring_transactions: [
        {
          id: '550e8400-e29b-41d4-a716-446655443001',
          description: 'Salário',
          amount_cents: 1000000,
          transaction_type: 'INCOME',
          status: 'active',
          next_date: new Date(new Date().getTime() + 86400000).toISOString(),
          frequency: 'monthly'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655443002',
          description: 'Aluguel',
          amount_cents: 200000,
          transaction_type: 'EXPENSE',
          status: 'active',
          next_date: new Date(new Date().getTime() + 86400000).toISOString(),
          frequency: 'monthly'
        }
      ],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };

    await setupFinancialMocks(page, mockState);


    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', '2a8d83e2-17b5-434d-91d9-2a963bc841da');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Centro de Comando')).toBeVisible({ timeout: 20000 });
  });

  test('deve simular uma compra parcelada e salvar como meta', async ({ page }) => {
    const simulator = page.getByTestId('simulator-amount-input');
    await expect(simulator).toBeVisible();

    await simulator.fill('5000,00');
    await page.getByTestId('simulator-installments-select').selectOption('12');

    await expect(page.getByTestId('simulator-status-indicator')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=416,67')).toBeVisible();

    // 1. Preparar para esperar a resposta da API de metas
    const savePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/goals') && resp.request().method() === 'POST'
    );

    await page.getByTestId('simulator-save-button').click();

    // 2. Garantir que a API respondeu com sucesso antes de prosseguir
    await savePromise;

    // Esperar limpar o input (sinal de que salvou)
    await expect(simulator).toHaveValue('', { timeout: 10000 });

    await page.goto('/goals');
    await page.waitForLoadState('networkidle');
    
    // Garantir que estamos na página de metas
    await expect(page.getByRole('heading', { name: 'Suas Metas' })).toBeVisible();
    
    // Usar um seletor mais genérico que procure pelo texto 'Parcelamento' em qualquer título
    await expect(page.locator('h3:has-text("Parcelamento")').first()).toBeVisible({ timeout: 15000 });
  });
});
