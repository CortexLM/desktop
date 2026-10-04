import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(path.join(process.cwd(), 'node_modules/playwright/index.mjs'));

const [stage, out] = process.argv.slice(2);
assert(['save', 'reopen'].includes(stage));
const browser = await chromium.connectOverCDP('http://127.0.0.1:19444');
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('cortex://app/'));
assert(page);
await page.waitForFunction(() => '__bridgeFetch' in window);
const call = (url, method = 'GET', body) => page.evaluate(async ({ url, method, body }) => {
  const r = await window.__bridgeFetch('cortex://local' + url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error('Packaged request failed: ' + r.status);
  return r.status === 204 ? null : r.json();
}, { url, method, body });
const expected = { name: 'private', type: 'remote', enabled: false, status: 'disabled', tools: [] };
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const key = 'sk-test-native-mcp-5678';
const theme = stage === 'save' ? 'light' : 'dark';
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', 'mac-live', command], { encoding: 'utf8' }).trim();
ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960, 640}'`);
await page.goto(`cortex://app/index.html#/settings?section=providers&theme=${theme}`);
await page.waitForFunction(() => innerWidth === 960 && innerHeight === 640);
await page.emulateMedia({ reducedMotion: 'reduce' });
if (process.env.CORTEX_NATIVE_HIDE_SIDEBAR === '1' && await page.locator('.window').getAttribute('data-sidebar') === 'shown') {
  await page.getByRole('button', { name: 'Hide sidebar', exact: true }).click();
}
await page.getByTestId('provider-search').fill('fake');
await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
if (stage === 'save') {
  await page.getByTestId('provider-key-input').fill(key);
  await page.getByTestId('provider-key-save').click();
  await page.getByText('Saved · 5678', { exact: true }).waitFor();
  assert.deepEqual(await call('/api/mcp', 'POST', { name: 'private', type: 'remote', url: 'http://127.0.0.1:9456/private-path', headers: { Authorization: 'private-header-value' }, enabled: false }), expected);
  assert.deepEqual(await call('/api/mcp'), [expected]);
} else {
  assert.deepEqual(await call('/api/mcp'), [expected]);
  assert.deepEqual(await call('/api/mcp/private', 'PATCH', { enabled: true }), {
    ...expected, enabled: true, status: 'connected', tools: [{ name: 'ping', description: 'Connection check' }],
  });
  await call('/api/mcp/private', 'DELETE');
  assert.deepEqual(await call('/api/mcp'), []);
}
const provider = await call('/api/providers/fake');
assert.equal(provider.hasKey, true);
assert.equal(provider.keyHint, '5678');
assert(!JSON.stringify(provider).includes(key));
await page.getByText('Saved · 5678', { exact: true }).waitFor();
assert.equal(await page.getByTestId('provider-key-input').inputValue(), '');
assert(!(await page.content()).includes(key));
assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
await page.getByTestId('provider-key-input').click({ trial: true });
await page.evaluate(() => document.fonts.ready);
fs.mkdirSync(out, { recursive: true });
assert.deepEqual(errors, []);
const wid = ssh(`swift -e 'import CoreGraphics; for w in CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]] where w["kCGWindowOwnerName"] as? String == "Cortex" && w["kCGWindowLayer"] as? Int == 0 { print(w["kCGWindowNumber"] as! Int); break }' 2>/dev/null`);
assert(/^\d+$/.test(wid));
const captured = await fetch(`http://127.0.0.1:19445/${wid}`, { method: 'POST' });
assert(captured.ok);
fs.writeFileSync(path.join(out, `${stage}-${theme}.png`), Buffer.from(await captured.arrayBuffer()));
fs.writeFileSync(path.join(out, stage + '.json'), JSON.stringify({ stage, theme, width: 960, height: 640, sidebar: await page.locator('.window').getAttribute('data-sidebar'), nativeWindowID: Number(wid), sanitizedMetadata: true, listMatched: true, decryptedConnectionSucceeded: stage === 'reopen', removed: stage === 'reopen', providerKeyRedacted: true, providerHint: provider.keyHint, providerInputEmpty: true, errorsSinceAttach: errors }, null, 2) + '\n');
await browser.close();
console.log('Packaged MCP ' + stage + ' assertions passed');
