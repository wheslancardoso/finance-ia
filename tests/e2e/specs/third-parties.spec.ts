import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createInitialState } from '../fixtures/financialState';

test.describe('Repasse de Terceiros e Abatimento de Saldos', () => {
  const USER_ID = 'third-party-user';
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    // Capturar logs do console do navegador para depuração
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE ${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.log(`[BROWSER UNCAUGHT ERROR]: ${err.message}`);
    });

    mockState = createInitialState({
      accounts: [
        { id: 'acc-checking', name: 'Conta Corrente', type: 'CHECKING', balance_cents: 100000 }
      ],
      transactions: []
    });
    await setupFinancialMocks(page, mockState);
    await setupAuthMock(page, { id: USER_ID });
  });

  test('deve registrar gastos de terceiro e abater saldo com receitas', async ({ page }) => {
    // Helper local para clicar no botão de Adicionar Transação de acordo com o viewport
    const openAddModal = async () => {
      const desktopBtn = page.getByTestId('add-transaction-button');
      if (await desktopBtn.isVisible()) {
        await desktopBtn.click();
      } else {
        const mobileBtn = page.getByTestId('mobile-add-button');
        await mobileBtn.waitFor({ state: 'visible' });
        await mobileBtn.click();
      }
    };

    // 1. Ir para a página de transações
    await page.goto('/transactions');

    // 2. Criar uma despesa para Terceiro
    await openAddModal();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();

    await page.getByTestId('transaction-amount-input').fill('50,00');
    await page.getByTestId('transaction-description-input').fill('Lanche Emprestado');
    
    // Clicar no toggle de terceiro
    await page.getByTestId('transaction-third-party-toggle').click();
    
    // Inserir nome do contato
    await page.getByTestId('transaction-third-party-name-input').fill('Thiago');
    
    // Submeter
    await page.getByTestId('transaction-submit-button').click();
    
    // Esperar fechar deterministicamente
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    // 3. Ir para a rota de terceiros e validar o recebível
    await page.goto('/third-parties');
    
    // Validar se o card do Thiago com valor de R$ 50,00 a receber está visível
    await expect(page.getByText('THIAGO')).toBeVisible();
    await expect(page.getByText('R$ 50,00').first()).toBeVisible();
 
    // 4. Registrar um pagamento/receita (PIX) recebido do Thiago para abater a dívida
    await page.goto('/transactions');
    await openAddModal();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();
 
    // Mudar para receita/entrada
    await page.getByRole('button', { name: 'Entrada' }).click();
    
    await page.getByTestId('transaction-amount-input').fill('20,00');
    await page.getByTestId('transaction-description-input').fill('Pix Thiago');
    
    // Clicar no toggle de terceiro
    await page.getByTestId('transaction-third-party-toggle').click();
    
    // Inserir nome do contato
    await page.getByTestId('transaction-third-party-name-input').fill('Thiago');
    
    // Submeter
    await page.getByTestId('transaction-submit-button').click();
    
    // Esperar fechar deterministicamente
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });
 
    // 5. Voltar para a rota de terceiros e certificar que o saldo foi abatido
    await page.goto('/third-parties');
    await expect(page.getByText('THIAGO')).toBeVisible();
    
    // O saldo deve agora ser R$ 30,00 (50,00 - 20,00)
    await expect(page.getByText('R$ 30,00').first()).toBeVisible();
  });
});
