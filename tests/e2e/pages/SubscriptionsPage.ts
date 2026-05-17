import { Page, expect } from '@playwright/test';

export class SubscriptionsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/subscriptions');
  }

  get addButton() {
    return this.page.getByTestId('add-subscription-button');
  }

  get descriptionInput() {
    return this.page.getByTestId('subscription-description-input');
  }

  get amountInput() {
    return this.page.getByTestId('subscription-amount-input');
  }

  get dayInput() {
    return this.page.getByTestId('subscription-day-input');
  }

  get submitButton() {
    return this.page.getByTestId('subscription-submit-button');
  }

  get successOkButton() {
    return this.page.getByTestId('status-modal-close');
  }

  async addSubscription(description: string, amount: string, day: string = '28') {
    await this.addButton.click();
    
    // Esperar modal abrir e contas carregarem
    await expect(this.descriptionInput.last()).toBeVisible({ timeout: 10000 });
    
    const descCount = await this.descriptionInput.count();
    const amountCount = await this.amountInput.count();
    console.log(`🧪 [E2E Debug] descriptionInput count: ${descCount}, amountInput count: ${amountCount}`);

    await expect(this.page.getByTestId('subscription-account-select').last()).toContainText(/Conta Principal/i, { timeout: 10000 });
    
    // Usar o último (assumindo que é o modal ativo no portal)
    await this.descriptionInput.last().fill(description);
    await this.amountInput.last().fill(amount);
    
    // Definir o dia de forma determinística
    await this.dayInput.last().fill(day);
    
    // Pequena espera para o estado estabilizar e verificações de depuração
    await this.page.waitForTimeout(1000);
    
    await expect(this.submitButton.last()).toBeEnabled({ timeout: 15000 });
    await this.submitButton.last().click();
    
    await expect(this.successOkButton).toBeVisible({ timeout: 15000 });
    await this.successOkButton.click();
  }
}
