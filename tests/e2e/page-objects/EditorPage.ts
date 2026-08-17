import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Editor Page Object - Handles file editing operations
 */
export class EditorPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Selectors
  private selectors = {
    fileExplorer: '[data-testid="file-explorer"]',
    editorContainer: '.monaco-editor',
    // This Monaco build renders its hidden input as `textarea.ime-text-area`,
    // not the `textarea.inputarea` older versions used.
    editorTextarea: '.monaco-editor textarea',
    tab: '[data-testid="editor-tab"]',
    tabCloseButton: '[data-testid="tab-close"]',
    saveButton: '[data-testid="save-file"]',
    fileTree: '[data-testid="file-tree"]',
    fileItem: (filename: string) => `[data-testid="file-item"][data-filename="${filename}"]`
  };

  /**
   * Open a file from the file explorer
   *
   * The tree opens files on a single click (see FileExplorer's Node handler), so
   * dblclick() was waiting on an interaction the UI never expects. The explorer
   * also has to be the active view for the tree to be mounted.
   */
  async openFile(filename: string): Promise<void> {
    await this.openExplorer();

    const fileItem = this.page.locator(this.selectors.fileItem(filename));
    await fileItem.waitFor({ state: 'visible', timeout: 15000 });

    // The sidebar animates its width, so a click issued mid-transition can be
    // reported as intercepted by the main area even though the geometry does not
    // actually overlap. Settle first, then fall back to the tree's keyboard path
    // (Enter opens a file, same as click) if the pointer path is still blocked.
    await this.page.waitForTimeout(400);

    try {
      await fileItem.click({ timeout: 5000 });
    } catch {
      await fileItem.focus();
      await this.page.keyboard.press('Enter');
    }

    await this.waitForEditorReady();
  }

  /**
   * Make the explorer the active view, so the file tree AND the editor are both
   * mounted.
   *
   * The early-exit must test the main area, not the sidebar. The workbench keeps
   * the last sidebar view rendered while a document view (terminal, chat, notes)
   * owns the main area — see `lastSidebarView` in components/layout/Workbench.tsx.
   * So `file-explorer` stays visible with the terminal open, and gating on it
   * meant this returned without clicking, leaving the editor unmounted and every
   * subsequent tab/Monaco assertion waiting on an element that was never coming.
   *
   * `editor-area` is the main-area testid for exactly the views that fall
   * through to the editor (explorer/search/git), which is the condition callers
   * actually depend on.
   */
  async openExplorer(): Promise<void> {
    const editorArea = this.page.locator('[data-testid="editor-area"]');
    const fileTreeVisible = await this.page.locator(this.selectors.fileExplorer).isVisible();
    if (fileTreeVisible && (await editorArea.isVisible())) return;

    await this.page.click('[data-testid="sidebar-explorer"]');
    await this.waitForElement(this.selectors.fileExplorer, 15000);
    await editorArea.waitFor({ state: 'visible', timeout: 15000 });
  }

  /**
   * Wait for Monaco editor to be ready
   *
   * Monaco's `textarea.inputarea` is deliberately positioned off-screen, so it
   * is 'attached' but never 'visible'; waiting for visibility (the default) hung
   * for the full timeout. Waiting for the model instead confirms the editor is
   * genuinely usable rather than just painted.
   */
  async waitForEditorReady(): Promise<void> {
    await this.page.waitForSelector(this.selectors.editorContainer, { timeout: 30000 });
    await this.page.waitForSelector(this.selectors.editorTextarea, {
      state: 'attached',
      timeout: 30000,
    });
    await this.page.waitForFunction(
      () => {
        const monaco = (window as any).monaco;
        return Boolean(monaco?.editor?.getModels?.()?.length);
      },
      undefined,
      { timeout: 30000 }
    );
  }

  /**
   * Type text into the editor
   *
   * Clicks the editor surface to focus it, then types through the keyboard.
   * Monaco's input textarea is off-screen, so `locator.type()` on it is not
   * reliable.
   */
  async typeInEditor(text: string): Promise<void> {
    await this.waitForEditorReady();
    await this.page.locator(this.selectors.editorContainer).first().click();
    await this.page.keyboard.type(text);
  }

  /**
   * Get editor content
   *
   * The app never assigns `window.monacoEditor`, so the old implementation
   * always returned ''. Monaco's own global (`window.monaco`) is available once
   * the editor has mounted, so read the model through that.
   */
  async getEditorContent(): Promise<string> {
    await this.waitForEditorReady();

    return this.page.evaluate(() => {
      const monaco = (window as any).monaco;
      const model = monaco?.editor?.getModels?.()?.[0];
      return model ? model.getValue() : '';
    });
  }

  /**
   * Set editor content
   */
  async setEditorContent(content: string): Promise<void> {
    await this.waitForEditorReady();

    // Replace via the model so Monaco fires its change events and the app's
    // dirty tracking stays consistent with a real edit.
    await this.page.evaluate((text) => {
      const monaco = (window as any).monaco;
      const model = monaco?.editor?.getModels?.()?.[0];
      if (!model) return;

      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text }],
        () => null
      );
    }, content);
  }

  /**
   * Save current file
   */
  async saveFile(): Promise<void> {
    await this.page.keyboard.press('Control+S');
    await this.page.waitForTimeout(500); // Wait for save operation
  }

  /**
   * Close current tab
   */
  async closeTab(index: number = 0): Promise<void> {
    const tabs = this.page.locator(this.selectors.tab);
    const tab = tabs.nth(index);
    const closeButton = tab.locator(this.selectors.tabCloseButton);
    await closeButton.click();
  }

  /**
   * Get number of open tabs
   */
  async getTabCount(): Promise<number> {
    return this.page.locator(this.selectors.tab).count();
  }

  /**
   * Switch to tab by index
   */
  async switchToTab(index: number): Promise<void> {
    const tabs = this.page.locator(this.selectors.tab);
    await tabs.nth(index).click();
  }

  /**
   * Check if file is modified (has unsaved changes)
   */
  async isFileModified(): Promise<boolean> {
    const tab = this.page.locator(this.selectors.tab).first();
    return tab.locator('[data-testid="modified-indicator"]').isVisible();
  }

  /**
   * Trigger autocomplete
   */
  async triggerAutocomplete(): Promise<void> {
    await this.page.keyboard.press('Control+Space');
    await this.page.waitForSelector('.monaco-list-row', { timeout: 2000 }).catch(() => {});
  }

  /**
   * Select autocomplete suggestion
   */
  async selectAutocompleteSuggestion(index: number = 0): Promise<void> {
    const suggestions = this.page.locator('.monaco-list-row');
    await suggestions.nth(index).click();
  }
}
