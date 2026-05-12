import { test, expect } from '@playwright/test';
import { setupFinancialMocks } from '../../mocks/financialMocks';
import { setupAuthMock } from '../../mocks/authMocks';
import { AccountsPage } from '../pages/AccountsPage';
import { createInitialState } from '../fixtures/financialState';

test.describe('Gestão de Contas (Refatorado)', () => {
  const USER_ID = 'accounts-user';
  let mockState: any;

  test.beforeEach(async ({ page, context }) => {
    mockState = createInitialState();
    await setupFinancialMocks(page, mockState);
    await setupAuthMock(page, { id: USER_ID });
    
    // Fixar identidade para evitar jitter
    await context.addCookies([{
      name: 'sb-mock-user-id',
      value: USER_ID,
      domain: 'localhost',
      path: '/'
    }]);
  });

  test('deve criar uma nova conta com sucesso', async ({ page }) => {
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    
    await accountsPage.addAccount('Nubank', '1.500,00');
    await accountsPage.expectAccountVisible('Nubank');
  });

  test('deve editar uma conta existente', async ({ page }) => {
    mockState.accounts = [
      { id: 'acc-existing', name: 'Original', type: 'CHECKING', balance_cents: 100000, color_hex: '#ffffff' }
    ];
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.goto();
    
    // O menu de ação exige dois cliques: abrir o menu e depois clicar em editar
    const card = page.getByTestId('account-card-acc-existing');
    await card.getByTestId('action-menu-button').click();
    await page.getByTestId('action-edit-button').click();
    
    await accountsPage.accountNameInput.fill('Editada');
    await accountsPage.submitButton.click();
    
    await accountsPage.expectAccountVisible('Editada');
  });
});
