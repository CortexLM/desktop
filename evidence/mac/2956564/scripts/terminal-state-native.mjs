// Prepared only. Coordinator owns the future package, Mac lease, execution and pixel review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { protocol, key, prompt, answer, reasoning, steps } from './terminal-state-native-backend.mjs';

const [outArg, root, expectedAsar, revision, membersArg] = process.argv.slice(2);
assert(outArg && path.isAbsolute(outArg) && /^\/(?:private\/)?tmp\/opencode\/desktop-terminal-state-[\w.-]+$/.test(root ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? '') && /^[a-f0-9]{40}$/.test(revision ?? '') && membersArg && path.isAbsolute(membersArg),
  'Usage: node terminal-state-native.mjs <fresh-local-output> <isolated-mac-root> <expected-asar-sha256> <revision> <new-package-members.json>');
const out = path.resolve(outArg), repo = fs.realpathSync(process.cwd()), sha = value => createHash('sha256').update(value).digest('hex');
const diagnostic = error => String(error?.stack ?? error?.message ?? error).replaceAll(key, '[redacted-test-key]').replace(/\bBearer\s+[^\s"'`,]+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s"'<>]+/g, url => /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(url) ? url : '[redacted-network-url]');
assert(!fs.existsSync(out) && out !== repo && !out.startsWith(`${repo}/`)); fs.mkdirSync(out, { recursive: true });
const pins = fs.readFileSync(membersArg); assert.equal(JSON.parse(pins).revision, revision);
const helperHashes = Object.fromEntries(['terminal-state-native.mjs', 'terminal-state-native-backend.mjs', 'launch-terminal-state-native.py', 'cleanup-terminal-state-native.py'].map(name => [name, sha(fs.readFileSync(new URL(name, import.meta.url)))]));
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
const backend = endpoint => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 http://127.0.0.1:9456/${endpoint}`));
const installed = () => {
  const value = JSON.parse(ssh(`/usr/bin/python3 ${quote(`${root}/launch-terminal-state-native.py`)} --inspect ${quote(root)} ${expectedAsar} ${revision}`));
  assert.equal(value.membersSHA256, sha(pins)); assert.equal(value.membersVerified, JSON.parse(pins).members.length);
  assert.equal(value.inspectorSHA256, helperHashes['launch-terminal-state-native.py']); return value;
};
const copy = { missingTitle: 'Page not found', missingBody: 'This link goes nowhere, or the page has moved.', failed: 'Failed', ready: 'Ready', running: 'Running',
  errorTitle: 'The task stopped', errorBody: 'Check the provider in Settings, then ask again.' };
const report = { status: 'running', revision, expectedAsar, membersSHA256: sha(pins), startedAt: new Date().toISOString(), helperHashes,
  invocation: { execPath: process.execPath, nodeVersion: process.version, argv: process.argv.slice(1), cwd: repo },
  expectedCopy: copy, captures: [], checks: [], histories: [], uiAdmissions: [], uiReadbacks: [], badgeObservations: [], stateCalls: [], pageErrors: [], consoleErrors: [], rendererHttp: [], unexpectedDialogs: 0, cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const swift = 'import Foundation; import AppKit; import CoreGraphics; let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]; let rows = all.filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeWindow = () => {
  const rows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`)); assert.equal(rows.length, 1);
  const win = rows[0]; assert(win.active && win.pid === report.installedBefore.pid && win.bounds.Width === 960 && win.bounds.Height === 640);
  if (report.captures.length) assert.equal(win.id, report.captures[0].id); return win;
};
let page, expect, request, call, oldAppearance, initialURL, previousProvider, providerChanged = false, observer, stage = 'identity';
const ownedSessions = new Set(), model = { providerID: 'fake', modelID: 'reasoner' };
try {
  report.installedBefore = installed(); save();
  const health = backend('health'); assert.equal(health.protocol, protocol); assert.equal(health.platform, 'darwin'); assert.equal(health.port, 9456);
  assert.equal(health.root, report.installedBefore.root); assert.equal(health.scriptSHA256, helperHashes['terminal-state-native-backend.mjs']);
  report.backend = health; assert.deepEqual(backend('receipt').requests, []);
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs'))); assert(modules);
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
  ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href)); expect = expect.configure({ timeout: 15000 });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 }), cdp = await browser.newBrowserCDPSession();
  const identity = async () => {
    const mains = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser');
    assert.equal(mains.length, 1); assert.equal(mains[0].id, report.installedBefore.pid);
    const value = installed(); assert.deepEqual(value, report.installedBefore); return value;
  };
  await identity(); const pages = browser.contexts().flatMap(context => context.pages()).filter(p => p.url().startsWith('cortex://app/')); assert.equal(pages.length, 1);
  [page] = pages; page.setDefaultTimeout(15000); initialURL = page.url();
  const watch = target => {
    target.on('pageerror', e => report.pageErrors.push({ diagnostic: diagnostic(e), sha256: sha(e.message) }));
    target.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ diagnostic: diagnostic(message.text()), sha256: sha(message.text()) }); });
    target.on('dialog', async dialog => { report.unexpectedDialogs++; await dialog.dismiss().catch(() => { report.unexpectedDialogs++; }); });
  };
  for (const context of browser.contexts()) { context.pages().forEach(watch); context.on('page', watch); context.on('request', req => { if (/^https?:/.test(req.url())) report.rendererHttp.push(sha(req.url())); }); }
  request = async (route, method = 'GET', body) => {
    const response = await page.evaluate(async ({ route, method, body }) => {
      const r = await window.cortex.request({ url: `cortex://local${route}`, method, headers: body === undefined ? [] : [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, body: r.body ? JSON.parse(r.body) : null };
    }, { route, method, body }); report.stateCalls.push({ route, method, status: response.status, ...(response.body?.error?.code ? { code: response.body.error.code } : {}) }); return response;
  };
  call = async (...args) => { const r = await request(...args); assert(r.status >= 200 && r.status < 300, 'Real engine request refused'); return r.body; };
  await page.waitForFunction(() => window.cortex?.platform === 'darwin'); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  assert.deepEqual(await call('/api/connection'), { mode: 'local', signedIn: false });
  for (const route of ['/api/sessions', '/api/bots', '/api/tasks', '/api/providers', '/api/plugins', '/api/permissions']) assert.deepEqual(await call(route), [], 'Fresh isolated local engine required');
  previousProvider = await call('/api/providers/fake'); assert.equal(previousProvider.hasKey, false); assert.equal(previousProvider.baseURL, undefined);
  assert.deepEqual((await call('/api/catalog/providers')).map(p => p.id), ['fake']);
  providerChanged = true; await call('/api/providers/fake', 'PATCH', { enabled: true, baseURL: 'http://127.0.0.1:9456/v1' });
  const saved = await call('/api/providers/fake/key', 'PUT', { key }); assert.equal(saved.hasKey, true); assert(!Object.hasOwn(saved, 'key'));
  // Passive parser observation: return every real IPC-backed Response.json result unchanged.
  // No bridge/main handler, request body, timing, status or response is replaced.
  await page.addInitScript(() => {
    const read = Response.prototype.json, records = []; window.__terminalStateReadbacks = records;
    Response.prototype.json = async function () {
      const value = await read.call(this);
      if (this.status === 202 && typeof value?.messageID === 'string') records.push({ status: this.status, messageID: value.messageID });
      if (this.status === 404 && value?.error?.code === 'not_found') records.push({ status: this.status, code: value.error.code });
      return value;
    };
  });
  await page.reload(); oldAppearance = appearance(); assert(['true', 'false'].includes(oldAppearance));
  const readbacks = () => page.evaluate(() => window.__terminalStateReadbacks.splice(0));
  const settle = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.fonts.status === 'loaded' && document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished'));
  };
  const visibleGeometry = async locator => {
    await expect(locator).toBeVisible();
    return locator.evaluate(el => {
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight, opacity = 1;
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node), b = node.getBoundingClientRect(); opacity *= s.visibility === 'visible' && s.display !== 'none' ? Number(s.opacity) : 0;
        if (/^(auto|scroll|hidden|clip)$/.test(s.overflowX)) { left = Math.max(left, b.left + node.clientLeft); right = Math.min(right, b.left + node.clientLeft + node.clientWidth); }
        if (/^(auto|scroll|hidden|clip)$/.test(s.overflowY)) { top = Math.max(top, b.top + node.clientTop); bottom = Math.min(bottom, b.top + node.clientTop + node.clientHeight); }
      }
      const inside = b => b.width > 0 && b.height > 0 && b.left >= left - .5 && b.top >= top - .5 && b.right <= right + .5 && b.bottom <= bottom + .5;
      const r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
      const ink = [...range.getClientRects()].filter(b => b.width && b.height);
      return { text: el.textContent, opacity, bounds: [r.left, r.top, r.right, r.bottom], ink: ink.map(b => [b.left, b.top, b.right, b.bottom]),
        visible: inside(r) && opacity === 1 && (el instanceof HTMLInputElement || (el instanceof HTMLButtonElement && !!el.getAttribute('aria-label')) || (ink.length > 0 && ink.every(inside))), hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    });
  };
  const capture = async (name, theme, inputTestId, visuals) => {
    const composer = page.getByTestId(inputTestId); await composer.click(); await expect(composer).toBeFocused(); await expect(composer).toHaveValue(''); await expect(composer).toBeEditable(); await settle();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown');
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    const measure = async () => { const rows = []; for (const locator of [...visuals, composer]) { const row = await visibleGeometry(locator); assert(row.visible); rows.push(row); } assert(rows.at(-1).hit); return rows; };
    const boxes = await measure(); assert.equal(appearance(), String(theme === 'dark')); await identity(); const win = nativeWindow();
    const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) }); assert(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer()); assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
    const pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; assert(pixels[0] >= 960 && pixels[0] / 960 === pixels[1] / 640);
    await measure(); assert.equal(nativeWindow().id, win.id); assert.equal(appearance(), String(theme === 'dark'));
    const file = `${name}-${theme}.png`; fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' }); report.captures.push({ file, theme, pixels, viewport: [960, 640], native: true, ...win, sha256: sha(bytes), boxes }); save();
  };
  const badge = page.locator('.content-top .badge');
  const badgeState = async failed => {
    await expect(badge).toHaveText(failed ? copy.failed : copy.ready); await expect(badge).toHaveClass(failed ? 'badge err' : 'badge ok'); await settle();
    const value = await badge.evaluate(el => {
      const s = getComputedStyle(el), canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = s.color; ctx.fillRect(0, 0, 1, 1);
      return { text: el.textContent, className: el.className, color: s.color, background: s.backgroundColor, rgba: [...ctx.getImageData(0, 0, 1, 1).data] };
    });
    const [r, g, b, a] = value.rgba; assert.equal(a, 255); assert(failed ? r > g && r > b : g > r && g > b); return value;
  };
  const startObserver = async () => {
    assert(!observer); observer = await page.evaluateHandle(() => {
      const p = { samples: [], stop: () => {} }, sample = () => {
        const el = document.querySelector('.content-top .badge'); if (!el) return;
        const row = { text: el.textContent, className: el.className };
        if (JSON.stringify(row) !== JSON.stringify(p.samples.at(-1))) p.samples.push(row);
      };
      const watch = new MutationObserver(sample); watch.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
      sample(); p.stop = () => watch.disconnect(); return p;
    });
  };
  const stopObserver = async (theme, turn) => {
    const samples = await observer.evaluate(p => p.samples); await observer.evaluate(p => p.stop()); await observer.dispose(); observer = undefined;
    report.badgeObservations.push({ theme, turn, samples }); return samples;
  };
  const checkHistory = (rows, id, theme, recovered) => {
    assert.equal(rows.length, recovered ? 4 : 2); assert.equal(new Set(rows.map(m => m.info.id)).size, rows.length);
    const parts = rows.flatMap(m => m.parts); assert.equal(new Set(parts.map(p => p.id)).size, parts.length); assert(parts.every(p => p.type !== 'tool' && p.type !== 'file'));
    assert.deepEqual(rows.map(m => m.info.role), recovered ? ['user', 'assistant', 'user', 'assistant'] : ['user', 'assistant']);
    for (const m of rows) {
      assert.equal(m.info.sessionID, id); assert.equal(m.info.agent, 'build'); assert.deepEqual(m.info.model, model);
      for (const p of m.parts) { assert.equal(p.sessionID, id); assert.equal(p.messageID, m.info.id); }
      if (m.info.role === 'assistant') assert(m.info.time.completed >= m.info.time.created);
    }
    assert.deepEqual(rows[0].parts.map(p => [p.type, p.text]), [['text', prompt(theme, 'fail')]]); assert.equal(rows[0].info.error, undefined);
    assert.equal(rows[1].info.error?.code, 'provider_auth_failed'); assert.equal(rows[1].parts.filter(p => ['text', 'reasoning'].includes(p.type)).length, 0);
    if (recovered) {
      assert.equal(rows[2].info.error, undefined); assert.equal(rows[3].info.error, undefined);
      assert.deepEqual(rows[2].parts.map(p => [p.type, p.text]), [['text', prompt(theme, 'recover')]]);
      assert.deepEqual(rows[3].parts.filter(p => ['reasoning', 'text'].includes(p.type)).map(p => [p.type, p.text]), [['reasoning', reasoning(theme)], ['text', answer(theme)]]);
      assert.deepEqual(rows[3].parts.filter(p => p.type === 'step-finish').map(p => p.reason), ['stop']);
    }
  };
  for (const [themeIndex, theme] of ['light', 'dark'].entries()) {
    stage = `${theme}:missing-chat`;
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    const chat = await call('/api/sessions', 'POST', { title: `Native missing ${theme}`, kind: 'chat', model }); ownedSessions.add(chat.id);
    assert.deepEqual(await call(`/api/sessions/${chat.id}/messages`), []); await call(`/api/sessions/${chat.id}`, 'DELETE'); ownedSessions.delete(chat.id);
    await readbacks(); await page.evaluate(({ id, theme }) => { location.hash = `#/chat?id=${id}&theme=${theme}`; }, { id: chat.id, theme });
    const alert = page.locator('.thread [role=alert]'), newChat = page.locator('.content-top').getByRole('button', { name: 'New chat', exact: true });
    await expect(alert).toHaveCount(1); await expect(alert.locator('b')).toHaveText(copy.missingTitle); await expect(alert.locator('.chat-grow > span')).toHaveText(copy.missingBody);
    await expect(alert.getByRole('button')).toHaveCount(0); assert(!/kept|try again|retry/i.test(await alert.innerText()));
    await expect(page.locator('.thread .msg-user, [data-testid=assistant-text], .chat-reason')).toHaveCount(0);
    for (const route of [`/api/sessions/${chat.id}`, `/api/sessions/${chat.id}/messages`]) { const r = await request(route); assert.equal(r.status, 404); assert.equal(r.body?.error?.code, 'not_found'); }
    const missingReads = await readbacks(); assert(missingReads.length > 0 && missingReads.every(r => r.status === 404 && r.code === 'not_found'));
    report.uiReadbacks.push({ theme, scenario: 'missing-chat', records: missingReads });
    await capture('missing-chat', theme, 'composer-input', [alert.locator('b'), alert.locator('.chat-grow > span'), newChat]);
    assert((await visibleGeometry(newChat)).hit); await newChat.click(); await expect(page).toHaveURL(/#\/home(?:\?|$)/); await expect(page.getByRole('heading', { name: 'What’s on today?', exact: true })).toBeVisible();
    await expect(page.locator('.thread [role=alert]')).toHaveCount(0); const homeInput = page.getByTestId('composer-input'); await expect(homeInput).toHaveValue(''); await expect(homeInput).toBeEditable(); await homeInput.click(); await expect(homeInput).toBeFocused();
    assert(!(await call('/api/sessions')).some(s => s.id === chat.id)); assert.equal(backend('receipt').requests.length, themeIndex * 2);
    report.checks.push({ theme, scenario: 'missing-chat', sessionID: chat.id, emptyDeletedSession: true, exactCopy: true, retryAbsent: true, newChatUIRecovered: true, inferenceRequests: 0 }); save();

    stage = `${theme}:code-fail`;
    const session = await call('/api/sessions', 'POST', { title: `Native Code ${theme}`, kind: 'code', directory: report.installedBefore.root, agent: 'build', model }); ownedSessions.add(session.id);
    assert.equal(session.directory, report.installedBefore.root); assert.equal(session.kind, 'code'); assert.equal(session.agent, 'build'); assert.deepEqual(session.model, model);
    await page.evaluate(({ id, theme }) => { location.hash = `#/code-session?id=${id}&theme=${theme}`; }, { id: session.id, theme });
    await expect(page.locator('.content-top .title')).toHaveText(session.title); await expect(page.getByTestId('model-trigger')).toHaveText('Reasoner Large');
    await page.getByTestId('model-trigger').click(); await expect(page.getByTestId('model-option')).toHaveCount(1); await page.getByTestId('thinking-toggle').getByRole('switch').setChecked(true); await page.keyboard.press('Escape');
    await badgeState(false); const composer = page.getByTestId('code-composer-input'), messages = () => call(`/api/sessions/${session.id}/messages`);
    assert.deepEqual(await messages(), []); await readbacks(); await startObserver();
    await composer.fill(prompt(theme, 'fail')); await page.getByTestId('composer-send').click(); await expect(composer).toHaveValue('');
    await expect.poll(async () => { const m = await messages(); return m.length === 2 && !!m[1].info.time.completed && m[1].info.error?.code === 'provider_auth_failed'; }).toBe(true);
    const failed = await messages(); checkHistory(failed, session.id, theme, false);
    const admissions = await readbacks(); assert.deepEqual(admissions, [{ status: 202, messageID: failed[0].info.id }]); report.uiAdmissions.push({ theme, turn: 'fail', ...admissions[0] });
    const banner = page.locator('.split-l .banner.err.code-banner');
    const failedView = async () => {
      const state = await badgeState(true); await expect(banner).toBeVisible(); await expect(banner.locator(':scope > span')).toHaveText([copy.errorTitle, copy.errorBody]);
      await expect(page.locator('.split-l .msg-user')).toHaveText([prompt(theme, 'fail')]); await expect(page.locator('.split-l .msg-bot')).toHaveCount(0);
      await expect(page.getByTestId('code-stop')).toHaveCount(0); await expect(page.getByTestId('composer-send')).toBeEnabled(); return state;
    };
    await call('/api/health'); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const beforeReload = await failedView(); await stopObserver(theme, 'fail');
    stage = `${theme}:code-failed-reload`; await page.reload(); const afterReload = await failedView(), failedReloaded = await messages();
    assert.deepEqual(failedReloaded, failed); assert.deepEqual(afterReload, beforeReload); assert.equal(backend('receipt').requests.length, themeIndex * 2 + 1);
    await capture('code-failed', theme, 'code-composer-input', [page.locator('.content-top .title'), badge, page.locator('.split-l .msg-user'), ...await banner.locator(':scope > span').all()]);
    report.histories.push({ theme, session, failed, failedReloaded }); report.checks.push({ theme, scenario: 'code-failed', sessionID: session.id, persistedError: 'provider_auth_failed', beforeReload, afterReload, historyExact: true }); save();

    stage = `${theme}:code-recover`; await readbacks(); await startObserver();
    await composer.fill(prompt(theme, 'recover')); await page.getByTestId('composer-send').click(); await expect(composer).toHaveValue('');
    await expect.poll(async () => { const m = await messages(); return m.length === 4 && !!m[3].info.time.completed && !m[3].info.error; }).toBe(true);
    const recovered = await messages(); checkHistory(recovered, session.id, theme, true); assert.deepEqual(recovered.slice(0, 2), failed);
    const recoveredReads = await readbacks(); assert.deepEqual(recoveredReads, [{ status: 202, messageID: recovered[2].info.id }]); report.uiAdmissions.push({ theme, turn: 'recover', ...recoveredReads[0] });
    const ready = await badgeState(false); await expect(banner).toHaveCount(0); await expect(page.getByTestId('code-stop')).toHaveCount(0); await expect(page.getByTestId('composer-send')).toBeEnabled();
    await expect(page.locator('.split-l .msg-user')).toHaveText(['fail', 'recover'].map(t => prompt(theme, t))); await expect(page.locator('.split-l .msg-bot')).toHaveText([answer(theme)]);
    const samples = await stopObserver(theme, 'recover'); assert.deepEqual(samples[0], { text: copy.failed, className: 'badge err' });
    assert(samples.some(s => s.text === copy.running && s.className === 'badge run')); assert.deepEqual(samples.at(-1), { text: copy.ready, className: 'badge ok' });
    assert.deepEqual(await call('/api/permissions'), []); assert.deepEqual((await call(`/api/sessions/${session.id}`)).model, model);
    await capture('code-recovered', theme, 'code-composer-input', [page.locator('.content-top .title'), badge, ...await page.locator('.split-l .msg-user, .split-l .msg-bot').all()]);
    report.histories.at(-1).recovered = recovered; report.checks.push({ theme, scenario: 'code-recovered', sessionID: session.id, failedPrefixUnchanged: true, runningObserved: true, ready, bannerRemoved: true, toolParts: 0 }); save();
    const receipt = backend('receipt'); assert.equal(receipt.runID, health.runID); assert.equal(receipt.counts.errors, 0); assert.deepEqual(receipt.failures, []);
    assert.deepEqual(receipt.requests.map(r => [r.theme, r.turn]), steps.slice(0, (themeIndex + 1) * 2));
    assert(receipt.requests.every(r => r.completed && r.modelExact && r.authorizationExact && r.workingDirectoryExact && r.toolsAbsent));
  }
  report.backendReceipt = backend('receipt'); assert.equal(report.backendReceipt.requests.length, 4); assert.equal(report.backendReceipt.counts.errors, 0);
  assert.deepEqual(report.backendReceipt.requests.map(r => r.httpStatus), [401, 200, 401, 200]);
  assert.equal(report.uiAdmissions.length, 4); assert.equal(report.captures.length, 6); assert.equal(report.checks.length, 6);
  report.installedAfter = await identity(); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, diagnostic: diagnostic(error), sha256: sha(String(error?.message ?? error)) }; }
finally {
  const cleanup = async (name, fn) => { try { await fn(); report.cleanup[name] = true; } catch (error) { report.status = 'failed'; report.cleanup[name] = { diagnostic: diagnostic(error), failureSHA256: sha(String(error?.message ?? error)) }; } };
  if (observer) await cleanup('observerStopped', async () => { try { report.partialBadgeObservation = await observer.evaluate(p => p.samples); } finally { try { await observer.evaluate(p => p.stop()); } finally { await observer.dispose(); } } });
  for (const id of ownedSessions) await cleanup(`ownedSessionRemoved:${id}`, async () => { const r = await request(`/api/sessions/${id}`); if (r.status === 404) return; assert.equal(r.status, 200); await call(`/api/sessions/${id}/abort`, 'POST'); await call(`/api/sessions/${id}`, 'DELETE'); });
  if (report.backend) await cleanup('fixtureReceiptRead', async () => { report.backendReceipt = backend('receipt'); assert.equal(report.backendReceipt.runID, report.backend.runID); assert.equal(report.backendReceipt.counts.errors, 0); });
  if (providerChanged && call) await cleanup('providerRestoredKeyRemoved', async () => {
    await call('/api/providers/fake/key', 'DELETE'); const restored = await call('/api/providers/fake', 'PATCH', { enabled: previousProvider.enabled, baseURL: previousProvider.baseURL ?? null });
    assert.equal(restored.hasKey, false); assert.equal(restored.keyHint, undefined); assert.equal(restored.enabled, previousProvider.enabled); assert.equal(restored.baseURL, previousProvider.baseURL);
  });
  if (oldAppearance !== undefined) await cleanup('appearanceRestored', async () => { ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${oldAppearance}'`); assert.equal(appearance(), oldAppearance); });
  if (page && initialURL) await cleanup('initialRouteRestored', async () => { await page.goto(initialURL); });
  if (report.pageErrors.length || report.consoleErrors.length || report.rendererHttp.length || report.unexpectedDialogs) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.durationMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  report.scope = 'Ordinary installed English local Chat missing-link and Code persisted failure/recovery, both themes. Passive JSON/DOM observations only; no response stubbing, held RPC, injected main handler, tools, remote auth or SDK Chat inference. Future pixel acceptance remains coordinator-owned.'; save();
}
console.log(`Terminal state native: ${report.status}; stage ${stage}; ${path.join(out, 'manifest.json')}`);
process.exit(report.status === 'passed' ? 0 : 1); // CDP client only; coordinator owns app/helper processes.
