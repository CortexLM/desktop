import { Page, Locator } from '@playwright/test';

/**
 * Base Page Object with common functionality
 */
export class BasePage {
  constructor(protected page: Page) {}

  async waitForElement(selector: string, timeout = 5000): Promise<Locator> {
    return this.page.waitForSelector(selector, { timeout }).then(() => this.page.locator(selector));
  }

  async clickElement(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  async typeText(selector: string, text: string): Promise<void> {
    await this.page.fill(selector, text);
  }

  async getText(selector: string): Promise<string> {
    return this.page.textContent(selector) || '';
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.page.isVisible(selector);
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }
}
