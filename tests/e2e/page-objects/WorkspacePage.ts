import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Workspace Page Object - Handles workspace navigation and views
 */
export class WorkspacePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    sidebar: '[data-testid="sidebar"]',
    fileExplorerButton: '[data-testid="sidebar-explorer"]',
    gitButton: '[data-testid="sidebar-git"]',
    terminalButton: '[data-testid="sidebar-terminal"]',
    aiChatButton: '[data-testid="sidebar-ai-chat"]',
    extensionsButton: '[data-testid="sidebar-extensions"]',
    notesButton: '[data-testid="sidebar-notes"]',
    plansButton: '[data-testid="sidebar-plans"]',
    browserButton: '[data-testid="sidebar-browser"]',
    accountButton: '[data-testid="sidebar-account"]',
    automationsButton: '[data-testid="sidebar-automations"]',
    contentArea: '[data-testid="content-area"]',
    themeSwitcher: '[data-testid="theme-switcher"]'
  };

  /**
   * Navigate to File Explorer
   */
  async openFileExplorer(): Promise<void> {
    await this.page.click(this.selectors.fileExplorerButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Git view
   */
  async openGit(): Promise<void> {
    await this.page.click(this.selectors.gitButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Terminal
   */
  async openTerminal(): Promise<void> {
    await this.page.click(this.selectors.terminalButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to AI Chat
   */
  async openAIChat(): Promise<void> {
    await this.page.click(this.selectors.aiChatButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Extensions
   */
  async openExtensions(): Promise<void> {
    await this.page.click(this.selectors.extensionsButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Notes
   */
  async openNotes(): Promise<void> {
    await this.page.click(this.selectors.notesButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Plans
   */
  async openPlans(): Promise<void> {
    await this.page.click(this.selectors.plansButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Browser
   */
  async openBrowser(): Promise<void> {
    await this.page.click(this.selectors.browserButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Account
   */
  async openAccount(): Promise<void> {
    await this.page.click(this.selectors.accountButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to Automations
   */
  async openAutomations(): Promise<void> {
    await this.page.click(this.selectors.automationsButton);
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle theme (light/dark)
   */
  async toggleTheme(): Promise<void> {
    await this.page.click(this.selectors.themeSwitcher);
    await this.page.waitForTimeout(500); // Wait for theme transition
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<'light' | 'dark'> {
    const html = this.page.locator('html');
    const classList = await html.getAttribute('class') || '';
    return classList.includes('dark') ? 'dark' : 'light';
  }

  /**
   * Wait for workspace to be fully loaded
   */
  async waitForWorkspaceReady(): Promise<void> {
    await this.waitForElement(this.selectors.sidebar);
    await this.waitForElement(this.selectors.contentArea);
    await this.page.waitForLoadState('networkidle');
  }
}
