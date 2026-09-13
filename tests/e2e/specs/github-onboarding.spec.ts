import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, expect } from '../fixtures';

test('repository onboarding keeps installation separate from the native folder picker', async ({ page, electronApp }) => {
  await page.evaluate(() => { window.location.hash = '#/sign-in/github'; });
  const install = page.getByRole('button', { name: 'Connect GitHub' });
  const open = page.getByRole('button', { name: 'Open a local repository' });
  await expect(install).toBeEnabled();
  await expect(open).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await electronApp.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await open.click();
  await expect(open).toBeEnabled();
  await expect(page).toHaveURL(/#\/sign-in\/github$/);

  await electronApp.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => { throw new Error('test-private-filesystem-path'); };
  });
  await open.click();
  await expect(page.getByRole('alert')).toHaveText('This repository could not be opened. Try choosing the folder again.');
  await expect(page.locator('body')).not.toContainText('test-private-filesystem-path');

  const root = mkdtempSync(join(tmpdir(), 'cortex-onboarding-'));
  const folder = join(root, 'repository with trailing space ');
  mkdirSync(folder);
  try {
    await electronApp.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, folder);
    await open.click();
    await expect(page).toHaveURL(/#\/code$/);
    await expect(page.getByRole('heading', { name: 'Ship features, not lines.' })).toBeVisible();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('GitHub onboarding remains reachable at supported widths and themes', async ({ page }) => {
  await page.evaluate(() => { window.location.hash = '#/sign-in/github'; });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('heading', { name: 'Connect GitHub' })).toBeVisible();
      const button = page.getByRole('button', { name: 'Open a local repository' });
      await expect(button).toBeInViewport();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    }
  }
});
