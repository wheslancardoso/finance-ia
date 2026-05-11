import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

const USER_ID = "2a8d83e2-17b5-434d-91d9-2a963bc841da";

test.describe.configure({ mode: 'serial' });

test.describe('Financial Management (Goals & Accounts)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      user_profile: {
        monthly_income_cents: 500000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 300000,
        financial_health_score: 85,
      },
      accounts: [
        { 
          id: 'acc-wallet-001', 
          name: 'Main Wallet', 
          type: 'CHECKING', 
          balance_cents: 300000, 
          color_hex: '#10b981',
          user_id: USER_ID
        },
        { 
          id: 'acc-card-001', 
          name: 'Black Card', 
          type: 'CREDIT_CARD', 
          balance_cents: -30000,
          credit_limit_cents: 500000, 
          closed_invoice_cents: 30000, 
          open_invoice_cents: 0,
          closing_day: 5,
          due_day: 12,
          color_hex: '#6366f1',
          user_id: USER_ID
        }
      ],
      goals: [
        {
          id: 'goal-trip-001',
          name: 'New York Trip',
          target_amount_cents: 100000,
          current_amount_cents: 20000,
          color_hex: '#f59e0b',
          user_id: USER_ID
        }
      ],
      categories: [
        { id: 'cat-invest-001', name: 'Investimentos', color_hex: '#3b82f6', type: 'EXPENSE', user_id: USER_ID }
      ],
      month_transactions: [],
      recent_transactions: [],
      month_stats: {
        income: 0,
        debit_expense: 0,
        credit_expense: 0,
        investments: 0
      },
      recurring_transactions: [],
      budgets: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
      if (msg.text().includes('[MOCK]')) console.log(msg.text());
    });

    await setupFinancialMocks(page, mockState);
  });

  test('should display correct goal progress and handle contribution', async ({ page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');

    // 1. Verificar visualização inicial da meta
    const goalCard = page.getByTestId('goal-card-goal-trip-001');
    await expect(goalCard).toBeVisible({ timeout: 10000 });
    await expect(goalCard.getByTestId('goal-card-title')).toContainText('New York Trip');
    await expect(goalCard).toContainText('20.0% Completo');

    // 2. Realizar aporte de R$ 100,00
    await goalCard.getByTestId('goal-contribution-button').click();
    
    await page.getByTestId('contribution-amount-input').fill('100,00');
    await page.getByTestId('contribution-account-item').first().click();
    
    const submitBtn = page.getByTestId('contribution-submit-button');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText('Aporte Realizado')).toBeVisible({ timeout: 10000 });
  });

  test('should update surplus value on dashboard after goal contribution', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Garantir que carregou
    await expect(page.getByTestId('month-end-balance-value')).toBeVisible();
    await expect(page.getByTestId('month-end-balance-value')).toContainText('R$ 2.700,00');

    // Navegar e fazer aporte
    await page.goto('/goals');
    const goalCard = page.getByTestId('goal-card-goal-trip-001');
    await goalCard.getByTestId('goal-contribution-button').click();
    await page.getByTestId('contribution-amount-input').fill('100,00');
    await page.getByTestId('contribution-account-item').first().click();
    await page.getByTestId('contribution-submit-button').click();
    await expect(page.getByText('Aporte Realizado')).toBeVisible();

    // Mudar estado para o próximo carregamento
    mockState.user_profile.accumulated_balance_cents -= 10000;
    mockState.accounts[0].balance_cents -= 10000;
    
    // Voltar para Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('month-end-balance-value')).toContainText('R$ 2.600,00', { timeout: 10000 });
  });

  test('should display correct credit card limit and handle invoice payment', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForURL('**/accounts');
    await page.waitForLoadState('networkidle');

    // Esperar pelo card (pode demorar a renderizar se houver loader)
    const card = page.getByTestId('account-card-acc-card-001');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText('Disponível: R$ 4.700,00');

    // Pagar fatura
    await card.getByTestId('pay-invoice-button').click();
    await expect(page.getByText('Pagar Fatura')).toBeVisible();
    
    await page.getByTestId('confirm-payment-button').click();
    await expect(page.getByText('Pago com Sucesso')).toBeVisible();
    
    // Atualizar mock
    mockState.accounts[1].closed_invoice_cents = 0;
    mockState.accounts[1].balance_cents = 0; 
    mockState.user_profile.accumulated_balance_cents -= 30000;
    mockState.accounts[0].balance_cents -= 30000;

    // O modal deve fechar e a página atualizar
    await page.waitForTimeout(1000);
    await expect(card).toContainText('Disponível: R$ 5.000,00', { timeout: 10000 });
  });
});
