import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Extensions Page Object - Handles MCP extensions
 */
export class ExtensionsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    extensionsPanel: '[data-testid="extensions-panel"]',
    marketplace: '[data-testid="mcp-marketplace"]',
    marketplaceTab: '[data-testid="extensions-marketplace-tab"]',
    installedTab: '[data-testid="extensions-installed-tab"]',
    installedExtensions: '[data-testid="installed-extensions"]',
    extensionCard: '[data-testid="extension-card"]',
    installButton: '[data-testid="install-extension"]',
    uninstallButton: '[data-testid="uninstall-extension"]',
    configureButton: '[data-testid="configure-extension"]',
    configDialog: '[data-testid="config-dialog"]',
    toolsList: '[data-testid="tools-list"]',
    toolItem: '[data-testid="tool-item"]',
    invokeToolButton: '[data-testid="invoke-tool"]',
    searchInput: '[data-testid="search-extensions"]',
    filterSelect: '[data-testid="filter-category"]'
  };

  /**
   * Open extensions panel
   */
  async openExtensionsPanel(): Promise<void> {
    await this.page.click('[data-testid="sidebar-extensions"]');
    await this.waitForElement(this.selectors.extensionsPanel);
  }

  /**
   * Switch to the Marketplace tab
   *
   * The panel opens on "Installed", so the marketplace (and its search box and
   * extension cards) has to be selected before it exists in the DOM.
   */
  async openMarketplace(): Promise<void> {
    await this.page.click(this.selectors.marketplaceTab);
    await this.waitForElement(this.selectors.marketplace);
  }

  /**
   * Search for extension
   */
  async searchExtension(query: string): Promise<void> {
    await this.openMarketplace();
    await this.page.fill(this.selectors.searchInput, query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Install extension
   */
  async installExtension(extensionName: string): Promise<void> {
    const card = this.page.locator(`${this.selectors.extensionCard}[data-name="${extensionName}"]`);
    await card.locator(this.selectors.installButton).click();
    await this.page.waitForTimeout(2000); // Wait for installation
  }

  /**
   * Uninstall extension
   */
  async uninstallExtension(extensionName: string): Promise<void> {
    const card = this.page.locator(`${this.selectors.extensionCard}[data-name="${extensionName}"]`);
    await card.locator(this.selectors.uninstallButton).click();
    
    // Confirm uninstallation
    await this.page.click('[data-testid="confirm-uninstall"]');
  }

  /**
   * Configure extension
   */
  async configureExtension(extensionName: string, config: Record<string, any>): Promise<void> {
    const card = this.page.locator(`${this.selectors.extensionCard}[data-name="${extensionName}"]`);
    await card.locator(this.selectors.configureButton).click();
    
    await this.waitForElement(this.selectors.configDialog);
    
    // Fill configuration
    for (const [key, value] of Object.entries(config)) {
      await this.page.fill(`[data-testid="config-${key}"]`, String(value));
    }
    
    await this.page.click('[data-testid="save-config"]');
  }

  /**
   * Get installed extensions
   */
  async getInstalledExtensions(): Promise<string[]> {
    const cards = this.page.locator(this.selectors.extensionCard).filter({ has: this.page.locator('[data-installed="true"]') });
    return cards.allTextContents();
  }

  /**
   * View extension tools
   */
  async viewExtensionTools(extensionName: string): Promise<void> {
    const card = this.page.locator(`${this.selectors.extensionCard}[data-name="${extensionName}"]`);
    await card.click();
    await this.waitForElement(this.selectors.toolsList);
  }

  /**
   * Get available tools
   */
  async getAvailableTools(): Promise<string[]> {
    const tools = this.page.locator(this.selectors.toolItem);
    return tools.allTextContents();
  }

  /**
   * Invoke tool
   */
  async invokeTool(toolName: string, params: Record<string, any>): Promise<void> {
    const tool = this.page.locator(`${this.selectors.toolItem}[data-tool="${toolName}"]`);
    await tool.locator(this.selectors.invokeToolButton).click();
    
    // Fill tool parameters
    for (const [key, value] of Object.entries(params)) {
      await this.page.fill(`[data-testid="param-${key}"]`, String(value));
    }
    
    await this.page.click('[data-testid="execute-tool"]');
  }
}
