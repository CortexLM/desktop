/**
 * Component Isolation Testing
 * Tests individual components in isolation with all possible states
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots', 'components');

// Ensure directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Component test helper
 */
async function testComponent(
  page: Page,
  componentName: string,
  states: Array<{ name: string; setup: () => Promise<void> }>,
  themes: Array<'light' | 'dark'> = ['dark', 'light']
) {
  for (const theme of themes) {
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.waitForTimeout(300);

    for (const state of states) {
      await state.setup();
      await page.waitForTimeout(200);

      const filename = `${componentName}__${theme}__${state.name}.png`;
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, filename)
      });
    }
  }
}

test.describe('Component Isolation Tests', () => {
  
  test('Button Component - All States', async ({ page }) => {
    // Create a test page with buttons
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-y-4">
          <button id="default" class="btn-primary">Default Button</button>
          <button id="hover" class="btn-primary">Hover Button</button>
          <button id="active" class="btn-primary">Active Button</button>
          <button id="disabled" class="btn-primary" disabled>Disabled Button</button>
          <button id="loading" class="btn-primary">
            <span class="spinner"></span> Loading...
          </button>
          <button class="btn-secondary">Secondary</button>
          <button class="btn-ghost">Ghost</button>
          <button class="btn-danger">Danger</button>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'button', [
      { name: 'default', setup: async () => {} },
      { name: 'hover', setup: async () => { await page.hover('#hover'); } },
      { name: 'active', setup: async () => { await page.click('#active', { force: true }); } },
      { name: 'disabled', setup: async () => {} },
      { name: 'loading', setup: async () => {} }
    ]);
  });

  test('Input Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-y-4 max-w-md">
          <input id="empty" type="text" placeholder="Empty input" class="input" />
          <input id="filled" type="text" value="Filled input" class="input" />
          <input id="focused" type="text" placeholder="Focused input" class="input" />
          <input id="error" type="text" placeholder="Error input" class="input error" />
          <input id="disabled" type="text" placeholder="Disabled" class="input" disabled />
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'input', [
      { name: 'empty', setup: async () => {} },
      { name: 'filled', setup: async () => {} },
      { name: 'focused', setup: async () => { await page.focus('#focused'); } },
      { name: 'error', setup: async () => {} },
      { name: 'disabled', setup: async () => {} }
    ]);
  });

  test('Dialog Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="dialog-overlay">
          <div class="dialog">
            <div class="dialog-header">
              <h2>Dialog Title</h2>
              <button class="close-btn">×</button>
            </div>
            <div class="dialog-content">
              <p>Dialog content goes here...</p>
            </div>
            <div class="dialog-footer">
              <button class="btn-secondary">Cancel</button>
              <button class="btn-primary">Confirm</button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'dialog', [
      { name: 'open', setup: async () => {} },
      { name: 'small', setup: async () => {} },
      { name: 'large', setup: async () => {} }
    ]);
  });

  test('Select Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-y-4 max-w-md">
          <select id="closed" class="select">
            <option>Option 1</option>
            <option>Option 2</option>
            <option>Option 3</option>
          </select>
          <select id="open" class="select" size="3">
            <option>Option 1</option>
            <option>Option 2</option>
            <option selected>Option 3</option>
          </select>
          <select id="disabled" class="select" disabled>
            <option>Disabled</option>
          </select>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'select', [
      { name: 'closed', setup: async () => {} },
      { name: 'open', setup: async () => { await page.click('#open'); } },
      { name: 'disabled', setup: async () => {} }
    ]);
  });

  test('Tabs Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="tabs">
          <button class="tab active">Tab 1</button>
          <button class="tab">Tab 2</button>
          <button class="tab">Tab 3</button>
          <button class="tab" disabled>Disabled</button>
        </div>
        <div class="tab-content">
          Active tab content
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'tabs', [
      { name: 'default', setup: async () => {} },
      { name: 'second-active', setup: async () => {} }
    ]);
  });

  test('Progress Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-y-4 max-w-md">
          <div class="progress"><div class="progress-bar" style="width: 0%"></div></div>
          <div class="progress"><div class="progress-bar" style="width: 25%"></div></div>
          <div class="progress"><div class="progress-bar" style="width: 50%"></div></div>
          <div class="progress"><div class="progress-bar" style="width: 75%"></div></div>
          <div class="progress"><div class="progress-bar" style="width: 100%"></div></div>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'progress', [
      { name: '0-percent', setup: async () => {} },
      { name: '50-percent', setup: async () => {} },
      { name: '100-percent', setup: async () => {} }
    ]);
  });

  test('Spinner Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-y-4">
          <div class="spinner small"></div>
          <div class="spinner medium"></div>
          <div class="spinner large"></div>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'spinner', [
      { name: 'small', setup: async () => {} },
      { name: 'medium', setup: async () => {} },
      { name: 'large', setup: async () => {} }
    ]);
  });

  test('Tooltip Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="p-20 text-center">
          <button id="btn" class="btn-primary">Hover me</button>
          <div class="tooltip visible" style="position: absolute; top: 100px; left: 200px;">
            This is a tooltip
          </div>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'tooltip', [
      { name: 'visible', setup: async () => { await page.hover('#btn'); } }
    ]);
  });

  test('Badge Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-x-2">
          <span class="badge">Default</span>
          <span class="badge badge-success">Success</span>
          <span class="badge badge-warning">Warning</span>
          <span class="badge badge-error">Error</span>
          <span class="badge badge-info">Info</span>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'badge', [
      { name: 'all-variants', setup: async () => {} }
    ]);
  });

  test('Avatar Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-x-4 flex items-center">
          <div class="avatar small">AB</div>
          <div class="avatar medium">CD</div>
          <div class="avatar large">EF</div>
          <div class="avatar">
            <img src="https://via.placeholder.com/40" alt="User" />
          </div>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'avatar', [
      { name: 'all-sizes', setup: async () => {} }
    ]);
  });

  test('Accordion Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="accordion">
          <div class="accordion-item open">
            <div class="accordion-header">Section 1 (Open)</div>
            <div class="accordion-content">Content for section 1</div>
          </div>
          <div class="accordion-item">
            <div class="accordion-header">Section 2 (Closed)</div>
            <div class="accordion-content">Content for section 2</div>
          </div>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'accordion', [
      { name: 'mixed-states', setup: async () => {} }
    ]);
  });

  test('Checkbox Component - All States', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="dark">
      <head>
        <link rel="stylesheet" href="http://localhost:5173/src/styles/index.css">
      </head>
      <body class="p-8 bg-background">
        <div class="space-y-2">
          <label class="checkbox-label">
            <input type="checkbox" class="checkbox" />
            Unchecked
          </label>
          <label class="checkbox-label">
            <input type="checkbox" class="checkbox" checked />
            Checked
          </label>
          <label class="checkbox-label">
            <input type="checkbox" class="checkbox" disabled />
            Disabled
          </label>
          <label class="checkbox-label">
            <input type="checkbox" class="checkbox" checked disabled />
            Checked & Disabled
          </label>
        </div>
      </body>
      </html>
    `);

    await testComponent(page, 'checkbox', [
      { name: 'all-states', setup: async () => {} }
    ]);
  });
});
