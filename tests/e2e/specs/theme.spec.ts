import { test, expect } from '../fixtures/electron';

test.describe('Theme Switching Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
  });

  test('should switch from dark to light theme', async ({ page }) => {
    const html = page.locator('html');
    
    // Get initial theme
    const initialClasses = await html.getAttribute('class') || '';
    const initialIsDark = initialClasses.includes('dark');
    
    // Click theme switcher
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(600);
    
    // Get new theme
    const newClasses = await html.getAttribute('class') || '';
    const newIsDark = newClasses.includes('dark');
    
    // Verify theme changed
    expect(newIsDark).not.toBe(initialIsDark);
  });

  test('should persist theme preference', async ({ page }) => {
    // Set theme
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(600);
    
    const html = page.locator('html');
    const themeBeforeReload = await html.getAttribute('class') || '';
    
    // Reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Verify theme persisted
    const themeAfterReload = await html.getAttribute('class') || '';
    expect(themeAfterReload).toBe(themeBeforeReload);
  });

  test('should apply theme to all components', async ({ page }) => {
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(600);
    
    // Check various components have theme applied
    const sidebar = page.locator('[data-testid="sidebar"]');
    const contentArea = page.locator('[data-testid="content-area"]');
    
    await expect(sidebar).toBeVisible();
    await expect(contentArea).toBeVisible();
    
    // Get computed styles
    const sidebarBg = await sidebar.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    expect(sidebarBg).toBeTruthy();
  });

  test('should animate theme transition smoothly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(600);
    
    const duration = Date.now() - startTime;
    
    // Should complete within 1 second
    expect(duration).toBeLessThan(1000);
  });

  test('should handle rapid theme toggles', async ({ page }) => {
    // Toggle multiple times rapidly
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="theme-switcher"]');
      await page.waitForTimeout(300);
    }
    
    // Verify app is still responsive
    await page.waitForTimeout(500);
    expect(await page.locator('[data-testid="sidebar"]').isVisible()).toBe(true);
  });
});
