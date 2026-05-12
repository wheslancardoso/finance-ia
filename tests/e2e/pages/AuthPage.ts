import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  get logoutButton() {
    return this.page.getByRole('button', { name: /Sair da Conta/i });
  }

  get userEmail() {
    return this.page.getByText(/@/);
  }

  async logout() {
    // Limpar cookie de mock explicitamente antes do logout
    await this.page.context().clearCookies({ name: 'sb-mock-user-id' });
    await this.logoutButton.click();
  }

  async expectLoggedIn() {
    await expect(this.logoutButton).toBeVisible({ timeout: 15000 });
  }

  async expectLoggedOut() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
