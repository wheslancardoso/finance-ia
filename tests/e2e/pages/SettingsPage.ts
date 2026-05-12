import { Page, expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings');
  }

  get incomeInput() {
    return this.page.getByTestId('profile-income-input');
  }

  get expensesInput() {
    return this.page.getByTestId('profile-expenses-input');
  }

  get saveButton() {
    return this.page.getByTestId('profile-save-button');
  }

  async fillProfile(income: string, expenses: string) {
    await this.incomeInput.fill(income);
    await this.expensesInput.fill(expenses);
  }

  async saveProfile() {
    const [response] = await Promise.all([
      this.page.waitForResponse('**/api/user-profile'),
      this.saveButton.click()
    ]);
    return response;
  }

  async expectProfileValues(income: string, expenses: string) {
    await expect(this.incomeInput).toHaveValue(income, { timeout: 15000 });
    await expect(this.expensesInput).toHaveValue(expenses, { timeout: 15000 });
  }

  async expectSaveSuccess() {
    await expect(this.saveButton).toContainText('Configurações Salvas', { timeout: 10000 });
  }
}
