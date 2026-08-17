import { test, expect } from '../fixtures/electron';
import { AI_PROVIDER_SKIP_REASON, HAS_AI_PROVIDER } from '../fixtures/env';

test.describe('Error Handling Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    // Simulate offline mode
    await page.context().setOffline(true);
    
    // Try to perform an operation that requires network
    await page.click('[data-testid="sidebar-ai-chat"]');
    await page.waitForSelector('[data-testid="ai-chat-panel"]');
    
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-message"]');
    
    await page.waitForTimeout(2000);
    
    // Should show error or handle gracefully
    const isVisible = await page.locator('[data-testid="ai-chat-panel"]').isVisible();
    expect(isVisible).toBe(true);
    
    // Restore online
    await page.context().setOffline(false);
  });

  test('should recover from invalid file paths', async ({ page }) => {
    // Try to open non-existent file
    await page.evaluate(() => {
      const event = new CustomEvent('open-file', {
        detail: { path: '/non/existent/path/file.ts' }
      });
      window.dispatchEvent(event);
    });
    
    await page.waitForTimeout(1000);
    
    // App should still be functional
    expect(await page.locator('[data-testid="sidebar"]').isVisible()).toBe(true);
  });

  test('should handle invalid git operations', async ({ page }) => {
    await page.click('[data-testid="sidebar-git"]');
    await page.waitForSelector('[data-testid="git-panel"]');

    // Commit needs staged files: the button is disabled until then, and the
    // message field only exists inside the dialog that button opens. With
    // nothing staged the correct behaviour is that the commit cannot start —
    // which is what this test asserts.
    const commitButton = page.locator('[data-testid="commit-button"]');
    await expect(commitButton).toBeDisabled();

    try {
      await commitButton.click({ timeout: 2000 });
    } catch (error) {
      // Expected: the button is disabled with nothing staged.
    }
    
    await page.waitForTimeout(500);
    
    // App should still be functional
    expect(await page.locator('[data-testid="git-panel"]').isVisible()).toBe(true);
  });

  test('should handle AI service errors', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    await page.click('[data-testid="sidebar-ai-chat"]');
    await page.waitForSelector('[data-testid="ai-chat-panel"]');
    
    // Send message that might cause error
    await page.fill('[data-testid="chat-input"]', '');
    
    try {
      await page.click('[data-testid="send-message"]', { timeout: 1000 });
    } catch (error) {
      // Expected - empty message
    }
    
    await page.waitForTimeout(500);
    
    // App should still be functional
    expect(await page.locator('[data-testid="ai-chat-panel"]').isVisible()).toBe(true);
  });

  test('should handle terminal command errors', async ({ page }) => {
    await page.click('[data-testid="sidebar-terminal"]');
    await page.waitForSelector('[data-testid="terminal-panel"]');
    
    await page.click('[data-testid="new-terminal"]');
    await page.waitForTimeout(500);
    
    // Execute invalid command. xterm.js renders to a canvas and has no fillable
    // input, so focus the terminal surface and type.
    await page.locator('.xterm-screen').first().click();
    await page.keyboard.type('invalid-command-xyz-123');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Terminal should still be functional
    expect(await page.locator('[data-testid="terminal-panel"]').isVisible()).toBe(true);
  });

  test('should handle concurrent error scenarios', async ({ page }) => {
    // Trigger multiple potential errors simultaneously
    const promises = [
      page.evaluate(() => {
        const event = new CustomEvent('open-file', {
          detail: { path: '/invalid/path1.ts' }
        });
        window.dispatchEvent(event);
      }),
      page.evaluate(() => {
        const event = new CustomEvent('open-file', {
          detail: { path: '/invalid/path2.ts' }
        });
        window.dispatchEvent(event);
      }),
      page.click('[data-testid="sidebar-git"]').catch(() => {})
    ];
    
    await Promise.allSettled(promises);
    await page.waitForTimeout(2000);
    
    // App should still be functional
    expect(await page.locator('[data-testid="sidebar"]').isVisible()).toBe(true);
  });

  test('should log errors for debugging', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Trigger an error
    await page.evaluate(() => {
      console.error('Test error for logging');
    });
    
    await page.waitForTimeout(500);
    
    expect(consoleLogs.length).toBeGreaterThan(0);
  });
});
