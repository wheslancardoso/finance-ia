import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Dashboard e Projeções Financeiras', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
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
          id: 'acc-1',
          name: 'Conta Corrente',
          type: 'CHECKING',
          balance_cents: 0, // Começamos com zero para facilitar a conta
          color: '#10b981'
        }
      ],
      categories: [
        { id: 'cat-1', name: 'Aluguel', type: 'EXPENSE', icon: 'Home', color: '#ef4444' },
        { id: 'cat-2', name: 'Salário', type: 'INCOME', icon: 'Dollar', color: '#10b981' }
      ],
      recurring_transactions: [
        {
          id: 'rec-1',
          description: 'Salário',
          amount_cents: 1000000, // +10k
          transaction_type: 'INCOME',
          category_id: 'cat-2',
          account_id: 'acc-1',
          status: 'active',
          next_date: new Date().toISOString()
        },
        {
          id: 'rec-2',
          description: 'Aluguel',
          amount_cents: 200000, // -2k
          transaction_type: 'EXPENSE',
          category_id: 'cat-1',
          account_id: 'acc-1',
          status: 'active',
          next_date: new Date().toISOString()
        }
      ],
      transactions: [],
      month_transactions: [],
      recent_transactions: [],
      goals: [],
      budgets: []
    };

    await setupFinancialMocks(page, mockState);
    
    // Set user id in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', 'vesper-user-id');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir métricas de saúde financeira corretamente no modo saudável', async ({ page }) => {
    // Verificar Health Score
    await expect(page.getByTestId('health-score-value')).toContainText('85');
    
    // Verificar Liquidez Líquida (R$ 0,00 pois balance é 0)
    await expect(page.getByTestId('net-liquidity-value')).toContainText('0,00');
    
    // Verificar Teto de Sobrevivência (0 + 10.000 - 2.000 = 8.000)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText('8.000,00');
    
    // Verificar mensagem de status
    await expect(page.getByTestId('survival-status-message')).toContainText('Fluxo Estável');
  });

  test('deve alternar entre modos de visualização no Survival HUD', async ({ page }) => {
    const ceilingValue = page.getByTestId('survival-ceiling-value');
    
    // Mês (Padrão) - R$ 8.000,00
    await expect(ceilingValue).toContainText('8.000,00');
    
    // Alternar para Dia
    await page.getByTestId('survival-view-mode-day').click();
    // O valor deve ser menor (8000 / dias restantes)
    const dayValue = await ceilingValue.innerText();
    expect(parseFloat(dayValue.replace(/[^\d,]/g, '').replace(',', '.'))).toBeLessThan(8000);
    
    // Alternar para Semana
    await page.getByTestId('survival-view-mode-week').click();
    const weekValue = await ceilingValue.innerText();
    expect(parseFloat(weekValue.replace(/[^\d,]/g, '').replace(',', '.'))).toBeLessThan(8000);
  });

  test('deve entrar em MODO CRISE quando a liquidez é negativa e o mês termina no vermelho', async ({ page }) => {
    // Simular estado de crise (Saldo negativo e sem renda suficiente para cobrir)
    mockState.accounts[0].balance_cents = -100000; // R$ -1.000,00 (Liquidez negativa)
    mockState.recurring_transactions[0].amount_cents = 0; // Zerar salário (+0)
    mockState.user_profile.financial_health_score = 10;
    
    // Recarregar para aplicar novo mockState
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verificar mensagem de crise
    await expect(page.getByTestId('survival-status-message')).toContainText('MODO CRISE ATIVADO');
    
    // Verificar se o container tem a classe de erro (ou pulse)
    const hudContainer = page.getByTestId('survival-hud-container');
    await expect(hudContainer).toHaveClass(/shadow-\[0_0_25px_rgba\(244,63,94,0\.5\)\]/);
    
    // Verificar se a "Meta de Salvação" aparece (visível apenas em telas grandes, então forçamos viewport se necessário)
    // No Playwright o default é 1280x720, que deve mostrar se for lg:flex
    await expect(page.getByText('Meta de Salvação')).toBeVisible();
    await expect(page.getByTestId('salvation-goal-value')).toContainText('1.000,00');
  });

  test('deve refletir mudanças de assinaturas no saldo projetado do Dashboard', async ({ page }) => {
    // Valor inicial: R$ 8.000,00
    await expect(page.getByTestId('survival-ceiling-value')).toContainText('8.000,00');
    
    // Navegar para assinaturas e adicionar um gasto gigante
    await page.goto('/subscriptions');
    await page.getByTestId('add-subscription-button').click();
    await page.getByTestId('subscription-description-input').fill('Gasto Gigante');
    await page.getByTestId('subscription-amount-input').fill('5.000,00');
    await page.getByTestId('subscription-submit-button').click();
    await page.getByTestId('status-modal-close').click();
    
    // Voltar para o Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // O valor deve ter caído para R$ 3.000,00 (8000 - 5000)
    await expect(page.getByTestId('survival-ceiling-value')).toContainText('3.000,00');
    
    // Status deve ter mudado para "Atenção ao Orçamento" ou "Sobrevivência Crítica"
    // 3000 / 10000 = 30% -> "Atenção ao Orçamento"
    await expect(page.getByTestId('survival-status-message')).toContainText('Atenção ao Orçamento');
  });
});
