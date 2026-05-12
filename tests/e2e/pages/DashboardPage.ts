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

  async expectLiquidity(value: string | RegExp) {
    await expect(this.netLiquidity).toContainText(value, { timeout: 15000 });
  }

  get simulatorAmountInput() {
    return this.page.getByTestId('simulator-amount-input');
  }

  get simulatorInstallmentsSelect() {
    return this.page.getByTestId('simulator-installments-select');
  }

  get simulatorStatusIndicator() {
    return this.page.getByTestId('simulator-status-indicator');
  }

  get simulatorSaveButton() {
    return this.page.getByTestId('simulator-save-button');
  }

  async simulateSpend(amount: string, installments: string = '1') {
    await this.simulatorAmountInput.fill(amount);
    await this.simulatorInstallmentsSelect.selectOption(installments);
  }
}
