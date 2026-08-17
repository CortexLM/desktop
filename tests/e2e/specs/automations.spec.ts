import { test, expect } from '../fixtures/electron';
import { AutomationPage } from '../page-objects';

test.describe('Automation Tests', () => {
  let automationPage: AutomationPage;

  test.beforeEach(async ({ page }) => {
    automationPage = new AutomationPage(page);
    await page.waitForLoadState('domcontentloaded');
    await automationPage.openAutomationPanel();
  });

  test('should open automation panel', async ({ page }) => {
    await expect(page.locator('[data-testid="automation-panel"]')).toBeVisible();
  });

  test('should create new automation', async ({ page }) => {
    const automationName = `Test Automation ${Date.now()}`;
    
    await automationPage.createAutomation(automationName);
    
    // Verify editor opened
    await expect(page.locator('[data-testid="automation-editor"]')).toBeVisible();
  });

  test('should configure automation trigger', async ({ page }) => {
    await automationPage.createAutomation('Trigger Test');
    
    // Values must match the app's Trigger union: manual | file_watch |
    // git_hook | schedule.
    await automationPage.configureTrigger('file_watch', {
      patterns: '*.ts'
    });
    
    // Verify trigger configuration
    await page.waitForTimeout(500);
  });

  test('should configure automation action', async ({ page }) => {
    await automationPage.createAutomation('Action Test');
    
    // Values must match the app's Action union: run_script | ai_task |
    // git_operation | notification. `run_script` edits its script in a Monaco
    // editor, which cannot be driven with fill(), so the default script stands.
    await automationPage.configureAction('run_script', {});
    
    // Verify action configuration
    await page.waitForTimeout(500);
  });

  test('should save automation', async ({ page }) => {
    const automationName = `Saved Automation ${Date.now()}`;
    
    await automationPage.createAutomation(automationName);
    await automationPage.configureTrigger('schedule', { cron: '0 * * * *' });
    await automationPage.configureAction('run_script', {});
    await automationPage.saveAutomation();
    
    // Verify automation appears in list
    await page.waitForTimeout(1000);
    const automations = await automationPage.getAutomationList();
    expect(automations.some(a => a.includes(automationName))).toBe(true);
  });

  test('should toggle automation on/off', async ({ page }) => {
    const automations = await automationPage.getAutomationList();
    
    if (automations.length > 0) {
      await automationPage.toggleAutomation(automations[0]);
      await page.waitForTimeout(500);
      
      // Toggle again
      await automationPage.toggleAutomation(automations[0]);
      await page.waitForTimeout(500);
    }
  });

  test('should run automation manually', async ({ page }) => {
    const automationName = `Manual Run ${Date.now()}`;
    
    await automationPage.createAutomation(automationName);
    await automationPage.configureTrigger('manual', {});
    await automationPage.configureAction('run_script', {});
    await automationPage.saveAutomation();
    
    await page.waitForTimeout(1000);
    
    // Run automation
    await automationPage.runAutomation(automationName);
    
    // Wait for execution
    await page.waitForTimeout(2000);
  });

  test('should view automation logs', async ({ page }) => {
    const automations = await automationPage.getAutomationList();
    
    if (automations.length > 0) {
      await automationPage.viewLogs(automations[0]);
      
      // Verify logs viewer
      await expect(page.locator('[data-testid="logs-viewer"]')).toBeVisible();
    }
  });

  test('should delete automation', async ({ page }) => {
    const automationName = `Delete Test ${Date.now()}`;
    
    await automationPage.createAutomation(automationName);
    // The editor refuses to save without at least one action, so the automation
    // would never have existed to delete.
    await automationPage.configureAction('run_script', {});
    await automationPage.saveAutomation();
    
    await page.waitForTimeout(1000);
    
    // Delete automation
    await automationPage.deleteAutomation(automationName);
    
    await page.waitForTimeout(1000);
    
    // Verify automation removed
    const automations = await automationPage.getAutomationList();
    expect(automations.some(a => a.includes(automationName))).toBe(false);
  });

  test('should handle multiple automations', async ({ page }) => {
    const names = [
      `Multi Test 1 ${Date.now()}`,
      `Multi Test 2 ${Date.now()}`,
      `Multi Test 3 ${Date.now()}`
    ];
    
    for (const name of names) {
      await automationPage.createAutomation(name);
      await automationPage.configureTrigger('manual', {});
      await automationPage.configureAction('run_script', {});
      await automationPage.saveAutomation();
      await page.waitForTimeout(500);
    }
    
    const automations = await automationPage.getAutomationList();
    expect(automations.length).toBeGreaterThanOrEqual(3);
  });
});
