import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const repo = process.cwd(), root = '/tmp/opencode/appearance-theme-preview-check';
assert(!fs.existsSync(root)); fs.mkdirSync(root);
const { _electron } = await import(pathToFileURL(path.join(repo, 'node_modules/playwright/index.mjs')).href);
const { expect } = await import(pathToFileURL(path.join(repo, 'node_modules/@playwright/test/index.mjs')).href);
const env = { ...process.env, NODE_ENV: 'test', CORTEX_LOCALE: 'en', CORTEX_CATALOG_URL: 'data:application/json,{}', CORTEX_DATA_DIR: `${root}/engine`, CORTEX_START_HASH: '#/settings?preview&v=appearance&theme=light' };
delete env.CORTEX_RENDERER_URL;
const app = await _electron.launch({ args: [path.join(repo, 'packages/desktop/dist/main.cjs'), `--user-data-dir=${root}/profile`, '--no-sandbox'], env });
const page = await app.firstWindow(), errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const names = { system: 'System', light: 'Light', dark: 'Dark' };
const snapshot = () => page.evaluate(() => ({ selected: document.querySelector('.pg-themes [aria-checked=true]')?.textContent.trim(), tabs: [...document.querySelectorAll('.pg-themes [role=radio]')].map(el => el.tabIndex), theme: document.documentElement.dataset.theme, storage: localStorage.getItem('cortex.theme'), focused: document.activeElement?.textContent.trim() }));
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const cards = page.locator('main .pg-themes'), rail = page.locator('.theme');
  const mainRadio = value => cards.getByRole('radio', { name: names[value], exact: true });
  const railRadio = value => rail.getByRole('radio', { name: names[value], exact: true });
  await expect(mainRadio('light')).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => { window.__appearanceCard = document.querySelector('.pg-theme'); });
  for (const [key, value] of [['ArrowRight', 'dark'], ['ArrowRight', 'system'], ['ArrowDown', 'light'], ['ArrowUp', 'system']]) {
    const checked = cards.getByRole('radio', { checked: true }); await checked.focus(); await checked.press(key);
    await expect(mainRadio(value)).toBeFocused(); await expect(mainRadio(value)).toHaveAttribute('aria-checked', 'true');
    await expect(railRadio(value)).toHaveAttribute('aria-checked', 'true');
    assert.equal(await page.evaluate(() => window.__appearanceCard === document.querySelector('.pg-theme')), true);
    assert.equal((await snapshot()).storage, null);
    checks.push({ action: key, expected: value, ...await snapshot() });
  }
  await railRadio('dark').focus(); await railRadio('dark').press('Space');
  await expect(mainRadio('dark')).toHaveAttribute('aria-checked', 'true');
  assert.deepEqual((await snapshot()).tabs, [-1, -1, 0]);
  await mainRadio('dark').focus(); await mainRadio('dark').press('Tab');
  await expect(page.getByRole('main').getByRole('button', { name: 'English', exact: true })).toBeFocused();
  checks.push({ action: 'external rail then Tab exit', ...await snapshot() });
  await railRadio('system').focus(); await railRadio('system').press('Space');
  for (const scheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await expect(mainRadio('system')).toHaveAttribute('aria-checked', 'true');
    assert.deepEqual((await snapshot()).tabs, [0, -1, -1]); assert.equal((await snapshot()).storage, null);
    checks.push({ action: 'System OS change', scheme, ...await snapshot() });
  }
  await page.reload(); await expect(mainRadio('system')).toHaveAttribute('aria-checked', 'true');
  assert.equal((await snapshot()).storage, null); checks.push({ action: 'preview reload', ...await snapshot() });
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${root}/result.json`, JSON.stringify({ status: 'passed', checks, pageErrors: errors, screenshots: 0, previewOnly: true, scriptSHA256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex') }, null, 2) + '\n');
} finally { await app.close(); }
console.log(JSON.stringify({ status: 'passed', groups: checks.length, screenshots: 0 }));
