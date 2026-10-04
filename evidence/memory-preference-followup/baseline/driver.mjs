import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { _electron, expect } = await import(pathToFileURL(path.join(process.cwd(), 'node_modules/@playwright/test/index.mjs')));
const out = '/tmp/opencode/memory-switch-baseline-confirm'; assert(!fs.existsSync(out)); fs.mkdirSync(out);
const data = fs.mkdtempSync('/tmp/opencode/memory-switch-baseline-data-');
const app = await _electron.launch({ args: [path.join(process.cwd(), 'packages/desktop/dist/main.cjs'), `--user-data-dir=${data}/renderer`, '--no-sandbox'], env: { ...process.env, CORTEX_DATA_DIR: data, CORTEX_START_HASH: '#/settings?section=privacy&theme=light', CORTEX_CATALOG_URL: 'data:application/json,{}', CORTEX_LOCALE: 'en' } });
const result = { application: 'f82a64800c0fffd6ebaa99e571a8af0fa4307095', expected: 'Privacy off survives navigation and Memory off survives reload', observations: {} };
try {
  const page = await app.firstWindow(); await page.waitForFunction(() => '__bridgeFetch' in window); await page.emulateMedia({ reducedMotion: 'reduce' });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  const privacy = page.locator('[role="switch"][aria-label="Memory"]'); await expect(privacy).toBeChecked(); await privacy.click(); await expect(privacy).not.toBeChecked();
  result.observations.privacyOffSaved = await page.evaluate(() => localStorage.getItem('cortex.pref.privacy.memory'));
  await page.goto('cortex://app/index.html#/memory?theme=light'); const memory = page.getByRole('switch', { name: 'Turn on memory', exact: true }); await expect(memory).toBeVisible();
  result.observations.memoryAfterPrivacyOff = await memory.isChecked(); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${out}/privacy-off-memory-on.png` });
  await memory.click(); await expect(memory).not.toBeChecked(); await page.reload(); await expect(memory).toBeVisible(); result.observations.memoryAfterReload = await memory.isChecked();
  result.status = result.observations.memoryAfterPrivacyOff || result.observations.memoryAfterReload ? 'reproduced' : 'not-reproduced';
  fs.writeFileSync(`${out}/receipt.json`, JSON.stringify(result, null, 2) + '\n');
  assert.equal(result.observations.memoryAfterPrivacyOff, false, 'Privacy pause is ignored by Memory');
  assert.equal(result.observations.memoryAfterReload, false, 'Memory pause resets on reload');
} finally { await app.close(); fs.rmSync(data, { recursive: true, force: true }); }
