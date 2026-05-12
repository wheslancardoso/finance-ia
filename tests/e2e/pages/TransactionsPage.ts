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
    await this.searchInput.clear();
    await this.searchInput.focus();
    await this.searchInput.pressSequentially(text, { delay: 50 });
    // Aguarda processamento do filtro e debouncing
    await this.page.waitForTimeout(1000);
  }

  async expectTransactionVisible(description: string) {
    await expect(this.page.getByText(description)).toBeVisible();
  }

  async openTransactionDetails(id: string) {
    await this.page.getByTestId(`transaction-item-${id}`).click();
  }

  async editTransaction(id: string, newDescription: string) {
    // Abrir menu de ações
    const item = this.page.getByTestId(`transaction-item-${id}`);
    
    // Usar evaluate para clicar direto no DOM se o clique normal falhar ou for interceptado
    const menuBtn = item.getByTestId('action-menu-button');
    await menuBtn.waitFor({ state: 'visible' });
    await menuBtn.evaluate(el => (el as HTMLElement).click());
    
    await expect(this.page.getByTestId('action-edit-button')).toBeVisible({ timeout: 10000 });
    
    await this.page.getByTestId('action-edit-button').click();

    // Preencher novos dados
    const descInput = this.page.getByTestId('transaction-description-input');
    await descInput.clear();
    await descInput.focus();
    await descInput.pressSequentially(newDescription, { delay: 50 });

    // Salvar
    await this.page.getByTestId('transaction-submit-button').click();
    
    // Aguardar modal fechar
    await expect(this.page.getByTestId('transaction-modal')).not.toBeVisible();
  }
}
