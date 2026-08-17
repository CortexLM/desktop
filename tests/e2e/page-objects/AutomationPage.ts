import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Automation Page Object - Handles automation management
 */
export class AutomationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    automationPanel: '[data-testid="automation-panel"]',
    automationList: '[data-testid="automation-list"]',
    automationItem: '[data-testid="automation-item"]',
    newAutomationButton: '[data-testid="new-automation"]',
    automationEditor: '[data-testid="automation-editor"]',
    nameInput: '[data-testid="automation-name"]',
    triggerSelect: '[data-testid="trigger-type"]',
    actionSelect: '[data-testid="action-type"]',
    addActionButton: '[data-testid="add-action"]',
    saveButton: '[data-testid="save-automation"]',
    runButton: '[data-testid="run-automation"]',
    deleteButton: '[data-testid="delete-automation"]',
    logsViewer: '[data-testid="logs-viewer"]',
    enableToggle: '[data-testid="enable-automation"]',
    configPanel: '[data-testid="config-panel"]'
  };

  /**
   * Open automation panel
   */
  async openAutomationPanel(): Promise<void> {
    await this.page.click('[data-testid="sidebar-automations"]');
    await this.waitForElement(this.selectors.automationPanel);
  }

  /**
   * Create new automation
   */
  async createAutomation(name: string): Promise<void> {
    await this.page.click(this.selectors.newAutomationButton);
    await this.waitForElement(this.selectors.automationEditor);
    await this.page.fill(this.selectors.nameInput, name);
  }

  /**
   * Configure trigger
   *
   * `triggerType` must be one of the app's real trigger values:
   * manual | file_watch | git_hook | schedule.
   */
  async configureTrigger(triggerType: string, config: Record<string, any>): Promise<void> {
    await this.page.selectOption(this.selectors.triggerSelect, triggerType);

    // Fill trigger configuration. Only fields the selected trigger renders
    // exist, so skip anything absent rather than timing out on it.
    for (const [key, value] of Object.entries(config)) {
      const field = this.page.locator(`[data-testid="trigger-${key}"]`);
      if ((await field.count()) > 0) {
        await field.fill(String(value));
      }
    }
  }

  /**
   * Configure the automation's first action
   *
   * An action has to be added before its config form exists. `actionType` must
   * be one of: run_script | ai_task | git_operation | notification.
   */
  async configureAction(actionType: string, config: Record<string, any>): Promise<void> {
    if ((await this.page.locator(this.selectors.actionSelect).count()) === 0) {
      await this.page.click(this.selectors.addActionButton);
      await this.waitForElement(this.selectors.actionSelect);
    }

    await this.page.selectOption(this.selectors.actionSelect, actionType);

    for (const [key, value] of Object.entries(config)) {
      const field = this.page.locator(`[data-testid="action-${key}"]`);
      if ((await field.count()) > 0) {
        await field.fill(String(value));
      }
    }
  }

  /**
   * Save automation
   */
  async saveAutomation(): Promise<void> {
    await this.page.click(this.selectors.saveButton);
    await this.page.waitForTimeout(500);
  }

  /**
   * Run automation manually
   */
  async runAutomation(name: string): Promise<void> {
    const automation = this.page.locator(`${this.selectors.automationItem}[data-name="${name}"]`);
    await automation.hover();
    await automation.locator(this.selectors.runButton).click();
  }

  /**
   * Get automation list
   */
  async getAutomationList(): Promise<string[]> {
    const items = this.page.locator(this.selectors.automationItem);
    return items.allTextContents();
  }

  /**
   * Enable/disable automation
   */
  async toggleAutomation(name: string): Promise<void> {
    const automation = this.page.locator(`${this.selectors.automationItem}[data-name="${name}"]`);
    await automation.locator(this.selectors.enableToggle).click();
  }

  /**
   * Delete automation
   *
   * Deletion is gated by a native `confirm()`, which Playwright auto-dismisses
   * (i.e. answers "cancel") unless a dialog handler accepts it. There is no
   * in-app `confirm-delete` element to click.
   */
  async deleteAutomation(name: string): Promise<void> {
    this.page.once('dialog', (dialog) => {
      void dialog.accept();
    });

    const automation = this.page.locator(`${this.selectors.automationItem}[data-name="${name}"]`);
    await automation.hover();
    await automation.locator(this.selectors.deleteButton).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * View automation logs
   */
  async viewLogs(name: string): Promise<void> {
    const automation = this.page.locator(`${this.selectors.automationItem}[data-name="${name}"]`);
    await automation.click();
    await this.waitForElement(this.selectors.logsViewer);
  }

  /**
   * Get logs content
   */
  async getLogsContent(): Promise<string> {
    return this.page.locator(this.selectors.logsViewer).textContent() || '';
  }
}
