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
}
