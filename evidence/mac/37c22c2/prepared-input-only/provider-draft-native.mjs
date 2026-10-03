// Prepared only. Coordinator owns package admission, Mac lease, execution and pixel review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { protocol } from './terminal-state-native-backend.mjs';
const A = 'sk-test-original-1111', B = 'sk-test-replacement-2222';
const [outArg, root, expectedAsar, revision, membersArg] = process.argv.slice(2);
assert(outArg && path.isAbsolute(outArg) && /^\/(?:private\/)?tmp\/opencode\/desktop-terminal-state-provider-draft-[\w.-]+$/.test(root ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? '') && /^[a-f0-9]{40}$/.test(revision ?? '') && membersArg && path.isAbsolute(membersArg), 'Usage: node provider-draft-native.mjs <fresh-output> <fresh-mac-root> <asar-sha256> <revision> <members.json>');
const out = path.resolve(outArg), repo = fs.realpathSync(process.cwd()), sha = value => createHash('sha256').update(value).digest('hex');
const originals = { 'terminal-state-native-backend.mjs': 'd22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d', 'launch-terminal-state-native.py': '4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257', 'cleanup-terminal-state-native.py': 'c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a' };
const helperHashes = Object.fromEntries(['provider-draft-native.mjs', ...Object.keys(originals)].map(name => [name, sha(fs.readFileSync(new URL(name, import.meta.url)))]));
for (const [name, hash] of Object.entries(originals)) assert.equal(helperHashes[name], hash);
const pins = fs.readFileSync(membersArg); assert.equal(JSON.parse(pins).revision, revision);
assert(!fs.existsSync(out) && out !== repo && !out.startsWith(`${repo}/`)); fs.mkdirSync(out, { recursive: true });
const diagnostic = error => String(error?.stack ?? error?.message ?? error).replaceAll(A, '[test-key-A]').replaceAll(B, '[test-key-B]').replace(/\bBearer\s+[^\s"'`,]+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s"'<>]+/g, url => /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(url) ? url : '[redacted-network-url]');
const report = { status: 'running', revision, expectedAsar, membersSHA256: sha(pins), helperHashes, startedAt: new Date().toISOString(), invocation: { execPath: process.execPath, nodeVersion: process.version, argv: process.argv.slice(1), cwd: repo }, captures: [], themes: [], stateCalls: [], pageErrors: [], consoleErrors: [], rendererHttp: [], unexpectedDialogs: 0, cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
const backend = endpoint => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 http://127.0.0.1:9456/${endpoint}`));
const installed = () => { const value = JSON.parse(ssh(`/usr/bin/python3 ${quote(`${root}/launch-terminal-state-native.py`)} --inspect ${quote(root)} ${expectedAsar} ${revision}`)); assert.equal(value.membersSHA256, sha(pins)); assert.equal(value.membersVerified, JSON.parse(pins).members.length); assert.equal(value.inspectorSHA256, originals['launch-terminal-state-native.py']); return value; };
const receipt = () => { const r = backend('receipt'); assert.equal(r.runID, report.backend.runID); assert.equal(r.counts.errors, 0); assert.deepEqual(r.failures, []); assert.deepEqual(r.requests, []); report.backendReceipt = r; return r; };
const swift = 'import Foundation; import AppKit; import CoreGraphics; let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]; let rows = all.filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeWindow = () => { const rows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`)); assert.equal(rows.length, 1); const w = rows[0]; assert(w.active && w.pid === report.installedBefore.pid && w.bounds.Width === 960 && w.bounds.Height === 640); if (report.captures.length) assert.equal(w.id, report.captures[0].id); return w; };
let page, expect, call, oldAppearance, initialURL, previous, changed = false, observe, stage = 'identity';
try {
  report.installedBefore = installed(); report.backend = backend('health');
  assert.equal(report.backend.protocol, protocol); assert.equal(report.backend.platform, 'darwin'); assert.equal(report.backend.port, 9456); assert.equal(report.backend.root, report.installedBefore.root); assert.equal(report.backend.scriptSHA256, originals['terminal-state-native-backend.mjs']); receipt(); save();
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs'))); assert(modules);
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href); ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href)); expect = expect.configure({ timeout: 15000 });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 }), cdp = await browser.newBrowserCDPSession();
  const identity = async () => { const mains = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser'); assert.equal(mains.length, 1); assert.equal(mains[0].id, report.installedBefore.pid); const value = installed(); assert.deepEqual(value, report.installedBefore); return value; };
  await identity(); const pages = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('cortex://app/')); assert.equal(pages.length, 1); [page] = pages; page.setDefaultTimeout(15000); initialURL = page.url(); oldAppearance = appearance(); assert(['true', 'false'].includes(oldAppearance));
  const watch = target => { target.on('pageerror', e => report.pageErrors.push(diagnostic(e))); target.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(diagnostic(m.text())); }); target.on('dialog', async d => { report.unexpectedDialogs++; await d.dismiss().catch(() => {}); }); };
  for (const context of browser.contexts()) { context.pages().forEach(watch); context.on('page', watch); context.on('request', r => { if (/^https?:/.test(r.url())) report.rendererHttp.push(sha(r.url())); }); }
  call = async (route, method = 'GET', body) => {
    const r = await page.evaluate(async ({ route, method, body }) => { const r = await window.cortex.request({ url: `cortex://local${route}`, method, headers: body === undefined ? [] : [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: r.body ? JSON.parse(r.body) : null }; }, { route, method, body });
    report.stateCalls.push({ route, method, status: r.status }); assert.equal(r.status, 200); return r.body;
  };
  await page.waitForFunction(() => window.cortex?.platform === 'darwin'); await expect(page.locator('html')).toHaveAttribute('lang', 'en'); assert.deepEqual(await call('/api/connection'), { mode: 'local', signedIn: false });
  for (const route of ['/api/sessions', '/api/bots', '/api/tasks', '/api/providers', '/api/plugins', '/api/permissions']) assert.deepEqual(await call(route), []);
  previous = await call('/api/providers/fake'); assert.deepEqual(previous, { providerID: 'fake', enabled: true, hasKey: false }); assert.deepEqual((await call('/api/catalog/providers')).map(p => p.id), ['fake']);
  // Passive method metadata at bridgeFetch's existing Request.text; original Promise is returned unchanged.
  // Response.json keeps only sanitized config fields. No request body, bridge or main handler is replaced.
  await page.addInitScript(({ A, B }) => {
    const text = Request.prototype.text, json = Response.prototype.json, state = { requests: [], responses: [] }; window.__providerDraftObservation = state;
    Request.prototype.text = function (...args) { if (!['GET', 'HEAD'].includes(this.method)) state.requests.push({ method: this.method, path: new URL(this.url).pathname }); return text.apply(this, args); };
    Response.prototype.json = async function (...args) {
      const value = await json.apply(this, args);
      if (value?.providerID === 'fake') state.responses.push({ status: this.status, fields: Object.keys(value).sort(), enabled: value.enabled, hasKey: value.hasKey, providerID: 'fake', keyHint: typeof value.keyHint === 'string' && value.keyHint.length === 4 ? value.keyHint : null, keyEchoAbsent: !JSON.stringify(value).includes(A) && !JSON.stringify(value).includes(B) });
      return value;
    };
  }, { A, B });
  observe = () => page.evaluate(() => window.__providerDraftObservation);
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => document.fonts.status === 'loaded' && document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished')); };
  const geometry = async locator => {
    await expect(locator).toBeVisible(); return locator.evaluate(el => {
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight, opacity = 1;
      for (let node = el; node; node = node.parentElement) { const s = getComputedStyle(node), b = node.getBoundingClientRect(); opacity *= s.visibility === 'visible' && s.display !== 'none' ? Number(s.opacity) : 0; if ((node !== el || !(el instanceof HTMLInputElement)) && /^(auto|scroll|hidden|clip)$/.test(s.overflowX)) { left = Math.max(left, b.left + node.clientLeft); right = Math.min(right, b.left + node.clientLeft + node.clientWidth); } if ((node !== el || !(el instanceof HTMLInputElement)) && /^(auto|scroll|hidden|clip)$/.test(s.overflowY)) { top = Math.max(top, b.top + node.clientTop); bottom = Math.min(bottom, b.top + node.clientTop + node.clientHeight); } }
      const inside = b => b.width > 0 && b.height > 0 && b.left >= left - .5 && b.top >= top - .5 && b.right <= right + .5 && b.bottom <= bottom + .5;
      const r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el); const ink = [...range.getClientRects()].filter(b => b.width && b.height), disabled = el.matches(':disabled');
      return { text: el.textContent, opacity, disabled, bounds: [r.left, r.top, r.right, r.bottom], visible: inside(r) && (opacity === 1 || (disabled && opacity > 0)) && (el instanceof HTMLInputElement || el.matches('button[aria-label], [role="switch"][aria-label]') || (ink.length > 0 && ink.every(inside))), hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    });
  };
  for (const theme of ['light', 'dark']) {
    stage = `${theme}:settings`; const row = { theme, checks: [], observation: null }; report.themes.push(row);
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    await page.goto(`cortex://app/index.html#/settings?section=providers&theme=${theme}`); await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.getByTestId('settings-nav-providers')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('provider-row')).toHaveCount(1); await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
    const input = page.getByTestId('provider-key-input'), saveButton = page.getByTestId('provider-key-save'), form = page.locator('form').filter({ has: input }), hint = form.locator('.sub'), enable = page.getByRole('switch', { name: 'Enable', exact: true });
    const enabledRow = page.locator('.pg-panel .li').filter({ has: enable }), expected = { requests: [], responses: [] };
    const observed = async () => { row.observation = await observe(); assert.deepEqual(row.observation, expected); };
    const masked = async value => { await expect(input).toHaveAttribute('type', 'password'); await expect(input).toHaveAttribute('aria-label', 'Cortex test provider API key'); assert(await input.inputValue() === value, 'Expected masked draft state'); const text = await page.locator('body').innerText(); assert(!text.includes(A) && !text.includes(B)); };
    const accepted = async (method, enabled, keyHint) => {
      expected.requests.push({ method, path: `/api/providers/fake${method === 'PUT' ? '/key' : ''}` }); expected.responses.push({ status: 200, fields: ['enabled', 'hasKey', 'keyHint', 'providerID'], enabled, hasKey: true, providerID: 'fake', keyHint, keyEchoAbsent: true });
      await expect.poll(observe).toEqual(expected); await observed(); const stored = await call('/api/providers/fake'); assert.deepEqual(stored, { providerID: 'fake', enabled, hasKey: true, keyHint }); await expect(hint).toHaveText(`Saved · ${keyHint}`); await expect(enable).toBeChecked({ checked: enabled }); return stored;
    };
    const capture = async (name, draft, last4) => {
      await page.locator('main .content-top').hover(); await expect(page.locator('.toast')).toHaveCount(0); await form.scrollIntoViewIfNeeded(); await input.click(); await expect(input).toBeFocused(); await expect(input).toBeEditable(); await masked(draft); await settle();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown'); await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
      const measure = async () => { const rows = []; for (const locator of [form.locator('.ttl'), hint, input, saveButton, enabledRow.locator('.ttl'), enable]) { const b = await geometry(locator); assert(b.visible); rows.push(b); } assert(rows[2].hit && rows[5].hit); return rows; };
      await expect(hint).toHaveText(`Saved · ${last4}`); await expect(enable).toBeChecked(); const boxes = await measure(); assert.equal(appearance(), String(theme === 'dark')); await identity(); const win = nativeWindow();
      const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) }); assert(response.ok); const bytes = Buffer.from(await response.arrayBuffer()); assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
      const pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; assert(pixels[0] >= 960 && pixels[0] / 960 === pixels[1] / 640); await measure(); await masked(draft); assert.equal(nativeWindow().id, win.id); assert.equal(appearance(), String(theme === 'dark')); await observed(); receipt();
      const file = `${name}-${theme}.png`; fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' }); report.captures.push({ file, theme, pixels, viewport: [960, 640], native: true, ...win, sha256: sha(bytes), boxes, keyHint: last4, masked: true, draftPreserved: draft === B, draftEmpty: draft === '' }); save();
    };
    await expect(saveButton).toHaveText('Save'); await masked(''); await expect(hint).toHaveText(theme === 'light' ? 'Stored on this device, never shown again' : 'Saved · 2222'); await observed();
    stage = `${theme}:save-A`; changed = true; await input.fill(A); await saveButton.click(); const a = await accepted('PUT', true, '1111'); await masked(''); await expect(saveButton).toBeDisabled(); row.checks.push({ stage: 'save-A', stored: a, draftEmpty: true }); save();
    await input.fill(B); await masked(B); await observed();
    for (const enabled of [false, true]) {
      stage = `${theme}:${enabled ? 'enable' : 'disable'}`; await enable.click(); const stored = await accepted('PATCH', enabled, '1111'); await masked(B); await expect(saveButton).toBeEnabled(); row.checks.push({ stage: enabled ? 'enable' : 'disable', stored, draftPreserved: true, noExtraPUT: true }); save();
    }
    await capture('draft-preserved', B, '1111');
    stage = `${theme}:save-B`; await saveButton.click(); const b = await accepted('PUT', true, '2222'); await masked(''); await expect(saveButton).toBeDisabled(); row.checks.push({ stage: 'save-B', stored: b, draftEmpty: true }); await capture('replacement-saved', '', '2222');
    await observed(); assert.deepEqual(expected.requests.map(r => r.method), ['PUT', 'PATCH', 'PATCH', 'PUT']); save();
  }
  assert.equal(report.captures.length, 4); assert.equal(report.themes.flatMap(r => r.checks).length, 8); receipt(); report.installedAfter = await identity(); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, diagnostic: diagnostic(error) }; }
finally {
  const cleanup = async (name, fn) => { try { await fn(); report.cleanup[name] = true; } catch (error) { report.status = 'failed'; report.cleanup[name] = { diagnostic: diagnostic(error) }; } };
  if (observe) await cleanup('observationRetained', async () => { report.lastObservation = await observe(); });
  if (changed && call) await cleanup('providerRestoredKeyRemoved', async () => { const removed = await call('/api/providers/fake/key', 'DELETE'); assert.deepEqual(removed, { providerID: 'fake', enabled: removed.enabled, hasKey: false }); const restored = await call('/api/providers/fake', 'PATCH', { enabled: previous.enabled }); assert.deepEqual(restored, previous); assert.deepEqual(await call('/api/providers'), [previous]); report.restoredProvider = restored; });
  if (changed && page) await cleanup('providerDetailReset', async () => { await page.reload(); await page.locator('[data-testid=provider-row][data-provider-id=fake]').click(); await expect(page.getByTestId('provider-key-input')).toHaveValue(''); await expect(page.getByTestId('provider-key-input')).toHaveAttribute('type', 'password'); await expect(page.locator('.systeme-provider-key .sub')).toHaveText('Stored on this device, never shown again'); await expect(page.getByRole('switch', { name: 'Enable', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0); });
  if (call) await cleanup('localEngineEmpty', async () => { for (const route of ['/api/sessions', '/api/bots', '/api/tasks', '/api/permissions']) assert.deepEqual(await call(route), []); assert.deepEqual(await call('/api/connection'), { mode: 'local', signedIn: false }); });
  if (report.backend) await cleanup('zeroInference', async () => { receipt(); });
  if (oldAppearance !== undefined) await cleanup('appearanceRestored', async () => { ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${oldAppearance}'`); assert.equal(appearance(), oldAppearance); });
  if (page && initialURL) await cleanup('initialRouteRestored', async () => { await page.goto(initialURL); });
  if (report.pageErrors.length || report.consoleErrors.length || report.rendererHttp.length || report.unexpectedDialogs) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.durationMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt); report.scope = 'Installed English Settings, both themes, ordinary sequential provider toggles and explicit key saves. Passive method/config observation; no held IPC, main-handler replacement or inference. Prepared source requires independent review and future native pixel acceptance.'; save();
}
console.log(`Provider draft native: ${report.status}; stage ${stage}; ${path.join(out, 'manifest.json')}`);
process.exit(report.status === 'passed' ? 0 : 1); // CDP client only; coordinator owns app/helpers/tunnel/lease.
