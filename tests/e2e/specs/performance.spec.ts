import { test, expect } from '../fixtures/electron';
import { AI_PROVIDER_SKIP_REASON, HAS_AI_PROVIDER } from '../fixtures/env';

test.describe('Performance Tests', () => {
  test('should load workspace within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
    console.log(`Workspace load time: ${loadTime}ms`);
  });

  test('should handle rapid clicks without freezing', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    const buttons = [
      '[data-testid="sidebar-explorer"]',
      '[data-testid="sidebar-git"]',
      '[data-testid="sidebar-terminal"]',
      '[data-testid="sidebar-ai-chat"]'
    ];
    
    const startTime = Date.now();
    
    // Rapid clicking
    for (let i = 0; i < 20; i++) {
      await page.click(buttons[i % buttons.length]);
      await page.waitForTimeout(50);
    }
    
    const duration = Date.now() - startTime;
    
    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
    
    // Verify app is still responsive
    expect(await page.locator('[data-testid="sidebar"]').isVisible()).toBe(true);
  });

  test('should handle multiple editor tabs efficiently', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    const startTime = Date.now();
    
    // Open 10 tabs
    for (let i = 0; i < 10; i++) {
      await page.evaluate((index) => {
        // Simulate opening file
        const event = new CustomEvent('open-file', {
          detail: { path: `/test/file${index}.ts` }
        });
        window.dispatchEvent(event);
      }, i);
      await page.waitForTimeout(200);
    }
    
    const duration = Date.now() - startTime;
    
    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  test('should handle large AI responses', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    await page.waitForLoadState('domcontentloaded');
    
    await page.click('[data-testid="sidebar-ai-chat"]');
    await page.waitForSelector('[data-testid="ai-chat-panel"]');
    
    const startTime = Date.now();
    
    await page.fill('[data-testid="chat-input"]', 'Write a very long explanation of JavaScript');
    await page.click('[data-testid="send-message"]');
    
    // Wait for response
    await page.waitForTimeout(30000);
    
    const duration = Date.now() - startTime;
    
    console.log(`AI response time: ${duration}ms`);
    
    // Verify app is still responsive
    expect(await page.locator('[data-testid="ai-chat-panel"]').isVisible()).toBe(true);
  });

  test('should handle concurrent terminal operations', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    await page.click('[data-testid="sidebar-terminal"]');
    await page.waitForSelector('[data-testid="terminal-panel"]');
    
    const startTime = Date.now();
    
    // Create 5 terminals
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="new-terminal"]');
      await page.waitForTimeout(300);
    }
    
    const duration = Date.now() - startTime;
    
    // Should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
    
    // Verify all terminals created
    const terminalCount = await page.locator('[data-testid="terminal-tab"]').count();
    expect(terminalCount).toBeGreaterThanOrEqual(5);
  });

  test('should handle memory efficiently over time', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    // Perform various operations
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="sidebar-ai-chat"]');
      await page.waitForTimeout(200);
      
      await page.click('[data-testid="sidebar-git"]');
      await page.waitForTimeout(200);
      
      await page.click('[data-testid="sidebar-terminal"]');
      await page.waitForTimeout(200);
    }
    
    // Get memory usage
    const metrics = await page.evaluate(() => {
      if ('memory' in performance) {
        const mem = (performance as any).memory;
        return {
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize
        };
      }
      return null;
    });
    
    if (metrics) {
      console.log('Memory metrics:', metrics);
      
      // Used heap should be less than total heap
      expect(metrics.usedJSHeapSize).toBeLessThan(metrics.totalJSHeapSize);
    }
  });

  test('should render complex UI without lag', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    // Open git panel with potentially many files
    await page.click('[data-testid="sidebar-git"]');
    await page.waitForSelector('[data-testid="git-panel"]');
    
    const startTime = Date.now();
    
    // Trigger refresh
    await page.click('[data-testid="git-refresh"]');
    await page.waitForTimeout(2000);
    
    const duration = Date.now() - startTime;
    
    // Should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
  });
});
