import { Page, expect } from '@playwright/test';

export class GoalsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/goals');
  }

  get addGoalButton() {
    return this.page.getByTestId('add-goal-button');
  }

  get goalNameInput() {
    return this.page.getByTestId('goal-name-input');
  }

  get targetAmountInput() {
    return this.page.getByTestId('goal-target-input');
  }

  get currentAmountInput() {
    return this.page.getByTestId('goal-current-input');
  }

  get submitButton() {
    return this.page.getByTestId('goal-submit-button');
  }

  get contributionAmountInput() {
    return this.page.getByTestId('contribution-amount-input');
  }

  get contributionSubmitButton() {
    return this.page.getByTestId('contribution-submit-button');
  }

  async createGoal(name: string, target: string, current: string) {
    await this.addGoalButton.first().click();
    await this.goalNameInput.fill(name);
    await this.targetAmountInput.fill(target);
    await this.currentAmountInput.fill(current);
    await this.submitButton.click();
  }

  async makeContribution(goalId: string, amount: string) {
    const card = this.page.getByTestId(`goal-card-${goalId}`);
    await card.getByTestId('goal-contribution-button').click();
    await this.contributionAmountInput.fill(amount);
    await this.page.getByTestId('contribution-account-item').first().click();
    await this.contributionSubmitButton.click();
  }

  async deleteGoal(goalId: string) {
    const card = this.page.getByTestId(`goal-card-${goalId}`);
    await card.getByTestId('goal-details-button').click();
    await this.page.getByTestId('delete-goal-button').click();
    await this.page.getByTestId('confirm-button').click();
  }
}
