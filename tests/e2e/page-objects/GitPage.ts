import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Git Page Object - Handles Git operations
 */
export class GitPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    gitPanel: '[data-testid="git-panel"]',
    statusSection: '[data-testid="git-status"]',
    changedFiles: '[data-testid="changed-file"]',
    stagedFiles: '[data-testid="staged-file"]',
    commitMessage: '[data-testid="commit-message"]',
    commitButton: '[data-testid="commit-button"]',
    commitDialog: '[data-testid="commit-dialog"]',
    pushButton: '[data-testid="push-button"]',
    pullButton: '[data-testid="pull-button"]',
    branchSelector: '[data-testid="branch-selector"]',
    branchList: '[data-testid="branch-list"]',
    branchItem: (name: string) => `[data-testid="branch-item"][data-branch="${name}"]`,
    diffViewer: '[data-testid="diff-viewer"]',
    stageButton: '[data-testid="stage-file"]',
    unstageButton: '[data-testid="unstage-file"]',
    refreshButton: '[data-testid="git-refresh"]',
    stageAllButton: '[data-testid="stage-all-button"]',
    // Two distinct controls, because they are two distinct operations: a tracked
    // file is restored from HEAD, an untracked file is removed from disk. The
    // panel renders one or the other per row, never both.
    discardButton: '[data-testid="discard-file"]',
    deleteButton: '[data-testid="delete-file"]',
    discardAllButton: '[data-testid="discard-all-button"]'
  };

  /**
   * Open Git panel
   */
  async openGitPanel(): Promise<void> {
    await this.page.click('[data-testid="sidebar-git"]');
    await this.waitForElement(this.selectors.gitPanel);
  }

  /**
   * Get list of changed file paths
   *
   * Reads `data-filename` rather than the row's text: the row also contains the
   * one-letter status badge, so `allTextContents()` returned values like
   * "MREADME.md" which then failed to match any selector.
   */
  async getChangedFiles(): Promise<string[]> {
    return this.getFilenames(this.selectors.changedFiles);
  }

  /**
   * Get list of staged file paths
   */
  async getStagedFiles(): Promise<string[]> {
    return this.getFilenames(this.selectors.stagedFiles);
  }

  private async getFilenames(selector: string): Promise<string[]> {
    const rows = this.page.locator(selector);
    const count = await rows.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const name = await rows.nth(i).getAttribute('data-filename');
      if (name) names.push(name);
    }

    return names;
  }

  /**
   * Stage a file
   */
  async stageFile(filename: string): Promise<void> {
    const file = this.page.locator(`${this.selectors.changedFiles}[data-filename="${filename}"]`);
    await file.hover();
    await file.locator(this.selectors.stageButton).click();
  }

  /**
   * Stage every changed file
   *
   * The panel has no bulk "stage all" control, so this toggles each file in
   * turn. Re-reading the list each iteration is deliberate: staging a file moves
   * its row into the Staged section, which invalidates earlier locators.
   */
  async stageAllFiles(): Promise<void> {
    // Bounded loop: each pass stages one file, so it cannot exceed the number
    // of files present at the start.
    const initial = await this.getChangedFiles();

    for (let i = 0; i < initial.length; i++) {
      const remaining = await this.getChangedFiles();
      if (remaining.length === 0) break;

      await this.page
        .locator(`${this.selectors.changedFiles}[data-filename="${remaining[0]}"]`)
        .locator(this.selectors.stageButton)
        .click();

      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Unstage a file
   */
  async unstageFile(filename: string): Promise<void> {
    const file = this.page.locator(`${this.selectors.stagedFiles}[data-filename="${filename}"]`);
    await file.hover();
    await file.locator(this.selectors.unstageButton).click();
  }

  /**
   * Enter commit message
   */
  async enterCommitMessage(message: string): Promise<void> {
    await this.page.fill(this.selectors.commitMessage, message);
  }

  /**
   * Commit staged changes
   *
   * Order matters: the message field lives inside the commit dialog, and the
   * dialog is only mounted once the Commit button is clicked. Filling first was
   * a 30s `page.fill` timeout on a locator that could not exist yet.
   *
   * That ordering bug was invisible until staging was implemented: with
   * `toggleStage` stubbed out, nothing was ever staged, so the spec's
   * `if (stagedFiles.length > 0)` guard was false and this method was never
   * called. The test passed without executing its own body.
   *
   * The dialog's own Commit button is reached by role rather than by the
   * `commit-button` test id, which belongs to the panel button that opened it.
   */
  async commit(message: string): Promise<void> {
    await this.page.click(this.selectors.commitButton);
    await this.waitForElement(this.selectors.commitMessage);
    await this.enterCommitMessage(message);

    const dialog = this.page.locator(this.selectors.commitDialog);
    await dialog.getByRole('button', { name: 'Commit', exact: true }).click();

    // The dialog unmounts on success, which is the signal the commit landed.
    await this.page.waitForSelector(this.selectors.commitMessage, {
      state: 'detached',
      timeout: 15000,
    });
  }

  /**
   * Push changes
   */
  async push(): Promise<void> {
    await this.page.click(this.selectors.pushButton);
    await this.page.waitForTimeout(2000); // Wait for push to complete
  }

  /**
   * Pull changes
   */
  async pull(): Promise<void> {
    await this.page.click(this.selectors.pullButton);
    await this.page.waitForTimeout(2000); // Wait for pull to complete
  }

  /**
   * Open branch selector
   */
  async openBranchSelector(): Promise<void> {
    await this.page.click(this.selectors.branchSelector);
    await this.waitForElement(this.selectors.branchList);
  }

  /**
   * Switch to branch
   */
  async switchBranch(branchName: string): Promise<void> {
    await this.openBranchSelector();
    await this.page.click(this.selectors.branchItem(branchName));
    await this.page.waitForTimeout(1000); // Wait for branch switch
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    return this.page.textContent(this.selectors.branchSelector) || '';
  }

  /**
   * View diff for a file
   *
   * Clicks the row's filename button rather than the row itself: the row is a
   * container of buttons, so clicking it can land on a child (stage checkbox,
   * discard) instead of opening the diff.
   */
  async viewDiff(filename: string): Promise<void> {
    const file = this.page.locator(`${this.selectors.changedFiles}[data-filename="${filename}"]`);
    await file.getByRole('button', { name: `View changes in ${filename}` }).click();
    await this.waitForElement(this.selectors.diffViewer, 15000);
  }

  /**
   * Refresh git status
   */
  async refresh(): Promise<void> {
    await this.page.click(this.selectors.refreshButton);
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if repository has changes
   */
  async hasChanges(): Promise<boolean> {
    const count = await this.page.locator(this.selectors.changedFiles).count();
    return count > 0;
  }

  // ==========================================================================
  // Discard — the panel's only destructive action
  // ==========================================================================

  /**
   * Arms a one-shot handler for the next `confirm()` and returns its text.
   *
   * Playwright auto-dismisses dialogs when nothing is listening, so without this
   * every discard would silently be *cancelled* and a test could not tell that
   * apart from a discard that did nothing. Registering the handler before the
   * click is therefore mandatory, not defensive.
   *
   * The promise resolves with the message so a test can assert on the exact
   * wording — the wording is the safety feature here: it has to say whether the
   * file is about to be restored or deleted.
   */
  armConfirm(accept: boolean): Promise<string> {
    return new Promise<string>((resolve) => {
      this.page.once('dialog', async (dialog) => {
        const message = dialog.message();
        if (accept) {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
        resolve(message);
      });
    });
  }

  /** Clicks "Discard changes" on a tracked file's row. */
  async clickDiscard(filename: string): Promise<void> {
    const file = this.page.locator(`${this.selectors.changedFiles}[data-filename="${filename}"]`);
    await file.hover();
    await file.locator(this.selectors.discardButton).click();
  }

  /** Clicks "Delete" on an untracked file's row. */
  async clickDelete(filename: string): Promise<void> {
    const file = this.page.locator(`${this.selectors.changedFiles}[data-filename="${filename}"]`);
    await file.hover();
    await file.locator(this.selectors.deleteButton).click();
  }

  async clickDiscardAll(): Promise<void> {
    await this.page.click(this.selectors.discardAllButton);
  }

  /**
   * Which control a row offers. Distinguishing these is the point: a single
   * control labelled "Discard" that sometimes deletes is exactly the confusion
   * that loses files.
   */
  async rowControls(filename: string): Promise<{ discard: number; delete: number }> {
    const file = this.page.locator(`${this.selectors.changedFiles}[data-filename="${filename}"]`);
    return {
      discard: await file.locator(this.selectors.discardButton).count(),
      delete: await file.locator(this.selectors.deleteButton).count(),
    };
  }

  async isDiscardAllEnabled(): Promise<boolean> {
    return this.page.locator(this.selectors.discardAllButton).isEnabled();
  }
}
