import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Gestão de Ambições (Metas)', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      user_profile: {
        monthly_income_cents: 1000000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 500000,
        financial_health_score: 85,
      },
      accounts: [
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Conta Corrente',
          type: 'CHECKING',
          balance_cents: 500000,
          color_hex: '#10b981'
        }
      ],
      categories: [
        { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Investimento', type: 'EXPENSE', icon: 'TrendingUp', color: '#8b5cf6' }
      ],
      goals: [
        {
          id: '550e8400-e29b-41d4-a716-446655442001',
          name: 'Viagem para Japão',
          target_amount_cents: 2000000, // 20k
          current_amount_cents: 500000,  // 5k
          color_hex: '#8b5cf6',
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        }
      ],
      recurring_transactions: [],
      transactions: [],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };

    await setupFinancialMocks(page, mockState);
    
    // Interceptar API de Metas (Cobre /api/goals e /rest/v1/goals)
    await page.route(url => url.pathname.includes('/goals'), async (route) => {
      const method = route.request().method();
      console.log(`[TEST-MOCK] ${method} ${route.request().url()}`);
      
      if (method === 'POST' || method === 'PATCH') {
        const payload = route.request().postDataJSON();
        const existingIdx = mockState.goals.findIndex((g: any) => g.id === payload.id);
        
        if (existingIdx !== -1) {
          console.log(`[TEST-MOCK] Updating goal ${payload.id}`);
          mockState.goals[existingIdx] = { ...mockState.goals[existingIdx], ...payload };
          await route.fulfill({ status: 200, body: JSON.stringify(mockState.goals[existingIdx]) });
        } else {
          console.log(`[TEST-MOCK] Creating goal ${payload.name}`);
          const newGoal = { ...payload, id: payload.id || `goal-${Date.now()}`, created_at: new Date().toISOString() };
          mockState.goals.push(newGoal);
          await route.fulfill({ status: 200, body: JSON.stringify(newGoal) });
        }
      } else if (method === 'DELETE') {
        const url = new URL(route.request().url());
        let id = url.searchParams.get('id') || '';
        if (id.startsWith('eq.')) id = id.substring(3);
        
        console.log(`[TEST-MOCK] Deleting goal ${id}`);
        mockState.goals = mockState.goals.filter((g: any) => g.id !== id);
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.continue();
      }
    });

    // Interceptar API de Transações
    await page.route(url => url.pathname.includes('/transactions'), async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        const account = mockState.accounts.find((a: any) => a.id === payload.account_id);
        if (account) {
          console.log(`[TEST-MOCK] Updating balance for ${account.name}. Amount: ${payload.amount_cents}`);
          if (payload.transaction_type === 'EXPENSE') {
            account.balance_cents -= payload.amount_cents;
          } else {
            account.balance_cents += payload.amount_cents;
          }
        }
        await route.fulfill({ status: 200, body: JSON.stringify({ ...payload, id: `tx-${Date.now()}` }) });
      } else {
        await route.continue();
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', 'vesper-user-id');
    });

    await page.goto('/goals');
    await page.waitForLoadState('networkidle');
  });

  test('deve criar uma nova meta com sucesso', async ({ page }) => {
    await page.getByTestId('add-goal-button').first().click();
    
    await page.getByTestId('goal-name-input').fill('Reserva de Emergência');
    await page.getByTestId('goal-target-input').fill('10.000,00');
    await page.getByTestId('goal-current-input').fill('1.000,00');
    
    await page.getByTestId('goal-submit-button').click();
    
    await expect(page.getByTestId('goal-card-title').filter({ hasText: 'Reserva de Emergência' })).toBeVisible();
  });

  test('deve realizar um aporte em uma meta existente', async ({ page }) => {
    await page.getByTestId('goal-card-550e8400-e29b-41d4-a716-446655442001').getByTestId('goal-contribution-button').click();
    await page.getByTestId('contribution-amount-input').fill('500,00');
    await page.getByTestId('contribution-account-item').click();
    await page.getByTestId('contribution-submit-button').click();
    
    await expect(page.getByText('Aporte Realizado')).toBeVisible();
    await page.getByTestId('status-modal-close').click();
    
    await expect(page.getByTestId('goal-card-550e8400-e29b-41d4-a716-446655442001')).toContainText('5.500,00');
    await expect(page.getByTestId('hud-net-liquidity')).toContainText('4.500,00');
  });

  test('deve excluir uma meta', async ({ page }) => {
    await page.getByTestId('goal-card-550e8400-e29b-41d4-a716-446655442001').getByTestId('goal-details-button').click();
    await page.getByTestId('delete-goal-button').click();
    await page.getByTestId('confirm-button').click();
    
    await expect(page.getByTestId('goal-card-title').filter({ hasText: 'Viagem para Japão' })).not.toBeVisible();
  });

  test('deve abrir aporte a partir de uma recomendação', async ({ page }) => {
    const rec = page.getByTestId('goal-recommendation-item').first();
    await expect(rec).toBeVisible();
    await rec.click();
    
    await expect(page.getByText('Realizar Aporte')).toBeVisible();
    await expect(page.getByTestId('contribution-goal-name')).toHaveText('Viagem para Japão');
  });
});
