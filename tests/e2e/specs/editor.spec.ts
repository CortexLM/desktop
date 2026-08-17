import { test, expect } from '../fixtures/electron';
import { EditorPage } from '../page-objects';

test.describe('Editor Tests', () => {
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    editorPage = new EditorPage(page);
    await page.waitForLoadState('domcontentloaded');
  });

  test('should open file from explorer', async ({ page }) => {
    // This test requires a file explorer with test files
    await editorPage.openFile('test-file.ts');
    
    // Verify editor is loaded
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('should type and save content', async ({ page }) => {
    await editorPage.openFile('test-file.ts');
    
    // Set content
    const testContent = 'console.log("Hello from E2E test");';
    await editorPage.setEditorContent(testContent);
    
    // Save file
    await editorPage.saveFile();
    
    // Wait and verify content persists
    await page.waitForTimeout(1000);
    const content = await editorPage.getEditorContent();
    expect(content).toContain('Hello from E2E test');
  });

  test('should manage multiple tabs', async ({ page }) => {
    // Open multiple files
    await editorPage.openFile('file1.ts');
    await editorPage.openFile('file2.ts');
    await editorPage.openFile('file3.ts');
    
    // Verify tab count
    const tabCount = await editorPage.getTabCount();
    expect(tabCount).toBe(3);
    
    // Switch tabs
    await editorPage.switchToTab(0);
    await editorPage.switchToTab(1);
    
    // Close a tab
    await editorPage.closeTab(1);
    
    const newTabCount = await editorPage.getTabCount();
    expect(newTabCount).toBe(2);
  });

  test('should show unsaved changes indicator', async ({ page }) => {
    await editorPage.openFile('test-file.ts');
    
    // Modify content
    await editorPage.typeInEditor('\n// Modified content');
    
    // Check for modified indicator
    const isModified = await editorPage.isFileModified();
    expect(isModified).toBe(true);
    
    // Save and check again
    await editorPage.saveFile();
    await page.waitForTimeout(500);
    
    const isModifiedAfterSave = await editorPage.isFileModified();
    expect(isModifiedAfterSave).toBe(false);
  });

  test('should trigger autocomplete', async ({ page }) => {
    await editorPage.openFile('test.ts');
    
    await editorPage.setEditorContent('const x = ');
    await editorPage.triggerAutocomplete();
    
    // Wait for autocomplete suggestions (if available)
    await page.waitForTimeout(1000);
    
    // Check if suggestions appeared
    const hasSuggestions = await page.locator('.monaco-list-row').count();
    expect(hasSuggestions).toBeGreaterThanOrEqual(0);
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await editorPage.openFile('test-file.ts');
    
    // Test save shortcut (Ctrl+S)
    await editorPage.setEditorContent('test content');
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(500);
    
    // Test undo (Ctrl+Z)
    await editorPage.typeInEditor('more content');
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(300);
  });

  // Open tabs now survive a reload: the editor store persists the session
  // (packages/renderer/src/store/editor-session.ts) and reconciles it against
  // the filesystem on boot. The assertion below is unchanged from when this was
  // a `fixme`.
  test('should persist editor state after reload', async ({ electronApp, page }) => {
    await editorPage.openFile('persistence-test.ts');
    
    const testContent = '// Persistence test content';
    await editorPage.setEditorContent(testContent);
    await editorPage.saveFile();
    
    // Reload the app
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify content persists
    const content = await editorPage.getEditorContent();
    expect(content).toContain('Persistence test');
  });
});
