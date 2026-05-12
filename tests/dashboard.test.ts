import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Dashboard e Projeções Financeiras', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    // Obter datas dinâmicas mas estáveis para o mês atual
    const now = new Date();
    const midMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();

    // Estado inicial padrão (Saudável)
    mockState = {
      user_profile: {
        monthly_income_cents: 1000000, // R$ 10.000,00 (Meta)
        fixed_expenses_cents: 200000,  // R$ 2.000,00 (Meta)
        accumulated_balance_cents: 0, 
        financial_health_score: 85,
      },
      accounts: [
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Conta Corrente',
          type: 'CHECKING',
          balance_cents: 0, 
          color_hex: '#10b981'
        }
      ],
      categories: [
        { id: '550e8400-e29b-41d4-a716-446655440004', name: 'Aluguel', type: 'EXPENSE', icon: 'Home', color: '#ef4444' },
        { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Salário', type: 'INCOME', icon: 'Dollar', color: '#10b981' }
      ],
      recurring_transactions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          description: 'Salário',
          amount_cents: 1000000, // +10k
          transaction_type: 'INCOME',
          category_id: '550e8400-e29b-41d4-a716-446655440005',
          account_id: '550e8400-e29b-41d4-a716-446655440003',
          status: 'active',
          next_date: midMonth,
          frequency: 'monthly'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          description: 'Aluguel',
          amount_cents: 200000, // -2k
          transaction_type: 'EXPENSE',
          category_id: '550e8400-e29b-41d4-a716-446655440004',
          account_id: '550e8400-e29b-41d4-a716-446655440003',
          status: 'active',
          next_date: midMonth,
          frequency: 'monthly'
        }
      ],
      transactions: [],
      month_transactions: [],
      recent_transactions: [],
      goals: [],
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

  test('deve exibir métricas de saúde financeira corretamente no modo saudável', async ({ page }) => {
    // 10k - 2k = 8k
    // Usamos toPass para garantir que o contexto terminou de processar as assinaturas
    await expect(async () => {
      const ceilingValue = page.getByTestId('survival-ceiling-value');
      await expect(ceilingValue).toContainText('8.000,00');
    }).toPass({ timeout: 10000 });
    
    await expect(page.getByTestId('survival-status-message')).toContainText('Fluxo Estável');
  });

  test('deve alternar entre modos de visualização no Survival HUD', async ({ page }) => {
    const ceilingValue = page.getByTestId('survival-ceiling-value');
    
    await expect(async () => {
       await expect(ceilingValue).toContainText('8.000,00');
    }).toPass();

    // Alternar para Dia
    await page.getByTestId('survival-view-mode-day').click();
    await expect(async () => {
      const val = await ceilingValue.innerText();
      const num = parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.'));
      expect(num).toBeGreaterThan(0);
      expect(num).toBeLessThan(8000);
    }).toPass();
  });

  test('deve entrar em MODO CRISE quando a liquidez é negativa e o mês termina no vermelho', async ({ page }) => {
    // Simular estado de crise
    // Forçar crise: saldo negativo + despesas maiores que receitas
    mockState.accounts[0].balance_cents = -500000;
    mockState.recurring_transactions = [
      { id: 'rec-1', amount_cents: 0, transaction_type: 'INCOME', status: 'active', next_date: new Date(Date.now() + 86400000).toISOString(), frequency: 'monthly' },
      { id: 'rec-2', amount_cents: 1000000, transaction_type: 'EXPENSE', status: 'active', next_date: new Date(Date.now() + 86400000).toISOString(), frequency: 'monthly' }
    ];
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(async () => {
      await expect(page.getByTestId('survival-status-message')).toContainText(/MODO CRISE ATIVADO/i);
    }).toPass({ timeout: 15000 });
    
    await expect(page.getByText(/Meta de Salvação/i)).toBeVisible();
  });

  test('deve refletir mudanças de assinaturas no saldo projetado do Dashboard', async ({ page }) => {
    // Primeiro garantir que o estado inicial está certo
    await expect(async () => {
      await expect(page.getByTestId('survival-ceiling-value')).toContainText('8.000,00');
    }).toPass();

    // Navegar para Fluxos
    await page.goto('/subscriptions');
    await page.getByTestId('add-subscription-button').click();
    
    await page.getByTestId('subscription-description-input').fill('Gasto Gigante');
    await page.getByTestId('subscription-amount-input').fill('5000,00');
    
    const submitBtn = page.getByTestId('subscription-submit-button');
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    
    // Esperar o status modal de sucesso (Entendido) e confirmar
    const okBtn = page.getByRole('button', { name: /Entendido/i });
    await expect(okBtn).toBeVisible({ timeout: 10000 });
    await okBtn.click();
    
    // Esperar o modal fechar
    await expect(page.getByTestId('add-subscription-modal')).not.toBeVisible({ timeout: 10000 });
    
    // Voltar para o Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 8k inicial - 5k novo = 3k
    await expect(async () => {
      const ceiling = page.getByTestId('survival-ceiling-value');
      await expect(ceiling).toContainText('3.000,00');
    }).toPass({ timeout: 15000 });
  });
});
