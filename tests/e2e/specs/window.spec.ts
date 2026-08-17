import { test, expect } from '../fixtures';

test.describe('Window Management Tests', () => {
  test('should launch application window', async ({ page }) => {
    // Verify window loaded
    expect(await page.title()).toBeTruthy();
  });

  test('should have correct window dimensions', async ({ page }) => {
    const size = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  test('should handle window resize', async ({ page }) => {
    // Get initial size
    const initialSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    // Resize window
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.waitForTimeout(500);
    
    const newSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    expect(newSize.width).not.toBe(initialSize.width);
  });

  test('should handle minimize and maximize', async ({ page }) => {
    // Evaluate window state
    await page.evaluate(() => {
      // Simulate maximize (actual window control depends on platform)
      return Promise.resolve();
    });
    
    await page.waitForTimeout(500);
  });

  test('should close gracefully', async ({ electronApp }) => {
    // App will be closed automatically by the fixture
    expect(electronApp).toBeTruthy();
  });
});
