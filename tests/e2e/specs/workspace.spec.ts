import { test, expect } from '../fixtures/electron';
import { WorkspacePage } from '../page-objects';

test.describe('Workspace Navigation Tests', () => {
  let workspacePage: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    workspacePage = new WorkspacePage(page);
    await page.waitForLoadState('domcontentloaded');
    await workspacePage.waitForWorkspaceReady();
  });

  test('should load workspace successfully', async ({ page }) => {
    // Verify sidebar is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Verify content area is visible
    await expect(page.locator('[data-testid="content-area"]')).toBeVisible();
  });

  test('should navigate to file explorer', async ({ page }) => {
    await workspacePage.openFileExplorer();
    
    await page.waitForTimeout(500);
    
    // Verify file explorer content
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
  });

  test('should navigate to git view', async ({ page }) => {
    await workspacePage.openGit();
    
    await page.waitForTimeout(500);
    
    // Verify git panel
    await expect(page.locator('[data-testid="git-panel"]')).toBeVisible();
  });

  test('should navigate to terminal', async ({ page }) => {
    await workspacePage.openTerminal();
    
    await page.waitForTimeout(500);
    
    // Verify terminal panel
    await expect(page.locator('[data-testid="terminal-panel"]')).toBeVisible();
  });

  test('should navigate to AI chat', async ({ page }) => {
    await workspacePage.openAIChat();
    
    await page.waitForTimeout(500);
    
    // Verify AI chat panel
    await expect(page.locator('[data-testid="ai-chat-panel"]')).toBeVisible();
  });

  test('should navigate to extensions', async ({ page }) => {
    await workspacePage.openExtensions();
    
    await page.waitForTimeout(500);
    
    // Verify extensions panel
    await expect(page.locator('[data-testid="extensions-panel"]')).toBeVisible();
  });

  test('should navigate to notes', async ({ page }) => {
    await workspacePage.openNotes();
    
    await page.waitForTimeout(500);
    
    // Verify notes view
    await expect(page.locator('[data-testid="notes-view"]')).toBeVisible();
  });

  test('should navigate to plans', async ({ page }) => {
    await workspacePage.openPlans();
    
    await page.waitForTimeout(500);
    
    // Verify plans view
    await expect(page.locator('[data-testid="plans-view"]')).toBeVisible();
  });

  test('should navigate to browser', async ({ page }) => {
    await workspacePage.openBrowser();
    
    await page.waitForTimeout(500);
    
    // Verify browser view
    await expect(page.locator('[data-testid="browser-view"]')).toBeVisible();
  });

  test('should navigate to account', async ({ page }) => {
    await workspacePage.openAccount();
    
    await page.waitForTimeout(500);
    
    // Verify account panel
    await expect(page.locator('[data-testid="account-panel"]')).toBeVisible();
  });

  test('should navigate to automations', async ({ page }) => {
    await workspacePage.openAutomations();
    
    await page.waitForTimeout(500);
    
    // Verify automations panel
    await expect(page.locator('[data-testid="automation-panel"]')).toBeVisible();
  });

  test('should toggle theme', async ({ page }) => {
    const initialTheme = await workspacePage.getCurrentTheme();
    
    await workspacePage.toggleTheme();
    
    const newTheme = await workspacePage.getCurrentTheme();
    expect(newTheme).not.toBe(initialTheme);
  });

  test('should switch themes multiple times', async ({ page }) => {
    await workspacePage.toggleTheme();
    await page.waitForTimeout(600);
    
    await workspacePage.toggleTheme();
    await page.waitForTimeout(600);
    
    await workspacePage.toggleTheme();
    await page.waitForTimeout(600);
  });

  test('should navigate between multiple views quickly', async ({ page }) => {
    // Rapid navigation test
    await workspacePage.openFileExplorer();
    await page.waitForTimeout(200);
    
    await workspacePage.openGit();
    await page.waitForTimeout(200);
    
    await workspacePage.openTerminal();
    await page.waitForTimeout(200);
    
    await workspacePage.openAIChat();
    await page.waitForTimeout(200);
    
    await workspacePage.openExtensions();
    await page.waitForTimeout(200);
    
    // Verify final view is visible
    await expect(page.locator('[data-testid="extensions-panel"]')).toBeVisible();
  });
});
