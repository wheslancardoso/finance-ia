import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Insights e Relatórios', () => {
  let sharedState: any;

  test.beforeEach(async ({ page }) => {
    sharedState = {
      user_profile: {
        id: 'user-1',
        monthly_income_cents: 500000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 100000,
        financial_health_score: 85
      },
      accounts: [
        { id: 'acc-1', name: 'Nubank', type: 'CHECKING', balance_cents: 100000, color_hex: '#8b5cf6' }
      ],
      categories: [
        { id: 'cat-1', name: 'Salário', type: 'INCOME', user_id: 'user-1', color_hex: '#10b981' }
      ],
      transactions: [
        { 
          id: 'tx-1', 
          description: 'Salário Mock', 
          amount_cents: 500000, 
          transaction_type: 'INCOME', 
          date: new Date().toISOString(),
          category_id: 'cat-1',
          account_id: 'acc-1'
        }
      ],
      goals: [],
      recurring_transactions: [],
      month_transactions: [
        { 
          id: 'tx-1', 
          description: 'Salário Mock', 
          amount_cents: 500000, 
          transaction_type: 'INCOME', 
          date: new Date().toISOString(),
          category_id: 'cat-1',
          category: { id: 'cat-1', name: 'Salário', color_hex: '#10b981' },
          account_id: 'acc-1'
        }
      ],
      recent_transactions: [],
      budgets: []
    };

    await setupFinancialMocks(page, sharedState);

    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', 'user-1');
    });

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir o score de saúde financeira corretamente', async ({ page }) => {
    const scoreValue = page.getByTestId('health-score-value');
    await expect(scoreValue).toContainText('85');
    
    // Verificar se a mensagem de feedback condicional está presente
    await expect(page.locator('text=Sua estrutura está resiliente')).toBeVisible();
  });

  test('deve renderizar os containers de gráficos', async ({ page }) => {
    // Esperar os títulos para garantir que a página carregou os cards
    await expect(page.locator('text=Evolução Patrimonial')).toBeVisible();
    await expect(page.locator('text=Mix de Receitas')).toBeVisible();
    
    // Verificar se os SVGs dos gráficos foram renderizados (Gauge + Evolution + Mix)
    // Usamos um timeout maior para as animações
    await expect(async () => {
      const svgs = page.locator('svg');
      const count = await svgs.count();
      expect(count).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
  });

  test('deve exibir a seção de análise de IA com insights', async ({ page }) => {
    await expect(page.locator('text=Análise de IA')).toBeVisible();
    await expect(page.locator('text=Nossa inteligência detectou')).toBeVisible();
  });

  test('deve alternar feedback do score quando o score é baixo', async ({ page }) => {
    // Atualizar o score no estado mock e recarregar
    sharedState.user_profile.financial_health_score = 45;
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('health-score-value')).toContainText('45');
    await expect(page.locator('text=Atenção ao fluxo de caixa')).toBeVisible();
  });
});
