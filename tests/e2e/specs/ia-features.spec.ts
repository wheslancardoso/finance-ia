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
        } else if (body.action === 'optimize-sweep') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              advice: '### ⚡ Amortização Acelerada Copiloto\n\nIdentificamos uma oportunidade cirúrgica de economia no seu orçamento. Se você otimizar sua categoria **Lazer** e sua categoria **Alimentação**, você irá liberar **R$ 200,00** extras mensais.',
              suggested_simulation: {
                description: 'Amortização Acelerada (IA)',
                amount_cents: 20000,
                installments: 12,
                type: 'INCOME'
              }
            })
          });
          return;
        }
      }
      await route.continue();
    });
  });

  test('deve classificar transação de forma inteligente ao usar Auto-IA no modal', async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip(true, 'Modal de transações testado primariamente no desktop');
      return;
    }

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

    // Inserir texto sutil na descrição e preencher o valor
    const descInput = page.getByTestId('transaction-description-input');
    await descInput.fill('Almoço');

    const amountInput = page.getByTestId('transaction-amount-input');
    await amountInput.fill('45,00');

    // O botão de Auto-IA deve aparecer na tela e ser clicado
    const autoIAButton = page.getByTestId('auto-ia-button');
    await expect(autoIAButton).toBeVisible();
    await autoIAButton.click();

    // Aguardar o preenchimento inteligente apenas da categoria
    // A descrição deve continuar sendo "Almoço"
    await expect(descInput).toHaveValue('Almoço');
    
    // O valor deve continuar sendo "45,00"
    await expect(amountInput).toHaveValue('45,00');

    // A categoria "Alimentação" deve ter sido selecionada automaticamente
    const categorySpan = page.locator('span.text-white', { hasText: 'Alimentação' });
    await expect(categorySpan).toBeVisible();

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

    // Deve renderizar as duas recomendações mockadas especificamente dentro do painel para evitar Strict Mode
    await expect(iaPanel.getByText('Notebook Novo', { exact: true })).toBeVisible();
    await expect(iaPanel.getByText('Reserva de Emergência', { exact: true })).toBeVisible();
    await expect(iaPanel.getByText('Sugerida: #1')).toBeVisible();
    await expect(iaPanel.getByText('Sugerida: #2')).toBeVisible();

    // Os cards de metas na tela devem exibir os badges discreto de sugestão de prioridade
    await expect(page.getByTestId('goal-card-goal-2').getByText('Sugestão IA: Prioridade #1')).toBeVisible();
    await expect(page.getByTestId('goal-card-goal-1').getByText('Sugestão IA: Prioridade #2')).toBeVisible();

    // Clicar em aplicar as sugestões da IA
    await page.getByRole('button', { name: 'Aplicar Otimização Sugerida' }).click();

    // O painel deve fechar e as metas estarem com as novas prioridades salvas
    await expect(iaPanel).not.toBeVisible();
  });

  test('deve auditar e simular sweep de amortização acelerada via Copiloto IA', async ({ page }) => {
    const initialState = createInitialState({
      accounts: [
        { id: 'acc-1', name: 'Checking Account', type: 'CHECKING', balance_cents: 500000 },
        { id: 'acc-2', name: 'Cartão Gold', type: 'CREDIT_CARD', balance_cents: -300000, total_debt_cents: 300000, closed_invoice_cents: 300000, open_invoice_cents: 0 }
      ],
      goals: [
        { id: 'goal-1', name: 'Reserva de Emergência', target_amount_cents: 1000000, current_amount_cents: 100000, priority: 1, color_hex: '#10b981' }
      ]
    });

    await setupFinancialMocks(page, initialState);

    // Ir para a página de metas
    await page.goto('/goals');

    // O card de Otimização de Amortização Acelerada (IA) deve estar visível
    const analyzeSweepBtn = page.getByTestId('analyze-sweep-button');
    await expect(analyzeSweepBtn).toBeVisible();
    await analyzeSweepBtn.click();

    // Deve mostrar o texto do conselho em markdown
    await expect(page.getByText('Amortização Acelerada Copiloto')).toBeVisible();
    await expect(page.getByText('Amortização Acelerada (IA)')).toBeVisible();

    // O botão de aplicar a simulação deve aparecer
    const applySweepBtn = page.getByTestId('apply-sweep-button');
    await expect(applySweepBtn).toBeVisible();

    // Clicar em Simular Impacto no Sweep
    await applySweepBtn.click();

    // Deve mostrar a seção de Projeção Reativa Ativa e o botão de remover simulação
    const removeSweepBtn = page.getByTestId('remove-sweep-button');
    await expect(removeSweepBtn).toBeVisible();
    await expect(page.getByText('Projeção Reativa Ativa')).toBeVisible();

    // Ao clicar em remover, deve restaurar o estado original
    await removeSweepBtn.click();
    await expect(page.getByTestId('apply-sweep-button')).toBeVisible();
  });
});
