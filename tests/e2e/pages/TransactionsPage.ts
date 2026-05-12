import { Page, expect } from '@playwright/test';

export class TransactionsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/transactions');
  }

  get searchInput() {
    return this.page.getByTestId('transaction-search-input');
  }

  get transactionList() {
    return this.page.getByTestId('transaction-list');
  }

  async filterByText(text: string) {
    await this.searchInput.fill(text);
    // Aguarda debouncing se houver
    await this.page.waitForTimeout(500);
  }

  async expectTransactionVisible(description: string) {
    await expect(this.page.getByText(description)).toBeVisible();
  }

  async openTransactionDetails(id: string) {
    await this.page.getByTestId(`transaction-item-${id}`).click();
  }
}
