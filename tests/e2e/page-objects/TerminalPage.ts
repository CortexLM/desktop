import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Terminal Page Object - Handles terminal operations
 */
export class TerminalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    terminalPanel: '[data-testid="terminal-panel"]',
    newTerminalButton: '[data-testid="new-terminal"]',
    // One tab-bar button per terminal; the rendered terminal surface itself is
    // `terminal-instance` (the `single` layout only mounts the active one).
    terminalTab: '[data-testid="terminal-tab"]',
    terminalInstance: '[data-testid="terminal-instance"]',
    terminalScreen: '.xterm-screen',
    terminalOutput: '.xterm-screen',
    closeTerminalButton: '[data-testid="close-terminal"]',
    splitTerminalButton: '[data-testid="split-terminal"]',
    terminalGrid: '[data-testid="terminal-grid"]'
  };

  /**
   * Open terminal panel
   */
  async openTerminalPanel(): Promise<void> {
    await this.page.click('[data-testid="sidebar-terminal"]');
    await this.waitForElement(this.selectors.terminalPanel);
  }

  /**
   * Create a new terminal
   */
  async createNewTerminal(): Promise<void> {
    await this.page.click(this.selectors.newTerminalButton);
    await this.page.waitForTimeout(500); // Wait for terminal to initialize
  }

  /**
   * Type command in terminal
   *
   * xterm.js has no fillable input: it renders to a canvas and reads keystrokes
   * from a hidden helper textarea. So focus the terminal surface and type,
   * rather than trying to `fill()` an input that does not exist.
   */
  async typeCommand(command: string, pressEnter = true): Promise<void> {
    await this.page.locator(this.selectors.terminalScreen).first().click();
    await this.page.keyboard.type(command);
    if (pressEnter) {
      await this.page.keyboard.press('Enter');
    }
  }

  /**
   * Get terminal output
   */
  async getTerminalOutput(): Promise<string> {
    return this.page.locator(this.selectors.terminalOutput).textContent() || '';
  }

  /**
   * Get number of open terminals
   */
  async getTerminalCount(): Promise<number> {
    return this.page.locator(this.selectors.terminalTab).count();
  }

  /**
   * Switch to terminal by index
   */
  async switchToTerminal(index: number): Promise<void> {
    const tabs = this.page.locator(this.selectors.terminalTab);
    await tabs.nth(index).click();
  }

  /**
   * Close terminal by index
   *
   * Select the terminal via its tab first: the close button lives in the
   * terminal's own toolbar, and only the active terminal is mounted in the
   * default `single` layout.
   */
  async closeTerminal(index: number): Promise<void> {
    await this.switchToTerminal(index);
    await this.page
      .locator(this.selectors.terminalInstance)
      .first()
      .locator(this.selectors.closeTerminalButton)
      .click();
  }

  /**
   * Split terminal view
   */
  async splitTerminal(): Promise<void> {
    await this.page.click(this.selectors.splitTerminalButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear terminal
   */
  async clearTerminal(): Promise<void> {
    await this.page.keyboard.press('Control+L');
    await this.page.waitForTimeout(200);
  }

  /**
   * Wait for command to complete (wait for prompt to appear)
   */
  async waitForCommandComplete(timeout = 5000): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }
}
