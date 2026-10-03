import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fixture, prompt } from './live-recovery-terminal-provider.mjs';

const [outArg, directory, expectedAsar] = process.argv.slice(2);
assert(outArg && /^\/(?:private\/)?tmp\/opencode\/desktop-recovery-[^/]+\/project$/.test(directory ?? '') && /^[a-f0-9]{64}$/i.test(expectedAsar ?? ''),
  'Usage: node native.mjs <fresh-local-output> <isolated-mac-project> <expected-app.asar-sha256>');
const out = path.resolve(outArg);
assert(!fs.existsSync(out), 'Use a fresh output directory');
fs.mkdirSync(out, { recursive: true });
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', 'mac-live', command], { encoding: 'utf8', timeout: 90000 }).trim();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const asar = () => ssh('/usr/bin/shasum -a 256 /Applications/Cortex.app/Contents/Resources/app.asar').split(/\s/)[0];
const provider = endpoint => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 10 http://127.0.0.1:9456/${endpoint}`));
const swift = 'import Foundation; import AppKit; import CoreGraphics; let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]; let rows = all.filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeWindow = () => {
  const rows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`));
  assert.equal(rows.length, 1, 'Exactly one on-screen Cortex window required');
  assert.equal(rows[0].active, true, 'Coordinator must foreground the installed Cortex window');
  assert.equal(ssh(`/bin/ps -p ${Number(rows[0].pid)} -o comm=`), '/Applications/Cortex.app/Contents/MacOS/Cortex', 'Window must belong to installed app');
  return rows[0];
};
const report = { status: 'running', expectedAsar: expectedAsar.toLowerCase(), startedAt: new Date().toISOString(), captures: [], checks: [], pageErrors: [], consoleErrors: [], cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
let page, initialURL, previousTheme, previousProvider, providerChanged = false;
try {
  report.asarBefore = asar();
  assert.equal(report.asarBefore, report.expectedAsar, 'Installed ASAR does not match the supplied artifact');
  report.windowBefore = nativeWindow();
  const health = provider('health');
  assert.equal(health.protocol, fixture.protocol);
  assert.equal(health.platform, 'darwin');
  assert.equal(health.project.replace(/^\/private\/tmp\//, '/tmp/'), directory.replace(/^\/private\/tmp\//, '/tmp/'));
  assert(/^[a-f0-9-]{36}$/.test(health.runID));
  report.provider = health;
  const { chromium } = await import(path.join(process.cwd(), 'node_modules/playwright/index.mjs'));
  const { expect } = await import(path.join(process.cwd(), 'node_modules/@playwright/test/index.mjs'));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444');
  const pages = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('cortex://app/'));
  assert.equal(pages.length, 1, 'Exactly one Cortex renderer target required');
  page = pages[0]; page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.pageErrors.push(error.message.slice(0, 500)));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 500)); });
  initialURL = page.url();
  previousTheme = await page.evaluate(() => localStorage.getItem('cortex.theme'));
  const call = async (url, method = 'GET', body) => {
    const r = await page.evaluate(async ({ url, method, body }) => {
      const response = await window.__bridgeFetch(`cortex://local${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, data: response.status === 204 ? null : await response.json() };
    }, { url, method, body });
    assert(r.status >= 200 && r.status < 300, `${method} ${url}: ${r.status}`);
    return r.data;
  };
  previousProvider = await call('/api/providers/fake');
  await call('/api/providers/fake', 'PATCH', { enabled: true, baseURL: 'http://127.0.0.1:9456/v1' });
  providerChanged = true;
  await page.evaluate(() => localStorage.setItem('cortex.locale', 'fr'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const model = { providerID: 'fake', modelID: 'reasoner' };
  const capture = async (name, theme, marker) => {
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('pre.term')).toHaveCSS('opacity', '1');
    const visible = await page.locator('pre.term').evaluate((pre, text) => {
      const node = pre.firstChild, start = pre.textContent.lastIndexOf(text);
      if (node?.nodeType !== Node.TEXT_NODE || start < 0 || node.textContent.length !== pre.textContent.length) return false;
      const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + text.length);
      const r = range.getBoundingClientRect(), box = pre.getBoundingClientRect();
      return r.width > 0 && r.top >= box.top && r.bottom <= box.bottom && r.left >= box.left && r.right <= box.right && r.top >= 0 && r.bottom <= innerHeight;
    }, marker);
    assert.equal(visible, true, 'Localized annotation must be in the visible terminal viewport');
    const win = nativeWindow();
    assert.equal(win.pid, report.windowBefore.pid, 'Installed process changed during the case');
    const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(30000) });
    assert(response.ok, `Native capture failed: ${response.status}`);
    const png = Buffer.from(await response.arrayBuffer());
    assert(png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Helper must return native PNG');
    const file = `${name}-${theme}.png`;
    fs.writeFileSync(path.join(out, file), png);
    report.captures.push({ file, theme, windowID: win.id, pid: win.pid, bounds: win.bounds, width: png.readUInt32BE(16), height: png.readUInt32BE(20), sha256: digest(png), localizedAnnotationVisible: visible, route: new URL(page.url()).hash });
    save();
  };
  for (const theme of ['light', 'dark']) {
    ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {1024,686}'`);
    const session = await call('/api/sessions', 'POST', { title: `Terminal verification ${theme}`, kind: 'code', directory, model });
    assert.equal(session.directory, directory);
    const check = { theme, sessionID: session.id }; report.checks.push(check); save();
    await page.goto(`cortex://app/index.html#/code-session?id=${session.id}&theme=${theme}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    const messages = () => call(`/api/sessions/${session.id}/messages`);
    const tools = async () => (await messages()).flatMap(m => m.parts.filter(p => p.type === 'tool'));
    const input = page.getByTestId('code-composer-input');
    await input.fill(prompt(health.runID, theme)); await input.press('Enter');
    await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
    const approve = async command => {
      await expect.poll(async () => (await call('/api/permissions')).filter(p => p.sessionID === session.id).map(p => p.pattern), { timeout: 20000 }).toEqual([command]);
      await page.getByTestId('permission-allow-once').click();
    };
    await approve(fixture.exitCommand);
    await expect.poll(async () => (await tools())[0]?.state.status, { timeout: 20000 }).toBe('completed');
    let parts = await tools();
    assert.equal(parts[0].state.output === fixture.exitOutput, true, 'Persisted exit output must remain English');
    assert.deepEqual(parts[0].state.metadata, { exit: 7, outputLength: 0, truncated: 0 });
    check.exitOutputExact = true; check.exitMetadataExact = true;
    await expect(page.locator('pre.term')).toContainText(fixture.exitNotice);
    await page.locator('pre.term').evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
    await capture('terminal-exit', theme, fixture.exitNotice);
    await approve(fixture.largeCommand);
    await expect.poll(async () => (await messages()).at(-1)?.info.time.completed, { timeout: 30000 }).toBeDefined();
    parts = await tools(); assert.equal(parts.length, 2);
    assert.equal(parts[1].state.status, 'completed');
    assert.equal(parts[1].state.output === fixture.largeOutput, true, 'Persisted truncation output must remain English');
    assert.deepEqual(parts[1].state.metadata, { exit: 0, outputLength: 50000, truncated: 24 });
    const expected = `$ exit 7\n\n${fixture.exitNotice}\n\n$ ${fixture.largeCommand}\n${fixture.stdout.slice(0, 50000)}\n${fixture.truncatedNotice}`;
    await expect.poll(async () => await page.locator('pre.term').textContent() === expected).toBe(true);
    check.largeOutputExact = true; check.largeMetadataExact = true; check.lookalikeTextPreserved = expected.includes(fixture.prefix);
    const saved = await messages();
    await page.reload();
    await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
    await expect.poll(async () => await page.locator('pre.term').textContent() === expected).toBe(true);
    assert.equal(JSON.stringify(await messages()) === JSON.stringify(saved), true, 'Reload must preserve persisted messages');
    check.reloadExact = true;
    await page.locator('pre.term').evaluate(el => { el.scrollTop = el.scrollHeight; el.scrollLeft = 0; });
    await capture('terminal-omitted', theme, fixture.truncatedNotice);
    await input.fill(prompt(health.runID, theme, true)); await input.press('Enter');
    await expect(page.getByText('Historique conservé.', { exact: true })).toBeVisible();
    const receipt = provider('receipt'), rows = receipt.requests.filter(r => r.theme === theme);
    assert.equal(receipt.runID, health.runID); assert.deepEqual(receipt.errors, []);
    assert.deepEqual(rows.map(r => r.phase), ['exit', 'large', 'complete', 'replay']);
    assert.equal(rows[2].checks.exitMetadataExact && rows[2].checks.largeMetadataExact && rows[3].checks.plainReplayExact, true);
    check.liveEnvelopeAndReplayExact = true; check.providerRows = rows;
    save();
  }
  report.providerReceipt = provider('receipt');
  report.asarAfter = asar(); assert.equal(report.asarAfter, report.expectedAsar);
  assert.equal(report.captures.length, 4);
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = String(error.message).slice(0, 1200);
} finally {
  if (page) {
    if (providerChanged) try {
      const restored = await page.evaluate(async config => (await window.__bridgeFetch('cortex://local/api/providers/fake', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) })).ok,
        { enabled: previousProvider.enabled, baseURL: previousProvider.baseURL ?? null });
      assert(restored); report.cleanup.providerRestored = true;
    } catch (error) { report.status = 'failed'; report.cleanup.providerError = String(error.message).slice(0, 500); }
    try {
      await page.evaluate(theme => { localStorage.setItem('cortex.locale', 'en'); if (theme === null) localStorage.removeItem('cortex.theme'); else localStorage.setItem('cortex.theme', theme); }, previousTheme);
      await page.goto(initialURL);
      await page.reload();
      await page.waitForFunction(() => document.documentElement.lang === 'en');
      report.cleanup.localeResetToEnglish = true;
    } catch (error) { report.status = 'failed'; report.cleanup.error = String(error.message).slice(0, 500); }
  }
  report.finishedAt = new Date().toISOString();
  report.scope = 'Installed-app IPC and real bash; controlled local inference; native helper captures. ASAR checked on disk before/after; fresh LaunchServices launch/artifact provenance remains coordinator-owned. No legacy migration or full-product acceptance.';
  save();
}
console.log(`Terminal native preparation run: ${report.status}; ${path.join(out, 'manifest.json')}`);
// Exit only this client. Do not invoke Browser.close, BrowserWindow.close, app.quit or stop the shared capture helper.
process.exit(report.status === 'passed' ? 0 : 1);
