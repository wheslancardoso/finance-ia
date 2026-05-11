import { Page } from '@playwright/test';

export async function setupFinancialMocks(page: Page, state: any) {
  // Mock GET /api/financial-state
  await page.route('**/api/financial-state*', async (route) => {
    // Serializamos o objeto state no momento da requisição para refletir mutações
    const body = JSON.stringify(state);
    console.log(`[MOCK] Providing state. Balance: ${state.user_profile?.accumulated_balance_cents}`);
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

  // Mock para o localStorage (User ID)
  await page.addInitScript((userId: string) => {
    window.localStorage.setItem('vesper_user_id', userId);
  }, '2a8d83e2-17b5-434d-91d9-2a963bc841da');
}
