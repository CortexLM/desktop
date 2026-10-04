// Prepared only. Coordinator owns the future CI artifact, Mac lease, launch and pixel review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { protocol, key, prompt, answer, reasoning, turns } from './live-state-native-backend.mjs';

const [outArg, root, expectedAsar, revision, membersArg] = process.argv.slice(2);
assert(outArg && path.isAbsolute(outArg) && /^\/(?:private\/)?tmp\/opencode\/desktop-live-state-[\w.-]+$/.test(root ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? '') && /^[a-f0-9]{40}$/.test(revision ?? '') && membersArg,
  'Usage: node live-state-native.mjs <fresh-local-output> <isolated-mac-root> <expected-asar-sha256> <revision> <new-package-members.json>');
const out = path.resolve(outArg), repo = fs.realpathSync(process.cwd()), sha = value => createHash('sha256').update(value).digest('hex');
const diagnostic = error => String(error?.stack ?? error?.message ?? error).replaceAll(key, '[redacted-test-key]').replace(/\bBearer\s+[^\s"'`,]+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s"'<>]+/g, url => /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(url) ? url : '[redacted-network-url]');
assert(!fs.existsSync(out) && out !== repo && !out.startsWith(`${repo}/`)); fs.mkdirSync(out, { recursive: true });
const pins = fs.readFileSync(membersArg); assert.equal(JSON.parse(pins).revision, revision);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
const backend = endpoint => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 http://127.0.0.1:9456/${endpoint}`));
const installed = () => {
  const value = JSON.parse(ssh(`/usr/bin/python3 ${quote(`${root}/launch-live-state-native.py`)} --inspect ${quote(root)} ${expectedAsar} ${revision}`));
  assert.equal(value.membersSHA256, sha(pins)); assert.equal(value.membersVerified, JSON.parse(pins).members.length);
  assert.equal(value.inspectorSHA256, sha(fs.readFileSync(new URL('./launch-live-state-native.py', import.meta.url)))); return value;
};
const report = { status: 'running', revision, expectedAsar, membersSHA256: sha(pins), startedAt: new Date().toISOString(), scriptSHA256: sha(fs.readFileSync(new URL(import.meta.url))),
  captures: [], checks: [], histories: [], stateCalls: [], pageErrors: [], consoleErrors: [], rendererHttp: [], unexpectedDialogs: 0, cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const swift = 'import Foundation; import AppKit; import CoreGraphics; let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]; let rows = all.filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeWindow = () => {
  const rows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`)); assert.equal(rows.length, 1);
  const win = rows[0]; assert(win.active && win.pid === report.installedBefore.pid && win.bounds.Width === 960 && win.bounds.Height === 640); return win;
};
let page, expect, request, call, oldAppearance, initialURL, previousProvider, providerChanged = false, sessionID, observer, stage = 'identity';
const ownedBots = [], ownedSessions = new Set();
try {
  report.installedBefore = installed(); save();
  const health = backend('health'); assert.equal(health.protocol, protocol); assert.equal(health.platform, 'darwin'); assert.equal(health.port, 9456);
  assert.equal(health.root.replace(/^\/private\/tmp\//, '/tmp/'), root.replace(/^\/private\/tmp\//, '/tmp/'));
  assert.equal(health.scriptSHA256, sha(fs.readFileSync(new URL('./live-state-native-backend.mjs', import.meta.url))));
  report.backend = health; assert.deepEqual(backend('receipt').requests, []);
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs'))); assert(modules);
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
  ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href)); expect = expect.configure({ timeout: 15000 });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 }), cdp = await browser.newBrowserCDPSession();
  const identity = async () => {
    const mains = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser');
    assert.equal(mains.length, 1); assert.equal(mains[0].id, report.installedBefore.pid);
    const value = installed(); assert.equal(value.pid, report.installedBefore.pid); return value;
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
    }, { route, method, body }); report.stateCalls.push({ route, method, status: response.status }); return response;
  };
  call = async (...args) => { const r = await request(...args); assert(r.status >= 200 && r.status < 300, 'Real engine request refused'); return r.body; };
  await page.waitForFunction(() => window.cortex?.platform === 'darwin'); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  assert.deepEqual(await call('/api/connection'), { mode: 'local', signedIn: false });
  for (const route of ['/api/sessions', '/api/bots', '/api/tasks', '/api/providers', '/api/plugins', '/api/permissions']) assert.deepEqual(await call(route), [], 'Fresh isolated local engine required');
  previousProvider = await call('/api/providers/fake'); assert.equal(previousProvider.hasKey, false); assert.equal(previousProvider.baseURL, undefined);
  assert.deepEqual((await call('/api/catalog/providers')).map(p => p.id), ['fake']);
  providerChanged = true; await call('/api/providers/fake', 'PATCH', { enabled: true, baseURL: 'http://127.0.0.1:9456/v1' });
  const saved = await call('/api/providers/fake/key', 'PUT', { key }); assert.equal(saved.hasKey, true); assert(!Object.hasOwn(saved, 'key'));
  await page.reload(); oldAppearance = appearance(); assert(['true', 'false'].includes(oldAppearance));
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
        visible: inside(r) && opacity === 1 && (el instanceof HTMLInputElement || (ink.length > 0 && ink.every(inside))), hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    });
  };
  const capture = async (name, theme, visuals) => {
    const composer = page.getByTestId('composer-input'); await composer.click(); await expect(composer).toBeFocused(); await expect(composer).toHaveValue(''); await expect(composer).toBeEditable(); await settle();
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
  for (const theme of ['light', 'dark']) {
    stage = `${theme}:two-turns`;
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    const session = await call('/api/sessions', 'POST', { title: `Native transcript ${theme}`, kind: 'chat', model: { providerID: 'fake', modelID: 'reasoner' } }); sessionID = session.id; ownedSessions.add(sessionID);
    await page.evaluate(({ id, theme }) => { location.hash = `#/chat?id=${id}&theme=${theme}`; }, { id: sessionID, theme });
    await expect(page.locator('.content-top .title')).toHaveText(session.title);
    const composer = page.getByTestId('composer-input'), models = page.getByTestId('model-trigger'); await expect(models).toHaveText('Reasoner Large');
    await models.click(); await expect(page.getByTestId('model-option')).toHaveCount(1); await page.getByTestId('thinking-toggle').getByRole('switch').setChecked(true); await page.keyboard.press('Escape');
    const messages = () => call(`/api/sessions/${sessionID}/messages`);
    for (const [i, turn] of turns.entries()) {
      await composer.fill(prompt(theme, turn)); await page.getByTestId('composer-send').click();
      await expect(composer).toHaveValue('');
      await expect.poll(async () => { const m = await messages(); return m.length === (i + 1) * 2 && !!m.at(-1)?.info.time.completed && !m.at(-1).info.error; }).toBe(true);
      await expect(page.getByTestId('assistant-text')).toHaveText(turns.slice(0, i + 1).map(t => answer(theme, t)));
      await expect(page.getByTestId('composer-send')).toBeEnabled();
    }
    const snapshot = structuredClone(await messages()); assert.equal(snapshot.length, 4); assert.equal(new Set(snapshot.map(m => m.info.id)).size, 4);
    const parts = snapshot.flatMap(m => m.parts); assert.equal(new Set(parts.map(p => p.id)).size, parts.length);
    assert(snapshot.every(m => m.info.sessionID === sessionID && !m.info.error && m.info.model.providerID === 'fake' && m.info.model.modelID === 'reasoner'));
    for (const [i, turn] of turns.entries()) {
      assert.equal(snapshot[i * 2].info.role, 'user'); assert.equal(snapshot[i * 2 + 1].info.role, 'assistant');
      assert.deepEqual(snapshot[i * 2].parts.map(p => [p.type, p.text]), [['text', prompt(theme, turn)]]);
      assert.deepEqual(snapshot[i * 2 + 1].parts.filter(p => ['text', 'reasoning'].includes(p.type)).map(p => [p.type, p.text]), [['reasoning', reasoning(theme, turn)], ['text', answer(theme, turn)]]);
    }
    const view = async () => {
      await expect(page.locator('.thread .msg-user')).toHaveText(turns.map(t => prompt(theme, t)));
      await expect(page.getByTestId('assistant-text')).toHaveText(turns.map(t => answer(theme, t)));
      const toggles = page.locator('.chat-reason-t'); await expect(toggles).toHaveCount(2);
      for (const [i, toggle] of (await toggles.all()).entries()) {
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        const text = page.getByTestId('reasoning-block').nth(i).locator('.chat-reason-p li');
        await expect(text).toHaveText([reasoning(theme, turns[i])]); await text.scrollIntoViewIfNeeded(); await settle(); assert((await visibleGeometry(text)).visible);
        await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      await settle(); const thread = page.locator('.thread'); await thread.hover(); await page.mouse.wheel(0, -await thread.evaluate(el => el.scrollHeight));
      await expect.poll(() => thread.evaluate(el => el.scrollTop)).toBe(0);
    };
    await view(); await page.reload(); await view(); assert.deepEqual(await messages(), snapshot);
    await page.getByRole('button', { name: 'Home', exact: true }).first().click(); await expect(page).toHaveURL(/#\/home(?:\?|$)/);
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await expect(page.locator('.content-top .title')).toHaveText(session.title); await view(); assert.deepEqual(await messages(), snapshot);
    report.histories.push({ theme, messages: snapshot });
    await capture('transcript', theme, await page.locator('.thread .msg-user, [data-testid=assistant-text], .chat-reason-t').all());
    const receipt = backend('receipt'); assert.equal(receipt.runID, health.runID); assert.equal(receipt.counts.errors, 0);
    const rows = receipt.requests.filter(r => r.scenario === 'chat' && r.theme === theme); assert.deepEqual(rows.map(r => r.turn), turns); assert(rows.every(r => r.completed && r.modelExact && r.authorizationExact));
    assert.deepEqual(rows[1].userTexts, turns.map(t => prompt(theme, t))); assert.deepEqual(rows[1].replayAnswers, [answer(theme, 'older')]);
    stage = `${theme}:delete`;
    observer = await page.evaluateHandle(() => {
      const probe = { cleared: false, revived: false, counts: [], stop: () => {} };
      const sample = () => { const n = document.querySelectorAll('.thread .msg-user, [data-testid=assistant-text], .chat-reason').length; if (probe.cleared && n) probe.revived = true; if (!n) probe.cleared = true; if (probe.counts.at(-1) !== n) probe.counts.push(n); };
      const watcher = new MutationObserver(sample); watcher.observe(document.body, { childList: true, subtree: true, characterData: true }); sample(); probe.stop = () => watcher.disconnect(); return probe;
    });
    await call(`/api/sessions/${sessionID}`, 'DELETE');
    await expect(page.locator('.thread .msg-user, [data-testid=assistant-text], .chat-reason')).toHaveCount(0);
    assert.equal((await request(`/api/sessions/${sessionID}/messages`)).status, 404);
    await settle(); await call('/api/health');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const deletion = await observer.evaluate(p => ({ cleared: p.cleared, revived: p.revived, counts: p.counts })); assert(deletion.cleared && !deletion.revived && deletion.counts[0] === 6 && deletion.counts.at(-1) === 0);
    await observer.evaluate(p => p.stop()); await observer.dispose(); observer = undefined;
    assert(!(await call('/api/sessions')).some(s => s.id === sessionID)); await page.reload();
    await expect(page.locator('.thread [role=alert]')).toHaveCount(1); await expect(page.locator('.thread .msg-user, [data-testid=assistant-text], .chat-reason')).toHaveCount(0);
    assert.equal((await request(`/api/sessions/${sessionID}`)).status, 404); ownedSessions.delete(sessionID); sessionID = undefined;
    await capture('deleted', theme, [page.locator('.thread [role=alert]')]); report.checks.push({ theme, uiTurns: 2, exactHistory: true, reloadEquivalent: true, homeBackEquivalent: true, deletion }); save();
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  }
  for (const theme of ['light', 'dark']) {
    stage = `${theme}:bot-ownership`;
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    const bots = {};
    for (const owner of ['Alpha', 'Beta']) { bots[owner] = await call('/api/bots', 'POST', { name: `Native ${owner} ${theme}`, persona: `Controlled ${owner} ownership check.`, model: { providerID: 'fake', modelID: 'reasoner' } }); ownedBots.push(bots[owner].id); }
    const sessions = owner => call(`/api/bots/${bots[owner].id}/sessions`), history = id => call(`/api/sessions/${id}/messages`);
    const completed = (id, count) => expect.poll(async () => { const rows = await history(id); return rows.length === count && rows.filter(m => m.info.role === 'assistant').every(m => m.info.time.completed !== undefined && !m.info.error); }).toBe(true);
    const checkHistory = (rows, id, owner, expectedTurns) => {
      assert.equal(rows.length, expectedTurns.length * 2); assert.equal(new Set(rows.map(m => m.info.id)).size, rows.length);
      assert(rows.every(m => m.info.sessionID === id && !m.info.error && m.info.model.providerID === 'fake' && m.info.model.modelID === 'reasoner'));
      assert.deepEqual(rows.map(m => m.info.role), expectedTurns.flatMap(() => ['user', 'assistant']));
      for (const [i, turn] of expectedTurns.entries()) { assert.deepEqual(rows[i * 2].parts.map(p => [p.type, p.text]), [['text', prompt(theme, turn, owner)]]); assert.deepEqual(rows[i * 2 + 1].parts.filter(p => ['reasoning', 'text'].includes(p.type)).map(p => [p.type, p.text]), [['reasoning', reasoning(theme, turn, owner)], ['text', answer(theme, turn, owner)]]); }
    };
    assert.deepEqual(await sessions('Alpha'), []);
    await page.evaluate(({ id, theme }) => { location.hash = `#/bot?id=${id}&theme=${theme}`; }, { id: bots.Alpha.id, theme });
    await expect(page.locator('.content-top .title')).toHaveText(bots.Alpha.name);
    await expect(page.locator('.bot-cols .thread-inner')).toHaveCount(0);
    const composer = page.getByTestId('composer-input'); await composer.fill(prompt(theme, 'first', 'Alpha')); await page.getByTestId('composer-send').click();
    await expect.poll(async () => (await sessions('Alpha')).length).toBe(1);
    const alpha = (await sessions('Alpha'))[0]; ownedSessions.add(alpha.id); assert.equal(alpha.botID, bots.Alpha.id); assert.equal(alpha.kind, 'bot'); await completed(alpha.id, 2);
    const alphaBefore = structuredClone(await history(alpha.id)); checkHistory(alphaBefore, alpha.id, 'Alpha', ['first']);
    await expect(page.locator('.bot-cols .thread-inner .msg-user')).toHaveText([prompt(theme, 'first', 'Alpha')]);
    await expect(page.locator('.bot-cols .thread-inner .msg-bot')).toHaveText([answer(theme, 'first', 'Alpha')]);
    const beta = await call(`/api/bots/${bots.Beta.id}/sessions`, 'POST', {}); ownedSessions.add(beta.id); assert.equal(beta.botID, bots.Beta.id); assert.equal(beta.kind, 'bot'); assert.notEqual(alpha.id, beta.id);
    await call(`/api/sessions/${beta.id}/prompt`, 'POST', { parts: [{ type: 'text', text: prompt(theme, 'older', 'Beta') }] }); await completed(beta.id, 2);
    const betaBefore = structuredClone(await history(beta.id)); checkHistory(betaBefore, beta.id, 'Beta', ['older']);
    observer = await page.evaluateHandle(() => {
      const p = { samples: [], stop: () => {} }, sample = () => { const row = { title: document.querySelector('.content-top .title')?.textContent, users: [...document.querySelectorAll('.bot-cols .thread-inner .msg-user')].map(e => e.textContent), answers: [...document.querySelectorAll('.bot-cols .thread-inner .msg-bot')].map(e => e.textContent) }; if (JSON.stringify(row) !== JSON.stringify(p.samples.at(-1))) p.samples.push(row); };
      const watch = new MutationObserver(sample); watch.observe(document.body, { childList: true, subtree: true, characterData: true }); sample(); p.stop = () => watch.disconnect(); return p;
    });
    const documentStart = await page.evaluate(() => performance.timeOrigin);
    await page.locator('button.roster-item').filter({ hasText: bots.Beta.name }).click();
    await expect(page.locator('.content-top .title')).toHaveText(bots.Beta.name); const [route, query] = new URL(page.url()).hash.split('?'); assert.equal(route, '#/bot'); assert.equal(new URLSearchParams(query).get('id'), bots.Beta.id); assert.equal(await page.evaluate(() => performance.timeOrigin), documentStart);
    const users = page.locator('.bot-cols .thread-inner .msg-user'), answers = page.locator('.bot-cols .thread-inner .msg-bot');
    await expect(users).toHaveText([prompt(theme, 'older', 'Beta')]); await expect(answers).toHaveText([answer(theme, 'older', 'Beta')]);
    await composer.fill(prompt(theme, 'newer', 'Beta')); await page.getByTestId('composer-send').click(); await expect(composer).toHaveValue(''); await completed(beta.id, 4);
    const betaAfter = structuredClone(await history(beta.id)); checkHistory(betaAfter, beta.id, 'Beta', turns); assert.deepEqual(betaAfter.slice(0, 2), betaBefore); assert.deepEqual(await history(alpha.id), alphaBefore);
    assert.deepEqual((await sessions('Alpha')).map(s => s.id), [alpha.id]); assert.deepEqual((await sessions('Beta')).map(s => s.id), [beta.id]);
    await expect(users).toHaveText(turns.map(t => prompt(theme, t, 'Beta'))); await expect(answers).toHaveText(turns.map(t => answer(theme, t, 'Beta')));
    const samples = await observer.evaluate(p => p.samples), betaSamples = samples.filter(s => s.title === bots.Beta.name); assert(betaSamples.length > 0 && betaSamples.every(s => !s.users.includes(prompt(theme, 'first', 'Alpha')) && !s.answers.includes(answer(theme, 'first', 'Alpha'))));
    await observer.evaluate(p => p.stop()); await observer.dispose(); observer = undefined;
    report.histories.push({ scenario: 'bot', theme, alpha, beta, alphaBefore, betaBefore, betaAfter, ownerSamples: samples });
    const pane = page.locator('main.content > .page'), lastBox = await answers.last().boundingBox(), paneBox = await pane.boundingBox(); assert(lastBox && paneBox); await pane.hover(); await page.mouse.wheel(0, lastBox.y + lastBox.height - paneBox.y - paneBox.height / 2);
    await expect.poll(async () => { const a = await users.last().boundingBox(), b = await answers.last().boundingBox(), p = await pane.boundingBox(); return !!a && !!b && !!p && a.y >= p.y + 24 && b.y + b.height <= p.y + p.height - 32; }).toBe(true);
    await capture('bot-beta-owner', theme, [page.locator('.content-top .title'), users.last(), answers.last()]);
    const receipt = backend('receipt'); assert.equal(receipt.runID, health.runID); assert.equal(receipt.counts.errors, 0); const rows = receipt.requests.filter(r => r.scenario === 'bot' && r.theme === theme); assert.deepEqual(rows.map(r => [r.owner, r.turn]), [['Alpha', 'first'], ['Beta', 'older'], ['Beta', 'newer']]); assert(rows.every(r => r.completed && r.modelExact && r.authorizationExact));
    report.checks.push({ scenario: 'bot', theme, actualRosterNavigation: true, sameDocument: true, betaOwnedSession: beta.id, alphaHistoryUnchanged: true, capturedScope: 'Beta title, latest user/answer and composer; full history asserted in DOM and engine' }); save();
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  }
  report.backendReceipt = backend('receipt'); assert.equal(report.backendReceipt.requests.length, 10); assert.equal(report.backendReceipt.counts.errors, 0);
  assert.equal(report.captures.length, 6); report.installedAfter = await identity(); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, diagnostic: diagnostic(error), sha256: sha(String(error?.message ?? error)) }; }
finally {
  const cleanup = async (name, fn) => { try { await fn(); report.cleanup[name] = true; } catch (error) { report.status = 'failed'; report.cleanup[name] = { diagnostic: diagnostic(error), failureSHA256: sha(String(error?.message ?? error)) }; } };
  if (observer) await cleanup('observerStopped', async () => { try { report.partialObservation = await observer.evaluate(p => ({ samples: p.samples, counts: p.counts, cleared: p.cleared, revived: p.revived })); } finally { try { await observer.evaluate(p => p.stop()); } finally { await observer.dispose(); } } });
  for (const id of ownedBots) await cleanup(`ownedBotSessionsListed:${id}`, async () => { for (const s of await call(`/api/bots/${id}/sessions`)) ownedSessions.add(s.id); });
  for (const id of ownedSessions) await cleanup(`ownedSessionRemoved:${id}`, async () => { const r = await request(`/api/sessions/${id}`); if (r.status === 404) return; assert.equal(r.status, 200); await call(`/api/sessions/${id}/abort`, 'POST'); await call(`/api/sessions/${id}`, 'DELETE'); });
  for (const id of ownedBots) await cleanup(`ownedBotRemoved:${id}`, async () => { await call(`/api/bots/${id}`, 'DELETE'); });
  if (report.backend) await cleanup('fixtureReceiptRead', async () => { report.backendReceipt = backend('receipt'); assert.equal(report.backendReceipt.runID, report.backend.runID); assert.equal(report.backendReceipt.counts.errors, 0); });
  if (providerChanged && call) await cleanup('providerRestoredKeyRemoved', async () => {
    await call('/api/providers/fake/key', 'DELETE'); const restored = await call('/api/providers/fake', 'PATCH', { enabled: previousProvider.enabled, baseURL: previousProvider.baseURL ?? null });
    assert.equal(restored.hasKey, false); assert.equal(restored.keyHint, undefined); assert.equal(restored.enabled, previousProvider.enabled); assert.equal(restored.baseURL, previousProvider.baseURL);
  });
  if (oldAppearance !== undefined) await cleanup('appearanceRestored', async () => { ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${oldAppearance}'`); assert.equal(appearance(), oldAppearance); });
  if (page && initialURL) await cleanup('initialRouteRestored', async () => { await page.goto(initialURL); });
  if (report.pageErrors.length || report.consoleErrors.length || report.rendererHttp.length || report.unexpectedDialogs) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.scope = 'Ordinary installed local Chat, Bot owner navigation and native chrome, controlled loopback provider. No delayed RPC or injected installed handlers; exact races belong to separate Mac CI tests. Pixel acceptance remains coordinator-owned.'; save();
}
console.log(`Live transcript native: ${report.status}; stage ${stage}; ${path.join(out, 'manifest.json')}`);
process.exit(report.status === 'passed' ? 0 : 1); // Exit this CDP client only; coordinator owns the app/helper PIDs.
