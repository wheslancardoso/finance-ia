import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  get sidebarLogoutButton() {
    return this.page.getByTestId('sidebar-logout-button');
  }

  get settingsLogoutButton() {
    return this.page.getByTestId('settings-logout-button');
  }

  get profileButton() {
    return this.page.getByTestId('mobile-profile-button');
  }

  get userEmail() {
    return this.page.getByText(/@/);
  }

  async logout() {
    const isSidebarVisible = await this.sidebarLogoutButton.isVisible();
    
    if (isSidebarVisible) {
      await this.sidebarLogoutButton.click();
    } else {
      // Mobile: Ir para configurações e deslogar
      if (await this.profileButton.isVisible()) {
        await this.profileButton.click();
        await this.page.waitForURL('**/settings');
        await this.settingsLogoutButton.click();
      } else {
        // Fallback
        await this.page.goto('/settings');
        await this.settingsLogoutButton.click();
      }
    }
    
    await this.page.waitForURL('**/login');
  }

  async expectLoggedIn() {
    // Verificar se pelo menos um dos botões de logout ou perfil está visível
    const isSidebarVisible = await this.sidebarLogoutButton.isVisible();
    const isProfileVisible = await this.profileButton.isVisible();
    expect(isSidebarVisible || isProfileVisible).toBeTruthy();
  }

  async expectLoggedOut() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
