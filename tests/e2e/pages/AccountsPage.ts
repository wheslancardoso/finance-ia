import { Page, expect } from '@playwright/test';

export class AccountsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/accounts');
  }

  get addAccountButton() {
    return this.page.getByTestId('add-account-button');
  }

  get accountNameInput() {
    return this.page.getByTestId('account-name-input');
  }

  get accountBalanceInput() {
    return this.page.getByTestId('account-balance-input');
  }

  get submitButton() {
    return this.page.getByTestId('account-submit-button');
  }

  async addAccount(name: string, balance: string) {
    await this.addAccountButton.click();
    await this.accountNameInput.fill(name);
    await this.accountBalanceInput.fill(balance);
    await this.submitButton.click();
    await expect(this.page.getByTestId('add-account-modal')).not.toBeVisible({ timeout: 10000 });
  }

  async expectAccountVisible(name: string) {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  get openTransferButton() {
    return this.page.getByTestId('open-transfer-button');
  }

  get transferAmountInput() {
    return this.page.getByTestId('transfer-amount-input');
  }

  get transferSubmitButton() {
    return this.page.getByTestId('transfer-submit-button');
  }

  async makeTransfer(fromId: string, toId: string, amount: string) {
    await this.openTransferButton.click();
    await this.transferAmountInput.fill(amount);
    
    await this.page.getByTestId('transfer-from-account-select').click();
    await this.page.getByTestId(`transfer-account-from-${fromId}`).click();
    
    await this.page.getByTestId('transfer-to-account-select').click();
    await this.page.getByTestId(`transfer-account-to-${toId}`).click();
    
    await this.transferSubmitButton.click();
    await expect(this.page.getByTestId('transfer-modal')).not.toBeVisible({ timeout: 10000 });
  }

  get payInvoiceButton() {
    return this.page.getByTestId('pay-invoice-button');
  }

  get confirmPaymentButton() {
    return this.page.getByTestId('confirm-payment-button');
  }

  get payInvoiceAmountInput() {
    return this.page.locator('input[data-testid="pay-invoice-amount-input"]'); // Assuming I added this test-id or using locator
  }

  async payInvoice(amount?: string) {
    await this.payInvoiceButton.click();
    const input = this.page.getByTestId('pay-invoice-amount-input');
    
    if (amount) {
      await input.fill(amount);
    } else {
      // Aguardar o auto-fill do modal antes de prosseguir
      await expect(input).not.toHaveValue('', { timeout: 7000 });
    }

    await this.confirmPaymentButton.click();
    // Validar que o modal foi fechado (indica sucesso no processamento)
    await expect(this.page.getByTestId('pay-invoice-modal')).not.toBeVisible({ timeout: 10000 });
  }
}
