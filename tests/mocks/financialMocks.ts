import { Page } from '@playwright/test';
import { isSameMonth } from 'date-fns';

export async function setupFinancialMocks(page: Page, state: any) {
  // Injeta o estado diretamente no window e desabilita animações
  await page.addInitScript((mockState) => {
    (window as any).__E2E_MOCK_STATE__ = mockState;
    
    // Limpar chaves locais para evitar vazamento de estado financeiro entre os testes
    try {
      window.localStorage.removeItem("vesper_monthly_income");
      window.localStorage.removeItem("vesper_fixed_expenses");
      window.localStorage.removeItem("vesper_accumulated_balance");
      window.localStorage.removeItem("vesper_health_score");
      window.localStorage.removeItem("vesper_survival_reserve");
    } catch (e) {}
    
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

  // 1. Mock de Estado Financeiro
  await page.route(url => url.toString().includes('financial-state'), async (route) => {
    const recurringIncome = (state.recurring_transactions || [])
      .filter((rt: any) => rt.transaction_type === 'INCOME' && rt.status === 'active')
      .reduce((sum: number, rt: any) => sum + rt.amount_cents, 0) || 0;
    const recurringExpenses = (state.recurring_transactions || [])
      .filter((rt: any) => rt.transaction_type === 'EXPENSE' && rt.status === 'active')
      .reduce((sum: number, rt: any) => sum + rt.amount_cents, 0) || 0;

    const response = {
      ...state,
      accounts: state.accounts || [],
      goals: state.goals || [],
      transactions: state.transactions || [],
      recent_transactions: (state.transactions || []).slice(0, 50),
      month_transactions: state.transactions || [],
      future_transactions: [],
      invoices: state.invoices || [],
      recurringIncomeCents: recurringIncome,
      recurringExpensesCents: recurringExpenses
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });

  // 2. Mock de Contas
  await page.route(url => matches(url.toString(), 'accounts'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      const newItem = upsertItem(state.accounts, payload);
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.accounts, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.accounts || []) });
    }
  });

  // 3. Mock de Pagamento de Fatura
  await page.route('**/api/accounts/pay-invoice', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      console.log('💳 [MOCK] Pay Invoice:', payload);
      const { creditCardAccountId, paymentAccountId, amountCents } = payload;
      
      if (paymentAccountId) {
        const paymentAcc = state.accounts.find((a: any) => a.id === paymentAccountId);
        if (paymentAcc) paymentAcc.balance_cents = (paymentAcc.balance_cents || 0) - amountCents;
      }

      const creditAcc = state.accounts.find((a: any) => a.id === creditCardAccountId);
      if (creditAcc) {
        creditAcc.closed_invoice_cents = Math.max(0, (creditAcc.closed_invoice_cents || 0) - amountCents);
        creditAcc.balance_cents = (creditAcc.balance_cents || 0) + amountCents;
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  // 4. Mock de Transações
  await page.route(url => matches(url.toString(), 'transactions'), async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, body: JSON.stringify(state.transactions || []) });
    } else if (['POST', 'PUT'].includes(method)) {
      const payload = route.request().postDataJSON();
      console.log(`💸 [MOCK] Transaction ${method}:`, payload.description);
      const amount = Number(payload.amount_cents || 0);
      
      if (method === 'POST') {
        if (payload.transaction_type === 'TRANSFER') {
          // O balance já foi atualizado pelo serviço chamando /api/accounts
          // Não subtrair/somar de novo aqui para evitar double counting no mock
        } else {
          const acc = state.accounts.find((a: any) => a.id === payload.account_id);
          if (acc) {
            if (acc.type === 'CREDIT_CARD') {
              if (payload.transaction_type === 'INCOME') {
                acc.balance_cents = (acc.balance_cents || 0) + amount;
              } else {
                acc.balance_cents = (acc.balance_cents || 0) - amount;
                if (payload.is_adjustment) acc.closed_invoice_cents = (acc.closed_invoice_cents || 0) + amount;
                else acc.open_invoice_cents = (acc.open_invoice_cents || 0) + amount;
              }
            } else {
              // Contas normais (CHECKING, SAVINGS, etc.) têm o saldo atualizado de forma reativa pelo 
              // frontend chamando /api/accounts. Para evitar double-counting, não alteramos aqui.
            }
          }
        }
      }
      
      const newItem = upsertItem(state.transactions, payload);
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      console.log(`💸 [MOCK] DELETE Transactions called with ID: ${id}`);
      if (id) {
        const cleanId = id.startsWith('eq.') ? id.substring(3) : id;
        console.log(`cleanId: ${cleanId}`);
        const tx = state.transactions.find((t: any) => t.id === cleanId);
        if (tx && tx.account_id) {
          const acc = state.accounts.find((a: any) => a.id === tx.account_id);
          if (acc && acc.type === 'CREDIT_CARD') {
            const amount = Number(tx.amount_cents || 0);
            if (tx.is_adjustment) {
              acc.closed_invoice_cents = Math.max(0, (acc.closed_invoice_cents || 0) - amount);
            } else {
              acc.open_invoice_cents = Math.max(0, (acc.open_invoice_cents || 0) - amount);
            }
          }
        }
        deleteItem(state.transactions, cleanId);
        console.log(`💸 [MOCK] Transaction deleted. Remaining:`, state.transactions.map((t: any) => t.id));
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  // 5. Mock de Metas
  await page.route(url => matches(url.toString(), 'goals'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const newItem = upsertItem(state.goals, route.request().postDataJSON());
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.goals, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.goals || []) });
    }
  });

  // 6. Mock de Assinaturas (Recurring Transactions)
  await page.route(url => matches(url.toString(), 'recurring-transactions'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      const newItem = upsertItem(state.recurring_transactions, route.request().postDataJSON());
      await route.fulfill({ status: 200, body: JSON.stringify(newItem) });
    } else if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      if (id) deleteItem(state.recurring_transactions, id);
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.recurring_transactions || []) });
    }
  });

  // 7. Mock de Perfil
  await page.route(url => matches(url.toString(), 'user-profile'), async (route) => {
    const method = route.request().method();
    if (['POST', 'PUT'].includes(method)) {
      state.user_profile = { ...state.user_profile, ...route.request().postDataJSON() };
      await route.fulfill({ status: 200, body: JSON.stringify(state.user_profile) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify(state.user_profile) });
    }
  });

  // 8. Mock de Profiles (Supabase REST)
  await page.route(url => matches(url.toString(), 'profiles'), async (route) => {
    const urlObj = new URL(route.request().url());
    const idParam = urlObj.searchParams.get('id');
    const userId = idParam?.replace('eq.', '') || 'e2e-user';
    console.log(`👤 [MOCK] Profiles Requested for ${userId}`);
    await route.fulfill({ 
      status: 200, 
      body: JSON.stringify([{ full_name: 'Test User', id: userId }]) 
    });
  });
}
