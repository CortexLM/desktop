/**
 * Visual Regression Testing Suite for Cortex IDE
 * Captures screenshots of all components in different states and themes
 */

import { test, expect, Page, ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const VIEWPORT_SIZES = {
  desktop: { width: 1400, height: 900 },
  laptop: { width: 1280, height: 720 },
  wide: { width: 1920, height: 1080 }
};

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'packages/main/dist/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_ENABLE_LOGGING: '1'
    }
  });

  // Get the first window
  page = await electronApp.firstWindow();
  await page.setViewportSize(VIEWPORT_SIZES.desktop);
  
  // Wait for app to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000); // Wait for initial render
});

test.afterAll(async () => {
  await electronApp?.close();
});

/**
 * Helper: Capture screenshot with naming convention
 */
async function captureScreenshot(
  screenshotPage: Page,
  name: string,
  options: {
    theme?: 'light' | 'dark';
    state?: string;
    viewport?: keyof typeof VIEWPORT_SIZES;
    fullPage?: boolean;
  } = {}
) {
  const {
    theme = 'dark',
    state = 'default',
    viewport = 'desktop',
    fullPage = false
  } = options;

  const filename = `${name}__${theme}__${state}__${viewport}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await screenshotPage.screenshot({
    path: filepath,
    fullPage
  });

  console.log(`📸 Captured: ${filename}`);
}

/**
 * Helper: Toggle theme
 */
async function setTheme(screenshotPage: Page, theme: 'light' | 'dark') {
  await screenshotPage.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await screenshotPage.waitForTimeout(500); // Wait for theme transition
}

/**
 * Helper: Navigate to view
 */
async function navigateToView(screenshotPage: Page, viewName: string) {
  // Simulate clicking on navigation/tab to switch views
  // This will need to be adapted based on your actual navigation structure
  await screenshotPage.evaluate((view) => {
    // Trigger navigation event or state change
    window.postMessage({ type: 'navigate', view }, '*');
  }, viewName);
  await screenshotPage.waitForTimeout(1000);
}

test.describe('Visual Regression Tests', () => {
  
  test.describe('1. Application Shell', () => {
    test('should capture main app layout - dark theme', async () => {
      await setTheme(page, 'dark');
      await captureScreenshot(page, 'app-shell', { theme: 'dark', fullPage: true });
    });

    test('should capture main app layout - light theme', async () => {
      await setTheme(page, 'light');
      await captureScreenshot(page, 'app-shell', { theme: 'light', fullPage: true });
    });

    test('should capture window controls and title bar', async () => {
      await setTheme(page, 'dark');
      const header = page.locator('header, [class*="title"], [class*="header"]').first();
      if (await header.count() > 0) {
        await header.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'window-titlebar__dark__default__desktop.png')
        });
      }
    });
  });

  test.describe('2. Git Panel Views', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Git Panel - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        // Default state
        await captureScreenshot(page, 'git-panel', { theme, state: 'default' });

        // Try to capture different states
        const gitPanel = page.locator('[class*="git"], [data-testid="git-panel"]').first();
        
        if (await gitPanel.isVisible()) {
          // Changes state
          await captureScreenshot(page, 'git-panel', { theme, state: 'with-changes' });
          
          // Commit dialog
          const commitBtn = page.locator('button:has-text("Commit"), button:has-text("Valider")');
          if (await commitBtn.count() > 0) {
            await commitBtn.first().click();
            await page.waitForTimeout(500);
            await captureScreenshot(page, 'git-commit-dialog', { theme, state: 'open' });
          }
        }
      });
    }
  });

  test.describe('3. Editor View', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Editor - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        // Navigate to editor if needed
        // await navigateToView(page, 'editor');
        
        await captureScreenshot(page, 'editor-view', { theme, state: 'default', fullPage: true });
        
        // With file open
        await captureScreenshot(page, 'editor-view', { theme, state: 'file-open', fullPage: true });
        
        // With autocomplete
        const editor = page.locator('[class*="editor"], [class*="monaco"]').first();
        if (await editor.count() > 0) {
          await editor.click();
          await page.keyboard.type('cons');
          await page.waitForTimeout(500);
          await captureScreenshot(page, 'editor-autocomplete', { theme, state: 'open' });
        }
      });
    }
  });

  test.describe('4. Terminal Views', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Terminal - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'terminal-view', { theme, state: 'default' });
        await captureScreenshot(page, 'terminal-view', { theme, state: 'with-output' });
        
        // Terminal grid
        await captureScreenshot(page, 'terminal-grid', { theme, state: 'single' });
        await captureScreenshot(page, 'terminal-grid', { theme, state: 'split' });
      });
    }
  });

  test.describe('5. AI Chat View', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture AI Chat - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        // Empty state
        await captureScreenshot(page, 'ai-chat', { theme, state: 'empty' });
        
        // With messages
        await captureScreenshot(page, 'ai-chat', { theme, state: 'with-messages' });
        
        // Loading state
        await captureScreenshot(page, 'ai-chat', { theme, state: 'loading' });
        
        // Error state
        await captureScreenshot(page, 'ai-chat', { theme, state: 'error' });
        
        // Model selector
        const modelSelector = page.locator('[data-testid="model-selector"], [class*="model"]');
        if (await modelSelector.count() > 0) {
          await modelSelector.first().click();
          await page.waitForTimeout(300);
          await captureScreenshot(page, 'ai-model-selector', { theme, state: 'open' });
        }
      });
    }
  });

  // Section '6. Background Agents' retirée (août 2026).
  //
  // Elle capturait 'background-agents-list', 'background-agents-detail',
  // 'resource-monitor' et 'queue-viewer' — quatre composants supprimés du
  // dépôt, parce que le backend qu'ils affichaient avait lui-même été supprimé
  // par l'audit d'architecture (voir DIFFERENTIATION.md §2).
  //
  // Ces captures ne prouvaient de toute façon rien : aucun `navigateToView`
  // n'était appelé avant, donc les quatre screenshots étaient la même image de
  // la vue par défaut, enregistrée sous quatre noms différents. Aucun de ces
  // composants n'était accessible dans l'application.

  test.describe('7. Automations', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Automations - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'automation-list', { theme, state: 'empty' });
        await captureScreenshot(page, 'automation-list', { theme, state: 'with-items' });
        await captureScreenshot(page, 'automation-editor', { theme, state: 'new' });
        await captureScreenshot(page, 'automation-editor', { theme, state: 'editing' });
        await captureScreenshot(page, 'automation-logs', { theme, state: 'default' });
      });
    }
  });

  test.describe('8. Extensions & MCP', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Extensions - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'mcp-marketplace', { theme, state: 'default' });
        await captureScreenshot(page, 'mcp-extensions', { theme, state: 'installed' });
        await captureScreenshot(page, 'mcp-config', { theme, state: 'editing' });
        await captureScreenshot(page, 'mcp-tools-view', { theme, state: 'default' });
      });
    }
  });

  test.describe('9. Account & Settings', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Account views - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'billing-view', { theme, state: 'default' });
        await captureScreenshot(page, 'team-view', { theme, state: 'default' });
        await captureScreenshot(page, 'usage-tracking', { theme, state: 'default' });
      });
    }
  });

  test.describe('10. Debug Panel', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Debug Panel - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        // Open debug panel (Ctrl+Shift+D)
        await page.keyboard.press('Control+Shift+D');
        await page.waitForTimeout(500);
        
        await captureScreenshot(page, 'debug-panel', { theme, state: 'open' });
        await captureScreenshot(page, 'debug-console', { theme, state: 'default' });
        await captureScreenshot(page, 'debug-memory', { theme, state: 'default' });
        await captureScreenshot(page, 'debug-performance', { theme, state: 'default' });
        await captureScreenshot(page, 'debug-ipc', { theme, state: 'default' });
        await captureScreenshot(page, 'debug-settings', { theme, state: 'default' });
      });
    }
  });

  test.describe('11. UI Components Library', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture all UI components - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        // Buttons
        const buttons = page.locator('button').first();
        if (await buttons.count() > 0) {
          await captureScreenshot(page, 'ui-buttons', { theme, state: 'default' });
        }
        
        // Dialogs/Modals
        await captureScreenshot(page, 'ui-dialog', { theme, state: 'closed' });
        
        // Inputs
        await captureScreenshot(page, 'ui-inputs', { theme, state: 'default' });
        
        // Tabs
        await captureScreenshot(page, 'ui-tabs', { theme, state: 'default' });
        
        // Progress bars
        await captureScreenshot(page, 'ui-progress', { theme, state: 'default' });
        
        // Tooltips
        await captureScreenshot(page, 'ui-tooltips', { theme, state: 'default' });
        
        // Selects/Dropdowns
        await captureScreenshot(page, 'ui-select', { theme, state: 'closed' });
        
        // Checkboxes
        await captureScreenshot(page, 'ui-checkboxes', { theme, state: 'default' });
        
        // Spinners
        await captureScreenshot(page, 'ui-spinners', { theme, state: 'default' });
      });
    }
  });

  test.describe('12. Workspace Views', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture Workspace views - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'file-explorer', { theme, state: 'default' });
        await captureScreenshot(page, 'documentation-viewer', { theme, state: 'default' });
        await captureScreenshot(page, 'notes-view', { theme, state: 'empty' });
        await captureScreenshot(page, 'browser-view', { theme, state: 'default' });
        await captureScreenshot(page, 'plans-view', { theme, state: 'default' });
        await captureScreenshot(page, 'diff-viewer', { theme, state: 'default' });
      });
    }
  });

  test.describe('13. Error States', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture error states - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        // Error boundary
        await captureScreenshot(page, 'error-boundary', { theme, state: 'active' });
        
        // Network error
        await captureScreenshot(page, 'error-network', { theme, state: 'offline' });
        
        // Permission error
        await captureScreenshot(page, 'error-permission', { theme, state: 'denied' });
        
        // Generic error
        await captureScreenshot(page, 'error-generic', { theme, state: 'default' });
      });
    }
  });

  test.describe('14. Loading States', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture loading states - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'loading-app', { theme, state: 'initial' });
        await captureScreenshot(page, 'loading-panel', { theme, state: 'default' });
        await captureScreenshot(page, 'loading-skeleton', { theme, state: 'default' });
      });
    }
  });

  test.describe('15. Responsive Tests', () => {
    for (const viewport of Object.keys(VIEWPORT_SIZES) as Array<keyof typeof VIEWPORT_SIZES>) {
      test(`should capture responsive layout - ${viewport}`, async () => {
        await page.setViewportSize(VIEWPORT_SIZES[viewport]);
        await page.waitForTimeout(500);
        
        await setTheme(page, 'dark');
        await captureScreenshot(page, 'responsive-layout', { 
          theme: 'dark', 
          state: 'default',
          viewport,
          fullPage: true 
        });
      });
    }
  });

  test.describe('16. Notifications & Toasts', () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`should capture notifications - ${theme} theme`, async () => {
        await setTheme(page, theme);
        
        await captureScreenshot(page, 'update-notification', { theme, state: 'available' });
        await captureScreenshot(page, 'toast-success', { theme, state: 'visible' });
        await captureScreenshot(page, 'toast-error', { theme, state: 'visible' });
        await captureScreenshot(page, 'toast-info', { theme, state: 'visible' });
      });
    }
  });
});
