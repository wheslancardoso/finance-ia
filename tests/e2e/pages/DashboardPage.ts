import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  get netLiquidity() {
    return this.page.getByTestId('net-liquidity-value');
  }

  get projectedBalance() {
    return this.page.getByTestId('projected-balance-value');
  }

  async expectLiquidity(value: string) {
    await expect(this.netLiquidity).toContainText(value, { timeout: 15000 });
  }
}
