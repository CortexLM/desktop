import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(`${process.cwd()}/node_modules/playwright/index.mjs`).href);
const { expect } = await import(pathToFileURL(`${process.cwd()}/node_modules/@playwright/test/index.mjs`).href);
const ssh = cmd => execFileSync('ssh', ['-o', 'BatchMode=yes', 'mac-live', cmd], { encoding: 'utf8', timeout: 30000 }).trim();
const appearance = () => ssh('/usr/bin/osascript -e \'tell application "System Events" to tell appearance preferences to get dark mode\'');
const setAppearance = dark => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${dark}'`);
const browser = await chromium.connectOverCDP('http://127.0.0.1:19444');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('cortex://app/')); assert(page);
const original = appearance(), url = page.url(), stored = await page.evaluate(() => localStorage.getItem('cortex.theme'));
const state = () => page.evaluate(() => ({ dark: matchMedia('(prefers-color-scheme: dark)').matches, theme: document.documentElement.dataset.theme, selected: document.querySelector('.pg-themes [aria-checked=true]')?.textContent.trim() }));
const report = { scope: 'One diagnostic: CDP default media override versus actual OS source; zero captures', checks: [] };
try {
  await page.goto('cortex://app/index.html#/settings?section=appearance&theme=system'); await page.reload();
  setAppearance(true); assert.equal(appearance(), 'true');
  report.beforeClearingOverride = await state();
  await page.emulateMedia({ colorScheme: null, reducedMotion: null, forcedColors: null, contrast: null });
  for (const dark of [true, false, true]) {
    setAppearance(dark); assert.equal(appearance(), String(dark));
    await expect.poll(state).toEqual({ dark, theme: dark ? 'dark' : 'light', selected: 'System' });
    report.checks.push({ osDark: dark, ...await state() });
  }
  report.status = 'passed';
} finally {
  setAppearance(original === 'true');
  await page.goto(url); await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem('cortex.theme')), stored);
  report.restoredAppearance = appearance();
  fs.writeFileSync('/tmp/opencode/appearance-native-media-check.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
process.exit(0);
