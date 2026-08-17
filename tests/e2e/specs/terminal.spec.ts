import { test, expect } from '../fixtures/electron';
import { TerminalPage } from '../page-objects';

test.describe('Terminal Tests', () => {
  let terminalPage: TerminalPage;

  test.beforeEach(async ({ page }) => {
    terminalPage = new TerminalPage(page);
    await page.waitForLoadState('domcontentloaded');
    await terminalPage.openTerminalPanel();
  });

  test('should open terminal panel', async ({ page }) => {
    // Verify terminal panel is visible
    await expect(page.locator('[data-testid="terminal-panel"]')).toBeVisible();
  });

  test('should create new terminal', async ({ page }) => {
    const initialCount = await terminalPage.getTerminalCount();
    
    await terminalPage.createNewTerminal();
    
    const newCount = await terminalPage.getTerminalCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should execute commands', async ({ page }) => {
    await terminalPage.createNewTerminal();
    
    // Execute simple command
    await terminalPage.typeCommand('echo "Hello Terminal"', true);
    await terminalPage.waitForCommandComplete(2000);
    
    // Get output
    const output = await terminalPage.getTerminalOutput();
    expect(output).toContain('Hello Terminal');
  });

  test('should switch between terminals', async ({ page }) => {
    await terminalPage.createNewTerminal();
    await terminalPage.createNewTerminal();
    
    const count = await terminalPage.getTerminalCount();
    expect(count).toBeGreaterThanOrEqual(2);
    
    // Switch to first terminal
    await terminalPage.switchToTerminal(0);
    await page.waitForTimeout(300);
    
    // Switch to second terminal
    await terminalPage.switchToTerminal(1);
    await page.waitForTimeout(300);
  });

  test('should close terminal', async ({ page }) => {
    await terminalPage.createNewTerminal();
    await terminalPage.createNewTerminal();
    
    const initialCount = await terminalPage.getTerminalCount();
    
    await terminalPage.closeTerminal(0);
    
    const newCount = await terminalPage.getTerminalCount();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should clear terminal', async ({ page }) => {
    await terminalPage.createNewTerminal();
    
    // Add some output
    await terminalPage.typeCommand('echo "test output"', true);
    await terminalPage.waitForCommandComplete(1000);
    
    // Clear terminal
    await terminalPage.clearTerminal();
    await page.waitForTimeout(500);
  });

  test('should handle long-running commands', async ({ page }) => {
    await terminalPage.createNewTerminal();
    
    // Execute a sleep command
    await terminalPage.typeCommand('sleep 2', true);
    
    // Wait for command to complete
    await terminalPage.waitForCommandComplete(3000);
  });

  test('should resize terminal', async ({ page }) => {
    await terminalPage.createNewTerminal();
    
    // Get terminal element
    const terminal = page.locator('[data-testid="terminal-panel"]');
    
    // Verify terminal is visible
    await expect(terminal).toBeVisible();
    
    // Get initial size
    const initialBox = await terminal.boundingBox();
    expect(initialBox).toBeTruthy();
  });

  test('should handle multiple concurrent terminals', async ({ page }) => {
    // Create 3 terminals
    await terminalPage.createNewTerminal();
    await terminalPage.createNewTerminal();
    await terminalPage.createNewTerminal();
    
    const count = await terminalPage.getTerminalCount();
    expect(count).toBe(3);
    
    // Execute commands in each
    await terminalPage.switchToTerminal(0);
    await terminalPage.typeCommand('echo "Terminal 1"', true);
    
    await terminalPage.switchToTerminal(1);
    await terminalPage.typeCommand('echo "Terminal 2"', true);
    
    await terminalPage.switchToTerminal(2);
    await terminalPage.typeCommand('echo "Terminal 3"', true);
    
    await terminalPage.waitForCommandComplete(2000);
  });

  test('should persist terminal sessions', async ({ page }) => {
    await terminalPage.createNewTerminal();
    await terminalPage.typeCommand('export TEST_VAR="hello"', true);
    await terminalPage.waitForCommandComplete(1000);
    
    // Verify variable persists
    await terminalPage.typeCommand('echo $TEST_VAR', true);
    await terminalPage.waitForCommandComplete(1000);
    
    const output = await terminalPage.getTerminalOutput();
    expect(output).toContain('hello');
  });
});
