import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createInitialState } from '../fixtures/financialState';

test.describe('Integração de IA Soberana e Copiloto', () => {
  const USER_ID = 'ia-user';

  test.beforeEach(async ({ page }) => {
    // Log do console para diagnóstico
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    await setupAuthMock(page, { id: USER_ID });

    // Interceptação determinística da Rota de IA
    await page.route('**/api/ia', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body.action === 'classify-transaction') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              description: 'Almoço Executivo Inteligente',
              amount_cents: 4500,
              category_id: 'cat-alimentacao'
            })
          });
          return;
        } else if (body.action === 'optimize-goals') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              recommendations: [
                {
                  goal_id: 'goal-1',
                  suggested_priority: 2,
                  reason: 'Reserva de Emergência tem maior resiliência sob crise'
                },
                {
                  goal_id: 'goal-2',
                  suggested_priority: 1,
                  reason: 'Meta Notebook deve ser priorizada temporariamente'
                }
              ]
            })
          });
          return;
        }
      }
      await route.continue();
    });
  });

  test('deve classificar transação de forma inteligente ao usar Auto-IA no modal', async ({ page }) => {
    const initialState = createInitialState({
      accounts: [
        { id: 'acc-1', name: 'Banco Principal', type: 'CHECKING', balance_cents: 500000 }
      ],
      categories: [
        { id: 'cat-alimentacao', name: 'Alimentação', type: 'EXPENSE', color_hex: '#ef4444' }
      ]
    });

    await setupFinancialMocks(page, initialState);

    // Ir para a página de transações
    await page.goto('/transactions');

    // Clicar para adicionar transação
    await page.getByTestId('add-transaction-button').click();

    // Inserir texto sutil na descrição
    const descInput = page.getByTestId('transaction-description-input');
    await descInput.fill('Almoço');

    // O botão de Auto-IA deve aparecer na tela e ser clicado
    const autoIAButton = page.getByTestId('auto-ia-button');
    await expect(autoIAButton).toBeVisible();
    await autoIAButton.click();

    // Aguardar o preenchimento reativo inteligente
    // A descrição deve atualizar para "Almoço Executivo Inteligente", o valor para "45,00" e a categoria para "Alimentação"
    await expect(descInput).toHaveValue('Almoço Executivo Inteligente');
    
    const amountInput = page.getByTestId('transaction-amount-input');
    await expect(amountInput).toHaveValue('45,00');

    // Confirmar e fechar modal
    await page.getByTestId('transaction-submit-button').click();
    await expect(page.getByTestId('transaction-modal')).not.toBeVisible();
  });

  test('deve auditar e reordenar prioridades de metas reativamente via Copiloto IA', async ({ page }) => {
    const initialState = createInitialState({
      goals: [
        { id: 'goal-1', name: 'Reserva de Emergência', target_amount_cents: 1000000, current_amount_cents: 100000, priority: 1, color_hex: '#10b981' },
        { id: 'goal-2', name: 'Notebook Novo', target_amount_cents: 800000, current_amount_cents: 0, priority: 2, color_hex: '#f59e0b' }
      ]
    });

    await setupFinancialMocks(page, initialState);

    // Ir para a página de metas
    await page.goto('/goals');

    // O botão de auditar com IA deve estar visível e ser clicável
    const optimizeBtn = page.getByTestId('optimize-goals-ia-button');
    await expect(optimizeBtn).toBeVisible();
    await optimizeBtn.click();

    // O painel de recomendações da IA deve abrir
    const iaPanel = page.getByTestId('ia-recommendations-panel');
    await expect(iaPanel).toBeVisible();

    // Deve renderizar as duas recomendações mockadas
    await expect(page.getByText('Notebook Novo')).toBeVisible();
    await expect(page.getByText('Reserva de Emergência')).toBeVisible();
    await expect(page.getByText('Sugerida: #1')).toBeVisible();
    await expect(page.getByText('Sugerida: #2')).toBeVisible();

    // Os cards de metas na tela devem exibir os badges discreto de sugestão de prioridade
    await expect(page.getByText('Sugestão IA: Prioridade #1')).toBeVisible();
    await expect(page.getByText('Sugestão IA: Prioridade #2')).toBeVisible();

    // Clicar em aplicar as sugestões da IA
    await page.getByRole('button', { name: 'Aplicar Otimização Sugerida' }).click();

    // O painel deve fechar e as metas estarem com as novas prioridades salvas
    await expect(iaPanel).not.toBeVisible();
  });
});
