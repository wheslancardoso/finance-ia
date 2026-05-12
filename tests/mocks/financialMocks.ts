import { Page } from '@playwright/test';

export async function setupFinancialMocks(page: Page, state: any) {
  // Monitor de rede global para depuração de rotas
  page.on('request', request => {
    const url = request.url();
  });

  // Injeta o estado diretamente no window e desabilita animações
  await page.addInitScript((mockState) => {
    (window as any).__E2E_MOCK_STATE__ = mockState;
    
    // Matar animações e transições para estabilidade total
    const style = document.createElement('style');
    style.innerHTML = `
      *, *::before, *::after {
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }, state);

  // Helpers
  const upsertItem = (collection: any[], payload: any) => {
    const id = payload.id || `mock-${Date.now()}`;
    const index = collection.findIndex((item: any) => item.id === id);
    const newItem = { ...payload, id };
    if (index !== -1) {
      collection[index] = { ...collection[index], ...newItem };
    } else {
      collection.push(newItem);
    }
    return newItem;
  };

  const deleteItem = (collection: any[], id: string) => {
    const cleanId = id.startsWith('eq.') ? id.substring(3) : id;
    const index = collection.findIndex((item: any) => item.id === cleanId);
    if (index !== -1) {
      collection.splice(index, 1);
    }
  };

  const matches = (url: string, resource: string) => {
    return url.includes(`/api/${resource}`) || url.includes(`/rest/v1/${resource}`);
  };

  // 1. Mock de Estado Financeiro (O "Cérebro" do Frontend)
  await page.route(url => url.toString().includes('financial-state'), async (route) => {
    const recurringIncome = state.recurring_transactions
      ?.filter((rt: any) => rt.transaction_type === 'INCOME' && rt.status === 'active')
      .reduce((sum: number, rt: any) => sum + rt.amount_cents, 0) || 0;
    const recurringExpenses = state.recurring_transactions
      ?.filter((rt: any) => rt.transaction_type === 'EXPENSE' && rt.status === 'active')
      .reduce((sum: number, rt: any) => sum + rt.amount_cents, 0) || 0;

    const response = {
      ...state,
      accounts: [...(state.accounts || [])],
      goals: [...(state.goals || [])],
      transactions: [...(state.transactions || [])],
      recurring_transactions: [...(state.recurring_transactions || [])],
      categories: [...(state.categories || [])],
      budgets: [...(state.budgets || [])],
      scheduledIncomeCents: recurringIncome,
      scheduledExpensesCents: recurringExpenses,
      recurringIncomeCents: recurringIncome,
      recurringExpensesCents: recurringExpenses
    };

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });

  // 2. Mock de Contas (Accounts)
  await page.route(url => matches(url.toString(), 'accounts'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const newItem = upsertItem(state.accounts, route.request().postDataJSON());
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id) deleteItem(state.accounts, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.accounts) });
    }
  });

  // 2.5 Mock de Pagamento de Fatura (Inteligência Específica)
  await page.route(url => url.toString().includes('/api/accounts/pay-invoice'), async (route) => {
    if (route.request().method() === 'POST') {
      const params = route.request().postDataJSON();
      const { creditCardAccountId, paymentAccountId, amountCents } = params;

      // 1. Reduzir saldo da conta de pagamento
      const paymentAcc = state.accounts.find((a: any) => a.id === paymentAccountId);
      if (paymentAcc) {
        paymentAcc.balance_cents = (paymentAcc.balance_cents || 0) - amountCents;
      }

      // 2. Atualizar conta do cartão (reduzir fatura fechada)
      const creditAcc = state.accounts.find((a: any) => a.id === creditCardAccountId);
      if (creditAcc) {
        creditAcc.closed_invoice_cents = Math.max(0, (creditAcc.closed_invoice_cents || 0) - amountCents);
        // Também atualizar o saldo total da conta (que é negativo para cartões)
        creditAcc.balance_cents = (creditAcc.balance_cents || 0) + amountCents;
      }

      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // 3. Mock de Metas (Goals)
  await page.route(url => matches(url.toString(), 'goals'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const newItem = upsertItem(state.goals, route.request().postDataJSON());
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id) deleteItem(state.goals, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.goals) });
    }
  });

  // 4. Mock de Transações
  await page.route(url => matches(url.toString(), 'transactions'), async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, body: JSON.stringify(state.transactions || []) });
    } else if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      if (method === 'POST') {
        const acc = state.accounts.find((a: any) => a.id === payload.account_id);
        if (acc) {
          // Se for TRANSFER, ignoramos pois o serviço de transferência já atualiza os saldos via /api/accounts
          if (payload.transaction_type === 'INCOME') {
            acc.balance_cents = (acc.balance_cents || 0) + payload.amount_cents;
          } else if (payload.transaction_type !== 'TRANSFER') {
            acc.balance_cents = (acc.balance_cents || 0) - payload.amount_cents;
          }
        }
      }
      const newItem = upsertItem(state.transactions, payload);
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id) deleteItem(state.transactions, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // 5. Mock de Assinaturas (Recurring Transactions)
  await page.route(url => matches(url.toString(), 'recurring-transactions'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const newItem = upsertItem(state.recurring_transactions, route.request().postDataJSON());
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id) deleteItem(state.recurring_transactions, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.recurring_transactions) });
    }
  });

  // 6. Mock de Perfil
  await page.route(url => matches(url.toString(), 'user-profile'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      state.user_profile = { ...state.user_profile, ...route.request().postDataJSON() };
      await route.fulfill({ status: 200, body: JSON.stringify(state.user_profile) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.user_profile) });
    }
  });

  // 7. Mock de Profiles (Supabase REST)
  await page.route(url => matches(url.toString(), 'profiles'), async (route) => {
    await route.fulfill({ 
      status: 200, 
      body: JSON.stringify([{ full_name: 'Test User', id: 'e2e-user' }]) 
    });
  });
}
