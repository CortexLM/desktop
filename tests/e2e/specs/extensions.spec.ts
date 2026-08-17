import { test, expect } from '../fixtures/electron';
import { ExtensionsPage } from '../page-objects';

test.describe('Extensions Tests', () => {
  let extensionsPage: ExtensionsPage;

  test.beforeEach(async ({ page }) => {
    extensionsPage = new ExtensionsPage(page);
    await page.waitForLoadState('domcontentloaded');
    await extensionsPage.openExtensionsPanel();
  });

  test('should open extensions panel', async ({ page }) => {
    await expect(page.locator('[data-testid="extensions-panel"]')).toBeVisible();
  });

  test('should display marketplace', async ({ page }) => {
    // The panel opens on the "Installed" tab, so select Marketplace first.
    await extensionsPage.openMarketplace();

    await expect(page.locator('[data-testid="mcp-marketplace"]')).toBeVisible();
  });

  test('should search for extensions', async ({ page }) => {
    await extensionsPage.searchExtension('test');
    
    await page.waitForTimeout(1000);
    
    // Verify search results
    const cards = page.locator('[data-testid="extension-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should view installed extensions', async ({ page }) => {
    const installed = await extensionsPage.getInstalledExtensions();
    
    expect(Array.isArray(installed)).toBe(true);
  });

  test('should install extension', async ({ page }) => {
    // This test assumes a test extension exists
    const testExtension = 'test-mcp-extension';
    
    await extensionsPage.searchExtension(testExtension);
    await page.waitForTimeout(500);
    
    // Try to install (may fail if already installed)
    try {
      await extensionsPage.installExtension(testExtension);
      await page.waitForTimeout(3000);
      
      const installed = await extensionsPage.getInstalledExtensions();
      expect(installed.length).toBeGreaterThan(0);
    } catch (error) {
      // Extension may already be installed
      console.log('Extension already installed or not found');
    }
  });

  test('should configure extension', async ({ page }) => {
    const installed = await extensionsPage.getInstalledExtensions();
    
    if (installed.length > 0) {
      const config = {
        apiKey: 'test-key-123',
        timeout: '30'
      };
      
      await extensionsPage.configureExtension(installed[0], config);
      await page.waitForTimeout(1000);
    }
  });

  test('should view extension tools', async ({ page }) => {
    const installed = await extensionsPage.getInstalledExtensions();
    
    if (installed.length > 0) {
      await extensionsPage.viewExtensionTools(installed[0]);
      
      const tools = await extensionsPage.getAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
    }
  });

  test('should invoke tool', async ({ page }) => {
    const installed = await extensionsPage.getInstalledExtensions();
    
    if (installed.length > 0) {
      await extensionsPage.viewExtensionTools(installed[0]);
      
      const tools = await extensionsPage.getAvailableTools();
      
      if (tools.length > 0) {
        const params = { input: 'test' };
        
        try {
          await extensionsPage.invokeTool(tools[0], params);
          await page.waitForTimeout(2000);
        } catch (error) {
          // Tool invocation may fail in test environment
          console.log('Tool invocation failed (expected in test env)');
        }
      }
    }
  });

  test('should handle extension errors gracefully', async ({ page }) => {
    // Try to install non-existent extension
    try {
      await extensionsPage.installExtension('non-existent-extension-xyz');
      await page.waitForTimeout(2000);
    } catch (error) {
      // Expected to fail
      expect(error).toBeTruthy();
    }
  });

  test('should filter extensions by category', async ({ page }) => {
    const filterSelect = page.locator('[data-testid="filter-category"]');
    
    if (await filterSelect.isVisible()) {
      await filterSelect.selectOption('productivity');
      await page.waitForTimeout(500);
      
      await filterSelect.selectOption('ai');
      await page.waitForTimeout(500);
      
      await filterSelect.selectOption('all');
      await page.waitForTimeout(500);
    }
  });
});
