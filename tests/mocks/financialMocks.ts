import { Page } from '@playwright/test';

export async function setupFinancialMocks(page: Page, state: any) {
  // 1. Mock de Estado Global (Sempre dinâmico)
  await page.route('**/api/financial-state*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state),
    });
  });

  // 2. Mock de Contas (Accounts)
  await page.route('**/api/accounts*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const id = payload.id || `acc-${Date.now()}`;
      
      if (state.accounts) {
        const idx = state.accounts.findIndex((a: any) => a.id === id);
        if (idx !== -1) state.accounts[idx] = { ...state.accounts[idx], ...payload };
        else state.accounts.push({ ...payload, id });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...payload, id, success: true }) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id && state.accounts) state.accounts = state.accounts.filter((a: any) => a.id !== id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // 3. Mock de Metas (Goals)
  await page.route('**/api/goals*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const id = payload.id || `goal-${Date.now()}`;
      
      if (state.goals) {
        const idx = state.goals.findIndex((g: any) => g.id === id);
        if (idx !== -1) state.goals[idx] = { ...state.goals[idx], ...payload };
        else state.goals.push({ ...payload, id });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...payload, id, success: true }) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id && state.goals) state.goals = state.goals.filter((g: any) => g.id !== id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // 4. Mock de Transações (Transactions)
  await page.route('**/api/transactions*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const id = payload.id || `tx-${Date.now()}`;
      
      // Para transações, normalmente não atualizamos o estado global automaticamente nos mocks 
      // a menos que o teste exija, mas vamos simular o sucesso.
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...payload, id, success: true }) });
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // 5. Mock de Assinaturas (Recurring Transactions)
  await page.route('**/api/recurring-transactions*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const id = payload.id || `rec-${Date.now()}`;
      
      if (state.recurring_transactions) {
        const idx = state.recurring_transactions.findIndex((r: any) => r.id === id);
        if (idx !== -1) state.recurring_transactions[idx] = { ...state.recurring_transactions[idx], ...payload };
        else state.recurring_transactions.push({ ...payload, id });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...payload, id, success: true }) });
    } else if (method === 'DELETE') {
      const id = new URL(route.request().url()).searchParams.get('id');
      if (id && state.recurring_transactions) state.recurring_transactions = state.recurring_transactions.filter((r: any) => r.id !== id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // 6. Mock Supabase Auth
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '2a8d83e2-17b5-434d-91d9-2a963bc841da', email: 'test@example.com' }),
    });
  });

  // 7. Mock Supabase REST (Fallback para segurança)
  await page.route('**/rest/v1/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });
}
