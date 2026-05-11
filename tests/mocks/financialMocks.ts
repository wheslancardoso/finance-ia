import { Page } from '@playwright/test';

export async function setupFinancialMocks(page: Page, state: any) {
  // Mock GET /api/financial-state
  await page.route('**/api/financial-state*', async (route) => {
    // Serializamos o objeto state no momento da requisição para refletir mutações
    const body = JSON.stringify(state);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });

  // Mock POST /api/transactions (Upsert)
  await page.route('**/api/transactions', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      // Simular retorno de sucesso com o dado enviado + um ID se não houver
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...payload, id: payload.id || `mock-tx-${Date.now()}` }),
      });
    } else if (route.request().method() === 'DELETE') {
       await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // Mock POST /api/goals (Upsert)
  await page.route('**/api/goals', async (route) => {
    const payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...payload, id: payload.id || `mock-goal-${Date.now()}` }),
    });
  });

  // Mock POST /api/recurring-transactions (Upsert)
  await page.route('**/api/recurring-transactions*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      console.log(`[MOCK] POST recurring-transaction: ${payload.description} | Amount: ${payload.amount_cents} | ID: ${payload.id}`);
      
      // Atualizar o estado local do mock para que o próximo refreshData veja a mudança
      if (state.recurring_transactions) {
        const idx = state.recurring_transactions.findIndex((r: any) => r.id === payload.id);
        if (idx >= 0) {
          state.recurring_transactions[idx] = { ...state.recurring_transactions[idx], ...payload };
        } else {
          state.recurring_transactions.push({ ...payload, id: payload.id || `mock-rec-${Date.now()}` });
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...payload, id: payload.id || `mock-rec-${Date.now()}` }),
      });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id && state.recurring_transactions) {
        state.recurring_transactions = state.recurring_transactions.filter((r: any) => r.id !== id);
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.continue();
    }
  });

  // Mock POST /api/accounts (Upsert)
  await page.route('**/api/accounts', async (route) => {
    const payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...payload, id: payload.id || `mock-acc-${Date.now()}` }),
    });
  });

  // Mock Supabase calls (Postgrest) - specifically for the direct calls in PayInvoiceModal
  await page.route('**/rest/v1/transactions*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'UPDATE') {
      await route.fulfill({ status: 200, body: JSON.stringify([{ success: true }]) });
    } else if (method === 'GET') {
      // Simular retorno de transações do cartão para o markInvoiceAsPaid
      // O filtro do cartão é feito via query params, mas aqui vamos simplificar ou retornar vazio se não soubermos
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    } else {
      await route.continue();
    }
  });

  await page.route('**/rest/v1/credit_card_invoices*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify([{ success: true }]) });
  });

  // Mock for goals (Supabase REST + Internal API)
  await page.route(url => url.pathname.includes('/goals'), async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'UPDATE' || method === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({ id: 'mock-goal-id', success: true }) });
    } else {
      await route.continue();
    }
  });

  // Mock for transactions (Supabase REST + Internal API)
  await page.route(url => url.pathname.includes('/transactions'), async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'UPDATE' || method === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({ id: 'mock-tx-id', success: true }) });
    } else {
      await route.continue();
    }
  });

  // Mock for recurring_transactions (Supabase REST + Internal API)
  await page.route(url => url.pathname.includes('/recurring_transactions'), async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'UPDATE' || method === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({ id: 'mock-rec-id', success: true }) });
    } else {
      await route.continue();
    }
  });

  // Mock Supabase Auth
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: '2a8d83e2-17b5-434d-91d9-2a963bc841da', email: 'test@example.com' }),
    });
  });

}
