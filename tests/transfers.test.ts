import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from './mocks/financialMocks';

test.describe('Transferências entre Contas', () => {
  let mockState: any;

  test.beforeEach(async ({ page }) => {
    mockState = {
      user_profile: {
        monthly_income_cents: 1000000,
        fixed_expenses_cents: 200000,
        accumulated_balance_cents: 1500000,
        financial_health_score: 85,
      },
      accounts: [
        {
          id: 'acc-checking',
          name: 'Conta Corrente',
          type: 'CHECKING',
          balance_cents: 1000000, // 10k
          color_hex: '#10b981'
        },
        {
          id: 'acc-savings',
          name: 'Reserva',
          type: 'SAVINGS',
          balance_cents: 500000, // 5k
          color_hex: '#8b5cf6'
        }
      ],
      categories: [
        { id: 'cat-transf', name: 'Transferência', type: 'EXPENSE', icon: 'ArrowRightLeft', color: '#6366f1' }
      ],
      goals: [],
      recurring_transactions: [],
      transactions: [],
      month_transactions: [],
      recent_transactions: [],
      budgets: []
    };

    await setupFinancialMocks(page, mockState);

    // Interceptar API de Contas para atualização de saldo
    await page.route(url => url.pathname.includes('/api/accounts'), async (route) => {
      const method = route.request().method();
      if (method === 'POST' || method === 'PATCH') {
        const payload = route.request().postDataJSON();
        const accIdx = mockState.accounts.findIndex((a: any) => a.id === payload.id);
        if (accIdx !== -1) {
          console.log(`[TEST-MOCK] Updating account ${payload.name} balance to ${payload.balance_cents}`);
          mockState.accounts[accIdx] = { ...mockState.accounts[accIdx], ...payload };
          await route.fulfill({ status: 200, body: JSON.stringify(mockState.accounts[accIdx]) });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    // Interceptar API de Transações para registrar a transferência
    await page.route(url => url.pathname.includes('/api/transactions'), async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        console.log(`[TEST-MOCK] Creating transfer transaction: ${payload.description}`);
        mockState.transactions.push({ ...payload, id: `tx-${Date.now()}` });
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.continue();
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('vesper_user_id', 'vesper-user-id');
    });

    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
  });

  test('deve realizar uma transferência entre duas contas com sucesso', async ({ page }) => {
    // 1. Abrir modal de transferência
    await page.getByTestId('open-transfer-button').click();
    await expect(page.getByTestId('transfer-modal')).toBeVisible();

    // 2. Preencher valor (2k)
    await page.getByTestId('transfer-amount-input').fill('2.000,00');

    // 3. Selecionar Origem (Conta Corrente)
    await page.getByTestId('transfer-from-account-select').click();
    await page.getByTestId('transfer-account-from-acc-checking').click();

    // 4. Selecionar Destino (Reserva)
    await page.getByTestId('transfer-to-account-select').click();
    await page.getByTestId('transfer-account-to-acc-savings').click();

    // 5. Confirmar
    await page.getByTestId('transfer-submit-button').click();

    // 6. Verificar se o modal fechou
    await expect(page.getByTestId('transfer-modal')).not.toBeVisible();

    // 7. Verificar se os saldos foram atualizados na UI
    // Conta Corrente: 10k -> 8k
    // Reserva: 5k -> 7k
    await expect(page.getByTestId('account-card-acc-checking')).toContainText('8.000,00');
    await expect(page.getByTestId('account-card-acc-savings')).toContainText('7.000,00');
    
    // 8. Verificar HUD de Liquidez (deve permanecer 15k, pois é transferência interna)
    await expect(page.getByTestId('hud-net-liquidity')).toContainText('15.000,00');
  });

  test('deve impedir transferência com saldo insuficiente', async ({ page }) => {
    await page.getByTestId('open-transfer-button').click();
    
    // Tentar transferir 20k (saldo é 10k)
    await page.getByTestId('transfer-amount-input').fill('20.000,00');
    
    await page.getByTestId('transfer-submit-button').click();

    // Deve exibir modal de status com erro
    await expect(page.getByText('Saldo Insuficiente')).toBeVisible();
    await page.getByTestId('status-modal-close').click();
    
    // Modal de transferência deve continuar aberto
    await expect(page.getByTestId('transfer-modal')).toBeVisible();
  });

  test('deve impedir transferência para a mesma conta', async ({ page }) => {
    await page.getByTestId('open-transfer-button').click();
    await page.getByTestId('transfer-amount-input').fill('100,00');
    
    // Selecionar mesma conta em ambos
    await page.getByTestId('transfer-from-account-select').click();
    await page.getByTestId('transfer-account-from-acc-checking').click();
    
    await page.getByTestId('transfer-to-account-select').click();
    await page.getByTestId('transfer-account-to-acc-checking').click();
    
    await page.getByTestId('transfer-submit-button').click();

    await expect(page.getByText('Contas Idênticas')).toBeVisible();
  });
});
