import { test, expect } from '../fixtures/electron';
import { AI_PROVIDER_SKIP_REASON, HAS_AI_PROVIDER } from '../fixtures/env';
import { EditorPage, GitPage, AIChatPage } from '../page-objects';

test.describe('Complex Integration Tests', () => {
  test('should handle concurrent edit + commit + AI chat', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    const editorPage = new EditorPage(page);
    const gitPage = new GitPage(page);
    const aiChatPage = new AIChatPage(page);
    
    await page.waitForLoadState('domcontentloaded');
    
    // Step 1: Edit a file
    await editorPage.openFile('test-file.ts');
    await editorPage.setEditorContent('// Concurrent operations test\nconst x = 123;');
    await editorPage.saveFile();
    
    // Step 2: Open AI chat and send message
    await aiChatPage.openChatPanel();
    await aiChatPage.sendMessage('What is TypeScript?');
    
    // Step 3: While AI is responding, stage and commit changes
    await gitPage.openGitPanel();
    await gitPage.refresh();
    
    const hasChanges = await gitPage.hasChanges();
    if (hasChanges) {
      await gitPage.stageAllFiles();
      await gitPage.commit('E2E: Concurrent operations test');
    }
    
    // Step 4: Wait for AI response
    await aiChatPage.waitForResponse(30000);
    
    const response = await aiChatPage.getLastAssistantMessage();
    expect(response).toBeTruthy();
    
    // Verify all operations completed
    await page.waitForTimeout(1000);
  });

  test('should handle rapid view transitions', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    const views = [
      '[data-testid="sidebar-explorer"]',
      '[data-testid="sidebar-git"]',
      '[data-testid="sidebar-terminal"]',
      '[data-testid="sidebar-ai-chat"]',
      '[data-testid="sidebar-extensions"]',
      '[data-testid="sidebar-automations"]',
      '[data-testid="sidebar-account"]'
    ];
    
    // Rapid switching
    for (let i = 0; i < 3; i++) {
      for (const view of views) {
        await page.click(view);
        await page.waitForTimeout(100);
      }
    }
    
    // Verify app is still responsive
    await page.waitForTimeout(1000);
    expect(await page.locator('[data-testid="sidebar"]').isVisible()).toBe(true);
  });

  test('should persist state after reload', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    const editorPage = new EditorPage(page);
    const aiChatPage = new AIChatPage(page);
    
    await page.waitForLoadState('domcontentloaded');
    
    // Set up state
    await editorPage.openFile('persistence-test.ts');
    await editorPage.setEditorContent('// State persistence test');
    await editorPage.saveFile();
    
    await aiChatPage.openChatPanel();
    await aiChatPage.sendMessage('Remember this: test123');
    await aiChatPage.waitForResponse(10000);
    
    // Reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Verify state persisted
    const content = await editorPage.getEditorContent();
    expect(content).toContain('State persistence');
  });

  test('should handle error recovery', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    // Trigger potential errors
    try {
      await page.click('[data-testid="non-existent-button"]', { timeout: 1000 });
    } catch (error) {
      // Expected error
    }
    
    // Verify app recovers
    await page.waitForTimeout(500);
    expect(await page.locator('[data-testid="sidebar"]').isVisible()).toBe(true);
  });

  test('should handle multiple terminal + editor tabs', async ({ page }) => {
    const editorPage = new EditorPage(page);
    
    await page.waitForLoadState('domcontentloaded');
    
    // Open multiple editor tabs
    await editorPage.openFile('file1.ts');
    await editorPage.openFile('file2.ts');
    await editorPage.openFile('file3.ts');
    
    const editorTabs = await editorPage.getTabCount();
    expect(editorTabs).toBeGreaterThanOrEqual(3);
    
    // Open terminal
    await page.click('[data-testid="sidebar-terminal"]');
    await page.waitForTimeout(500);
    
    // Create multiple terminals
    await page.click('[data-testid="new-terminal"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="new-terminal"]');
    await page.waitForTimeout(500);

    // The main area is a single slot: Terminal *replaces* the editor rather than
    // docking beneath it (see MainArea in components/layout/Workbench.tsx — only
    // explorer/search/git fall through to EditorArea). So the editor tabs are
    // unmounted while the terminal is open, and clicking one here would wait on
    // an element the design never shows. The status bar is what reports editor
    // state from a document view.
    await expect(page.locator('[data-testid="status-open-tabs"]')).toContainText('3 files open');

    // Returning to the explorer must bring the same tabs back — that round trip
    // is the actual integration risk: view switching must not drop editor state.
    await editorPage.openExplorer();
    await editorPage.waitForEditorReady();
    expect(await editorPage.getTabCount()).toBe(editorTabs);

    // And the tabs must still be interactive after the detour.
    await editorPage.switchToTab(0);
    await editorPage.switchToTab(1);
    await editorPage.switchToTab(2);

    // Returning to the terminal shows the two terminals created above.
    //
    // FIXED (was a reported bug): TerminalGrid held its terminal list in
    // component-local `useState` with no rehydration. Switching view unmounts it,
    // so the renderer forgot every terminal it had opened AND never sent
    // `terminal:kill` — leaking one PTY per terminal created. Measured at 6
    // orphaned shell processes for 6 terminals over 3 view switches
    // (`scripts/measure-pty-leak.ts`), now 0.
    //
    // The recovery path was half-built: `TerminalService.listTerminals()` already
    // existed but was not exposed over IPC. It now is, as `terminal:list`
    // (packages/main/src/ipc/handlers/terminal-handlers.ts, allowlisted in
    // packages/preload/src/index.ts), and TerminalGrid reattaches on mount rather
    // than killing on unmount — a terminal running a long build must survive a
    // glance at the Git panel.
    await page.click('[data-testid="sidebar-terminal"]');
    await expect(page.locator('[data-testid="terminal-panel"]')).toBeVisible();
  });

  // FIXED (was `fixme`): terminal sessions now survive a view switch. See the
  // note in 'should handle multiple terminal + editor tabs' above.
  test('should keep terminal sessions across a view switch', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    await page.click('[data-testid="sidebar-terminal"]');
    await page.click('[data-testid="new-terminal"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="new-terminal"]');
    await expect(page.locator('[data-testid="terminal-tab"]')).toHaveCount(2);

    // Leave and come back.
    await page.click('[data-testid="sidebar-explorer"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="sidebar-terminal"]');

    await expect(page.locator('[data-testid="terminal-tab"]')).toHaveCount(2);
  });

  test('should handle theme change during operations', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    const aiChatPage = new AIChatPage(page);
    
    await page.waitForLoadState('domcontentloaded');
    
    // Start AI chat
    await aiChatPage.openChatPanel();
    await aiChatPage.sendMessage('Tell me about React');
    
    // Change theme while streaming
    await page.waitForTimeout(1000);
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(500);
    
    // Wait for response to complete
    await aiChatPage.waitForResponse(30000);
    
    // Change theme again
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(500);
    
    // Verify response received
    const response = await aiChatPage.getLastAssistantMessage();
    expect(response).toBeTruthy();
  });

  test('should handle long-running operations', async ({ page }) => {
    test.skip(!HAS_AI_PROVIDER, AI_PROVIDER_SKIP_REASON);

    const aiChatPage = new AIChatPage(page);
    
    await page.waitForLoadState('domcontentloaded');
    
    await aiChatPage.openChatPanel();
    
    // Start multiple long operations
    await aiChatPage.sendMessage('Write a comprehensive guide to TypeScript');
    await aiChatPage.waitForResponse(60000);
    
    await aiChatPage.sendMessage('Explain async/await in detail');
    await aiChatPage.waitForResponse(60000);
    
    // Verify both completed
    const messages = await aiChatPage.getAllMessages();
    expect(messages.length).toBeGreaterThanOrEqual(4);
  });

  test('should handle file operations with git tracking', async ({ page }) => {
    const editorPage = new EditorPage(page);
    const gitPage = new GitPage(page);
    
    await page.waitForLoadState('domcontentloaded');
    
    // Edit file
    await editorPage.openFile('tracked-file.ts');
    await editorPage.setEditorContent('// Modified by E2E test\nconst test = true;');
    await editorPage.saveFile();
    
    // Check git status
    await gitPage.openGitPanel();
    await gitPage.refresh();
    
    const hasChanges = await gitPage.hasChanges();
    expect(hasChanges).toBe(true);
    
    // Stage and view diff
    await gitPage.stageAllFiles();
    const changedFiles = await gitPage.getChangedFiles();
    
    if (changedFiles.length > 0) {
      await gitPage.viewDiff(changedFiles[0]);
      await expect(page.locator('[data-testid="diff-viewer"]')).toBeVisible();
    }
  });
});
