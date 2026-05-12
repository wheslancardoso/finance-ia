import { Page } from '@playwright/test';

export async function setupFinancialMocks(page: Page, state: any) {
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

  // Helper para persistir mudanças no state local do mock
  const upsertItem = (collection: any[], payload: any) => {
    const id = payload.id || `${Date.now()}`;
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
    const index = collection.findIndex((item: any) => item.id === id);
    if (index !== -1) collection.splice(index, 1);
  };

  // 1. Mock de mutações genérico (Lowest priority - registered first)
  await page.route('**/api/**', async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    } else {
      await route.continue();
    }
  });

  // 2. Mock de Estado Financeiro (Higher priority - registered later)
  await page.route('**/api/financial-state*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state),
    });
  });

  // 3. Mock de Contas (Accounts)
  await page.route('**/api/accounts*', async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      const newItem = upsertItem(state.accounts, payload);
      await route.fulfill({ status: method === 'POST' ? 201 : 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.accounts, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.accounts) });
    }
  });

  // 4. Mock de Metas (Goals)
  await page.route('**/api/goals*', async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      const newItem = upsertItem(state.goals, payload);
      await route.fulfill({ status: method === 'POST' ? 201 : 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.goals, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.goals) });
    }
  });

  // 5. Mock de Assinaturas (Recurring Transactions)
  await page.route('**/api/recurring-transactions*', async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      const newItem = upsertItem(state.recurring_transactions, payload);
      await route.fulfill({ status: method === 'POST' ? 201 : 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.recurring_transactions, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.recurring_transactions) });
    }
  });

  // 6. Mock de Transações
  await page.route('**/api/transactions*', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify(state.transactions || []) 
      });
    } else if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      const newItem = upsertItem(state.transactions, payload);
      await route.fulfill({ status: method === 'POST' ? 201 : 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.transactions, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify({ success: true }) 
      });
    }
  });

  // 7. Mock de Perfil de Usuário
  await page.route('**/api/user-profile*', async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      state.user_profile = { ...state.user_profile, ...payload };
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify({ success: true, ...payload }) 
      });
    } else {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify(state.user_profile) 
      });
    }
  });
}
