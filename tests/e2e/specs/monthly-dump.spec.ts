import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { DashboardPage } from '../pages/DashboardPage';
import { createDashboardState } from '../fixtures/financialState';

test.describe('Monthly CSV Dump (Fechamento Mensal)', () => {
  const USER_ID = 'csv-user';

  test.beforeEach(async ({ page }) => {
    await setupAuthMock(page, { id: USER_ID });
    
    // Fixar o relógio para garantir o reference_month correto no teste
    if (page.clock) {
      await page.clock.setFixedTime(new Date('2026-06-23T12:00:00Z'));
    }
  });

  test('deve permitir exportar o mês atual para CSV', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    
    const state = createDashboardState({
      accounts: [{ id: 'acc-1', name: 'Conta Principal', type: 'CHECKING', balance_cents: 150000, user_id: USER_ID }]
    });

    await setupFinancialMocks(page, state);

    // Interceptar a chamada de geração de snapshot
    await page.route('/api/snapshots/generate', async route => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      
      const body = JSON.parse(request.postData() || '{}');
      expect(body.reference_month).toBe('2026-06');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          url: 'https://fake-supabase.com/storage/v1/object/public/monthly_dumps/csv-user/2026-06_snapshot.csv'
        })
      });
    });

    await dashboard.goto();

    // Clicar no botão Lacrar Mês
    await dashboard.exportCsvButton.click();

    // Aguardar o botão de download aparecer e ter a URL correta
    await expect(dashboard.downloadCsvLink).toBeVisible({ timeout: 10000 });
    await expect(dashboard.downloadCsvLink).toHaveAttribute('href', /fake-supabase\.com/);
  });
});
