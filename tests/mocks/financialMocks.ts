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
      if (!state.accounts.find((a: any) => a.id === id)) {
        state.accounts.push({ ...payload, id });
      }
      await route.fulfill({ status: 201, body: JSON.stringify({ ...payload, id }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  // 3. Mock de Metas (Goals)
  await page.route('**/api/goals*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const id = payload.id || `goal-${Date.now()}`;
      const newGoal = { ...payload, id };
      state.goals.push(newGoal);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newGoal),
      });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  // 4. Mock de Assinaturas (Recurring Transactions)
  await page.route('**/api/recurring-transactions*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const id = payload.id || `sub-${Date.now()}`;
      state.recurring_transactions.push({ ...payload, id });
      await route.fulfill({ status: 201, body: JSON.stringify({ ...payload, id }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  // 5. Mock de Transações
  await page.route('**/api/transactions*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  });
}
