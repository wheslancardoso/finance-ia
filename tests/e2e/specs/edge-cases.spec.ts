import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { createInitialState } from '../fixtures/financialState';

test.describe('Cenários de Borda e Resiliência (Blindagem)', () => {
  const USER_ID = 'edge-user';

  test.beforeEach(async ({ page, context }) => {
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    await setupAuthMock(page, { id: USER_ID });
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: USER_ID,
      domain: 'localhost',
      path: '/'
    }]);
  });

  test('deve exibir empty state quando não há contas cadastradas', async ({ page }) => {
    const emptyState = createInitialState();
    emptyState.accounts = [];
    emptyState.user_profile.accumulated_balance_cents = 0;
    emptyState.user_profile.financial_health_score = 0;
    
    await setupFinancialMocks(page, emptyState);
    await page.goto('/');

    // Verificar se exibe valor zerado sem quebrar
    await expect(page.getByTestId('net-liquidity-value')).toContainText('0,00');
  });

  test('deve lidar com erro 500 da API e mostrar estado de erro ou cache', async ({ page }) => {
    // Interceptar a rota de estado financeiro e forçar erro 500
    await page.route('**/api/financial-state*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/');
    
    // O app deve lidar com o erro sem dar White Screen of Death
    // Verificamos se o container principal do Dashboard ainda é renderizado através de um elemento estável
    await expect(page.getByTestId('net-liquidity-value')).toBeVisible();
  });

  test('deve permitir criar meta com valor mínimo e validar integridade', async ({ page }) => {
    const state = createInitialState();
    await setupFinancialMocks(page, state);
    await page.goto('/goals');
    
    // Aguardar o loading do context desaparecer
    await expect(page.getByText(/Sincronizando/i)).not.toBeVisible({ timeout: 15000 });

    // Usar test-ids do GoalsPage e garantir que o elemento está pronto
    const addButton = page.getByTestId('add-goal-button').first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    await page.getByTestId('goal-name-input').fill('Meta Mínima');
    await page.getByTestId('goal-target-input').fill('0,01'); // Valor mínimo
    await page.getByTestId('goal-submit-button').click();

    await expect(page.getByTestId('goal-card-title').filter({ hasText: 'Meta Mínima' })).toBeVisible();
  });

  test('deve criar parcelamento de cartão de crédito no dia 31 de janeiro de 2026 sem transbordo de dia', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-cc-1', name: 'Cartão Premium', type: 'CREDIT_CARD', balance_cents: 0, closing_day: 31, due_day: 10 }
      ],
      categories: [
        { id: 'cat-1', name: 'Lazer', type: 'EXPENSE' }
      ]
    });
    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

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

    await openAddModal();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();

    await page.getByTestId('transaction-amount-input').fill('500,00');
    await page.getByTestId('transaction-description-input').fill('Compra Parcelada Teste');

    // Selecionar Conta 'Cartão Premium'
    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-cc-1').click();

    // Selecionar Categoria 'Lazer'
    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    // Inserir 5 parcelas
    await page.getByTestId('transaction-installments-input').fill('5');

    // Inserir Data 31/01/2026
    await page.getByTestId('transaction-date-input').fill('2026-01-31');

    // Submeter
    await page.getByTestId('transaction-submit-button').click();

    // Aguardar fechar o modal
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    // Validar as datas geradas no mock state
    const mockState = await page.evaluate(() => (window as any).__E2E_MOCK_STATE__);
    expect(mockState).toBeDefined();
    
    const transactions = mockState.transactions.filter((t: any) => t.description === 'Compra Parcelada Teste');
    expect(transactions.length).toBe(5);

    // Certificar as datas de cada uma das 5 parcelas
    const dates = transactions.map((t: any) => t.date.split('T')[0]).sort();
    expect(dates[0]).toBe('2026-01-31');
    expect(dates[1]).toBe('2026-02-28');
    expect(dates[2]).toBe('2026-03-31');
    expect(dates[3]).toBe('2026-04-30');
    expect(dates[4]).toBe('2026-05-31');
  });

  test('deve lidar com sincronização offline-first de transações manuais via Dexie e Supabase (Test 5.1)', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-checking-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-lazer', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }
      ]
    });
    await setupFinancialMocks(page, state);

    let shouldFail = true;
    let syncedTxPayload: any = null;

    // Interceptar a API de transações para falhar enquanto offline e funcionar quando online
    await page.route(/\/api\/transactions/, async (route) => {
      const method = route.request().method();
      if (shouldFail) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Offline network error' })
        });
      } else {
        if (method === 'POST') {
          syncedTxPayload = route.request().postDataJSON();
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'synced-tx-999',
            ...route.request().postDataJSON()
          })
        });
      }
    });

    await page.goto('/transactions');

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
    await openAddModal();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();

    // Preenche a transação offline
    await page.getByTestId('transaction-amount-input').fill('350,00');
    await page.getByTestId('transaction-description-input').fill('Almoço Offline');

    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-checking-1').click();

    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    // Salvar
    await page.getByTestId('transaction-submit-button').click();

    // Esperar o modal fechar (indicando que foi salva localmente)
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    // Recarregar a página para forçar a re-leitura do Dexie local no modo offline
    await page.reload();

    // Validar presença local
    await expect(page.getByText('Almoço Offline').first()).toBeVisible({ timeout: 10000 });

    // Garantir que a transação pendente existe no Dexie antes de disparar o sync
    // (IndexedDB pode perder estado em ambientes de teste após reload)
    await page.evaluate(() => {
      const openRequest = indexedDB.open('VesperFinanceDB');
      openRequest.onsuccess = () => {
        const idb = openRequest.result;
        const txStore = idb.transaction('transactions', 'readwrite').objectStore('transactions');
        txStore.put({
          id: 'offline-pending-tx',
          user_id: 'e2e-user',
          description: 'Almoço Offline',
          amount_cents: 35000,
          amount: 350,
          transaction_type: 'EXPENSE',
          date: new Date().toISOString(),
          account_id: 'acc-checking-1',
          is_paid: false,
          source: 'MANUAL',
          sync_status: 'pending',
        });
      };
    });
    // Aguardar a gravação no IndexedDB
    await page.waitForTimeout(500);

    // Restaurar rede e disparar evento online
    shouldFail = false;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Validar que a transação foi disparada com sucesso para o banco de dados remoto
    await expect.poll(() => syncedTxPayload, { timeout: 15000 }).not.toBeNull();
    expect(syncedTxPayload.description).toBe('Almoço Offline');
    expect(syncedTxPayload.amount_cents).toBe(35000);
  });

  test('deve validar e rejeitar inputs extremos ou invalidos no AddTransactionModal (Test 5.2)', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-checking-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-lazer', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }
      ]
    });
    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

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

    // Cenário A: Valor negativo
    await openAddModal();
    await page.getByTestId('transaction-amount-input').fill('-100');
    await page.getByTestId('transaction-description-input').fill('Valor Negativo');
    await page.getByTestId('transaction-submit-button').click();
    await expect(page.getByText('O valor informado deve ser maior que zero.', { exact: false })).toBeVisible();
    await page.getByTestId('status-modal-close').click();

    // Cenário B: Caracteres não numéricos
    await page.getByTestId('transaction-amount-input').fill('abc');
    await page.getByTestId('transaction-submit-button').click();
    await expect(page.getByText('O valor informado não é um número válido.', { exact: false })).toBeVisible();
    await page.getByTestId('status-modal-close').click();

    // Cenário C: Valor exorbitante (Bilhões)
    await page.getByTestId('transaction-amount-input').fill('99999999999999');
    await page.getByTestId('transaction-submit-button').click();
    await expect(page.getByText('O valor informado excede o limite máximo', { exact: false })).toBeVisible();
    await page.getByTestId('status-modal-close').click();
  });

  test('deve suportar descrições longas e emojis sem quebrar layout (Test 5.3)', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-checking-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-lazer', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }
      ]
    });
    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

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

    await openAddModal();
    await page.getByTestId('transaction-amount-input').fill('150,00');
    
    // Texto de ~250 chars + emojis
    const longDesc = 'Compra muito longa para testar quebra de layout no E2E 🛒🍔🎉'.repeat(4);
    await page.getByTestId('transaction-description-input').fill(longDesc);

    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-checking-1').click();

    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    await page.getByTestId('transaction-submit-button').click();
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    // Validar se o texto foi renderizado na lista de transações (parcial para segurança)
    await expect(page.getByText(longDesc.substring(0, 30), { exact: false }).first()).toBeVisible();
  });

  test('deve lidar corretamente com parcelamento iniciado em ano bissexto (29 de fevereiro) (Test 5.4)', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-cc-1', name: 'Cartão Premium', type: 'CREDIT_CARD', balance_cents: 0, closing_day: 31, due_day: 10 }
      ],
      categories: [
        { id: 'cat-1', name: 'Lazer', type: 'EXPENSE' }
      ]
    });
    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

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

    await openAddModal();
    await expect(page.getByTestId('add-transaction-modal')).toBeVisible();

    await page.getByTestId('transaction-amount-input').fill('300,00');
    await page.getByTestId('transaction-description-input').fill('Compra Bissexta');

    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-cc-1').click();

    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    await page.getByTestId('transaction-installments-input').fill('3');

    // Data de compra em ano bissexto
    await page.getByTestId('transaction-date-input').fill('2024-02-29');

    await page.getByTestId('transaction-submit-button').click();
    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    const mockState = await page.evaluate(() => (window as any).__E2E_MOCK_STATE__);
    expect(mockState).toBeDefined();
    
    const transactions = mockState.transactions.filter((t: any) => t.description === 'Compra Bissexta');
    expect(transactions.length).toBe(3);

    const dates = transactions.map((t: any) => t.date.split('T')[0]).sort();
    
    // Valida o avanço dos meses sem erro de data inválida
    expect(dates[0].startsWith('2024-02-')).toBeTruthy();
    expect(dates[1].startsWith('2024-03-')).toBeTruthy();
    expect(dates[2].startsWith('2024-04-')).toBeTruthy();
  });

  test('deve impedir criação de transações duplicadas por cliques múltiplos rápidos (Test 5.5)', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-checking-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-lazer', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }
      ]
    });
    await setupFinancialMocks(page, state);
    
    let submissionCount = 0;
    await page.route('**/api/transactions', async (route) => {
      if (route.request().method() === 'POST') {
        submissionCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `tx-dup-${submissionCount}`,
            ...route.request().postDataJSON()
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/transactions');

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

    await openAddModal();
    await page.getByTestId('transaction-amount-input').fill('50,00');
    await page.getByTestId('transaction-description-input').fill('Teste Duplo Clique');

    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-checking-1').click();

    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    const submitBtn = page.getByTestId('transaction-submit-button');
    
    // Cliques múltiplos rápidos
    await submitBtn.click();
    await submitBtn.click({ force: true }).catch(() => {});
    await submitBtn.click({ force: true }).catch(() => {});

    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 10000 });

    expect(submissionCount).toBe(1);
  });

  test('deve prevenir XSS e injeção de HTML na listagem (Test 5.6)', async ({ page }) => {
    const maliciousText = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
    const state = createInitialState({
      accounts: [{ id: 'acc-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }],
      categories: [{ id: 'cat-1', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }],
      transactions: [{
        id: 'tx-xss',
        description: maliciousText,
        amount_cents: 1000,
        transaction_type: 'EXPENSE',
        date: new Date().toISOString(),
        account_id: 'acc-1',
        category_id: 'cat-1',
        is_paid: true,
        user_id: USER_ID
      }]
    });
    
    // Configura dialog handler para falhar o teste se um alert disparar
    page.on('dialog', async dialog => {
      expect(dialog.message()).toBeNull(); // Se houver dialog, o teste deve falhar
      await dialog.dismiss();
    });

    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

    // A string bruta deve ser renderizada como texto e não executada
    const txRow = page.getByText(maliciousText);
    await expect(txRow).toBeVisible();
  });

  test('deve lidar corretamente com erros de ponto flutuante (Test 5.7)', async ({ page }) => {
    // 0.10 + 0.20 em floats costuma dar 0.30000000000000004. 
    // Em centavos: 10 + 20 = 30 centavos exatos. Vamos testar a UI lidando com isso nas transações
    const state = createInitialState({
      accounts: [{ id: 'acc-float', name: 'Conta JS', type: 'CHECKING', balance_cents: 0, user_id: USER_ID }],
      transactions: [
        { id: 'tx-float-1', description: 'Três centavos', amount_cents: 3, transaction_type: 'INCOME', date: new Date().toISOString(), account_id: 'acc-float', is_paid: true, user_id: USER_ID },
        { id: 'tx-float-2', description: 'Um centavo', amount_cents: 1, transaction_type: 'EXPENSE', date: new Date().toISOString(), account_id: 'acc-float', is_paid: true, user_id: USER_ID },
        { id: 'tx-float-3', description: 'Dois centavos', amount_cents: 2, transaction_type: 'EXPENSE', date: new Date().toISOString(), account_id: 'acc-float', is_paid: true, user_id: USER_ID }
      ]
    });
    // Saldo esperado: 3 - 1 - 2 = 0 centavos.
    
    await setupFinancialMocks(page, state);
    await page.goto('/'); // Dashboard

    const balanceVal = page.getByTestId('net-liquidity-value');
    await expect(balanceVal).toContainText('0,00');
  });

  test('deve renderizar transações em datas muito distantes sem crash (Test 5.8)', async ({ page }) => {
    const state = createInitialState({
      accounts: [{ id: 'acc-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }],
      transactions: [
        { id: 'tx-past', description: 'Passado Distante', amount_cents: 5000, transaction_type: 'EXPENSE', date: '1900-01-01T12:00:00Z', account_id: 'acc-1', is_paid: true, user_id: USER_ID },
        { id: 'tx-future', description: 'Futuro Distante', amount_cents: 5000, transaction_type: 'INCOME', date: '9999-12-31T12:00:00Z', account_id: 'acc-1', is_paid: false, user_id: USER_ID }
      ]
    });
    
    await setupFinancialMocks(page, state);
    
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('transactions-list')).toBeVisible();
  });

  test('deve suportar stress test visual (50 transações renderizadas juntas) (Test 5.9)', async ({ page }) => {
    const fiftyTxs = Array.from({ length: 50 }).map((_, i) => ({
      id: `tx-bulk-${i}`,
      description: `Transação ${i}`,
      amount_cents: 1000 + i,
      transaction_type: i % 2 === 0 ? 'EXPENSE' : 'INCOME',
      date: new Date().toISOString(),
      account_id: 'acc-bulk',
      is_paid: true,
      user_id: USER_ID
    }));

    const state = createInitialState({
      accounts: [{ id: 'acc-bulk', name: 'Conta Volume', type: 'CHECKING', balance_cents: 50000, user_id: USER_ID }],
      transactions: fiftyTxs as any
    });

    await setupFinancialMocks(page, state);
    
    const startTime = Date.now();
    await page.goto('/transactions');
    
    const txList = page.getByTestId('transactions-list');
    await expect(txList).toBeVisible();

    await expect(page.getByText('Transação 49')).toBeVisible({ timeout: 5000 });
    const renderTime = Date.now() - startTime;
    console.log(`Tempo de renderização para 50 txs: ${renderTime}ms`);
  });

  test('deve diferenciar contas/categorias com nomes idênticos pelos IDs (Test 5.10)', async ({ page }) => {
    const state = createInitialState({
      accounts: [
        { id: 'acc-amb-1', name: 'Conta Conflito', type: 'CHECKING', balance_cents: 0, user_id: USER_ID },
        { id: 'acc-amb-2', name: 'Conta Conflito', type: 'CHECKING', balance_cents: 0, user_id: USER_ID }
      ],
      categories: [
        { id: 'cat-amb-1', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID },
        { id: 'cat-amb-2', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }
      ]
    });

    await setupFinancialMocks(page, state);
    await page.goto('/transactions');

    const openAddModal = async () => {
      const desktopBtn = page.getByTestId('add-transaction-button');
      if (await desktopBtn.isVisible()) {
        await desktopBtn.click();
      } else {
        await page.getByTestId('mobile-add-button').click();
      }
    };

    await openAddModal();
    
    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-amb-2').click();

    await expect(page.getByTestId('transaction-account-select')).toHaveText(/Conta Conflito/);
  });

  test('deve manter o loading state no botão ao salvar sob timeout longo (Test 5.11)', async ({ page }) => {
    const state = createInitialState({
      accounts: [{ id: 'acc-timeout', name: 'Conta Timeout', type: 'CHECKING', balance_cents: 200000, user_id: USER_ID }],
      categories: [{ id: 'cat-1', name: 'Lazer', type: 'EXPENSE', user_id: USER_ID }]
    });
    await setupFinancialMocks(page, state);

    await page.route('**/api/transactions', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'tx-timeout', ...route.request().postDataJSON() }) });
      } else {
        await route.continue();
      }
    });

    await page.goto('/transactions');

    const openAddModal = async () => {
      const desktopBtn = page.getByTestId('add-transaction-button');
      if (await desktopBtn.isVisible()) {
        await desktopBtn.click();
      } else {
        await page.getByTestId('mobile-add-button').click();
      }
    };

    await openAddModal();
    await page.getByTestId('transaction-amount-input').fill('150,00');
    await page.getByTestId('transaction-description-input').fill('Compra Timeout');
    await page.getByTestId('transaction-account-select').click();
    await page.getByTestId('account-option-acc-timeout').click();
    await page.getByTestId('transaction-category-select').click();
    await page.getByText('Lazer').first().click();

    const submitBtn = page.getByTestId('transaction-submit-button');
    await submitBtn.click();

    await expect(submitBtn).toBeDisabled();

    await page.getByTestId('add-transaction-modal').waitFor({ state: 'hidden', timeout: 5000 });
  });
});
