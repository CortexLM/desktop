// Preparation only. Coordinator owns lease, installed artifact, GUI launch, fixture and helper lifecycle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [outArg, macDirectory, expectedAsar, expectedRevision, ...extra] = process.argv.slice(2);
assert(!extra.length && path.isAbsolute(outArg ?? '') && /^\/(?:private\/)?tmp\/opencode\/desktop-remote-auth-[a-zA-Z0-9._-]+$/.test(macDirectory ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? '') && (expectedRevision === undefined || /^[a-f0-9]{40}$/.test(expectedRevision)),
  'Usage: node native-auth-locales-final.mjs <fresh-absolute-local-output> <isolated-mac-run-directory> <app.asar-sha256> [artifact-source-revision]');
const repo = fs.realpathSync(process.cwd()), frozen = fs.realpathSync('/tmp/opencode/build-remote-final'), out = path.join(fs.realpathSync(path.dirname(outArg)), path.basename(outArg));
assert(out !== repo && !out.startsWith(`${repo}/`) && out !== frozen && !out.startsWith(`${frozen}/`)); fs.mkdirSync(out);
const sha = value => createHash('sha256').update(value).digest('hex'), readJSON = file => JSON.parse(fs.readFileSync(file));
const quote = value => `'${value.replaceAll("'", "'\\''")}'`, canonical = value => value.replace(/^\/private\/tmp\//, '/tmp/');
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const backend = (endpoint, body) => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 ${body === undefined ? '' : "--request POST --header 'content-type: application/json' --data-binary @- "}http://127.0.0.1:9457/${endpoint}`, body === undefined ? undefined : JSON.stringify(body)));
const origin = 'http://127.0.0.1:9457', locales = ['en', 'fr', 'es', 'de', 'ja', 'zh-Hans', 'pt-BR', 'ko'], signedOut = { status: 'signed_out', signedIn: false };
const report = { status: 'running', startedAt: new Date().toISOString(), expectedAsar, expectedRevision: expectedRevision ?? null, revisionBinding: 'Coordinator-provided artifact/source receipt; not inferred from app metadata', scriptSHA256: sha(fs.readFileSync(new URL(import.meta.url))), views: [], captures: [], errors: [], rendererHttp: [], dialogs: 0, cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const boundInputs = () => {
  const pins = readJSON(path.join(frozen, 'pinned-inputs.json')), members = readJSON(path.join(frozen, 'members.json')).members;
  assert.equal(members.length, 90); for (const member of members) assert.equal(sha(fs.readFileSync(path.join(frozen, member.path))), member.sha256, member.path);
  const files = [...locales.flatMap(locale => ['system', 'common'].map(ns => `packages/i18n/locales/${locale}/${ns}.json`)), 'packages/app/src/screens/system/account.tsx'];
  const catalogs = Object.fromEntries(files.map(file => { const digest = sha(fs.readFileSync(path.join(repo, file))); assert.equal(digest, pins.inputs.find(p => p.path === file)?.sha256, file); return [file, digest]; }));
  return { frozenRevision: pins.revision, members: members.length, memberReceiptSHA256: sha(fs.readFileSync(path.join(frozen, 'members.json'))), inputReceiptSHA256: sha(fs.readFileSync(path.join(frozen, 'pinned-inputs.json'))), catalogs };
};
const installed = () => JSON.parse(ssh('/usr/bin/python3 -', `
import hashlib,json,os,re,subprocess
root=os.path.realpath(${JSON.stringify(macDirectory)}); binary='/Applications/Cortex.app/Contents/MacOS/Cortex'
rows=[line.strip().split(None,1) for line in subprocess.check_output(['/bin/ps','-axo','pid=,comm='],text=True).splitlines()]
pids=[int(row[0]) for row in rows if len(row)==2 and row[1]==binary]; h=hashlib.sha256()
with open('/Applications/Cortex.app/Contents/Resources/app.asar','rb') as f:
    for block in iter(lambda:f.read(1048576),b''): h.update(block)
r={'pids':pids,'asarSHA256':h.hexdigest()}
if len(pids)==1:
    command=subprocess.check_output(['/bin/ps','eww','-p',str(pids[0]),'-o','command='],text=True)
    def value(name):
        match=re.search(r'(?:^|\\s)'+re.escape(name)+r'=(\\S+)',command); return match.group(1) if match else ''
    r.update({'engineIsolated':os.path.realpath(value('CORTEX_DATA_DIR'))==root+'/engine','rendererIsolated':os.path.realpath(value('--user-data-dir'))==root+'/renderer','localeEnglish':value('CORTEX_LOCALE')=='en','controlledCatalog':value('CORTEX_CATALOG_URL')=='http://127.0.0.1:9457/catalog'})
print(json.dumps(r))
`));
const swift = 'import Foundation; import AppKit; import CoreGraphics; let rows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]).filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const appearance = () => ssh('/usr/bin/osascript -e \'tell application "System Events" to tell appearance preferences to get dark mode\'');
let page, expect, browser, cdp, dom, original, originalConnection, originalAppearance, runID, changed = false, stage = 'local-pins';
const request = (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
  const wire = await window.cortex.request({ url: `cortex://local${route}`, method, headers: [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: wire.status, headers: wire.headers, body: wire.body ? JSON.parse(wire.body) : null };
}, { route, method, body });
const call = async (...args) => { const wire = await request(...args); assert(wire.status >= 200 && wire.status < 300, 'Real engine request refused'); return wire.body; };
const submit = body => call('/api/connection/auth', 'POST', body);
const receipt = () => { const r = backend('receipt'); assert.equal(r.runID, runID); assert.equal(r.held, 0); assert.equal(r.holdCode, false); assert(r.freshRequestsCredentialFree); for (const n of Object.values(r.counts)) assert(Number.isSafeInteger(n) && n >= 0); return r; };
const identity = async () => {
  const mains = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser'); assert.equal(mains.length, 1); assert.equal(mains[0].id, report.installedBefore.pids[0]);
  assert.equal(browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('cortex://app/')).length, 1);
  const windows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`)); assert.equal(windows.length, 1); assert.equal(windows[0].pid, mains[0].id); assert(windows[0].active);
  if (dom) { const native = await dom.send('Browser.getWindowForTarget'); assert.equal(native.bounds.windowState, 'normal'); assert.deepEqual([native.bounds.width, native.bounds.height], [960, 640]); windows[0].cdpWindow = native; } return windows[0];
};
const privateInMain = async () => {
  const wire = await request('/api/connection/auth'); assert.equal(wire.status, 200); assert.deepEqual(Object.keys(wire.body).sort(), (wire.body.email === undefined ? ['signedIn', 'status'] : ['email', 'signedIn', 'status']).sort());
  assert(!wire.headers.some(([name]) => name.toLowerCase() === 'set-cookie'));
  const renderer = await page.evaluate(async () => ({ html: document.documentElement.outerHTML, local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, indexedDB: await indexedDB.databases(), caches: typeof caches === 'undefined' ? [] : await caches.keys() }));
  const cookies = await page.context().cookies(); assert.equal(renderer.cookie, ''); assert.deepEqual(cookies, []); assert.deepEqual(renderer.indexedDB, []); assert.deepEqual(renderer.caches, []); assert.deepEqual(report.rendererHttp, []);
  assert.equal(backend('__inspect', { runID, snapshot: JSON.stringify({ wire, renderer, cookies }) }).privateMaterialAbsent, true); return { auth: wire.body, privateMaterialAbsent: true };
};
const textSelector = '.systeme-login h1, .systeme-login .systeme-lead, .systeme-login [role=alert], .systeme-otp-meta, .systeme-login button, .systeme-cell';
const geometry = selector => page.locator(selector).evaluateAll(elements => elements.map(el => {
  const r = el.getBoundingClientRect(), boxes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent.trim() && !node.parentElement.closest('svg')) {
    const range = document.createRange(); range.selectNodeContents(node); boxes.push(...[...range.getClientRects()].filter(b => b.width && b.height));
  }
  let left = 0, top = 0, right = innerWidth, bottom = innerHeight, opacity = 1;
  for (let n = el; n; n = n.parentElement) {
    const s = getComputedStyle(n), b = n.getBoundingClientRect(); opacity *= s.visibility === 'visible' && s.display !== 'none' ? Number(s.opacity) : 0;
    if (/^(auto|scroll|hidden|clip)$/.test(s.overflowX)) { left = Math.max(left, b.left + n.clientLeft); right = Math.min(right, b.left + n.clientLeft + n.clientWidth); }
    if (/^(auto|scroll|hidden|clip)$/.test(s.overflowY)) { top = Math.max(top, b.top + n.clientTop); bottom = Math.min(bottom, b.top + n.clientTop + n.clientHeight); }
  }
  const inside = b => b.left >= left - .5 && b.top >= top - .5 && b.right <= right + .5 && b.bottom <= bottom + .5;
  return { kind: el.matches('h1,.systeme-lead,[role=alert]') ? 'copy' : el.tagName, text: el.textContent, label: el.getAttribute('aria-label'), fontFamily: getComputedStyle(el).fontFamily, opacity, bounds: [r.left, r.top, r.right, r.bottom], ink: boxes.map(b => [b.left, b.top, b.right, b.bottom]), readable: boxes.length > 0 && boxes.every(b => inside(b) && b.left >= r.left - .5 && b.right <= r.right + .5), reachable: r.width > 0 && r.height > 0 && inside(r) && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
}));
const deadline = Date.now() + 14 * 60_000;
try {
  report.inputsBefore = boundInputs(); save(); stage = 'installed-identity'; report.installedBefore = installed(); save();
  assert.equal(report.installedBefore.asarSHA256, expectedAsar); assert.equal(report.installedBefore.pids.length, 1);
  for (const key of ['engineIsolated', 'rendererIsolated', 'localeEnglish', 'controlledCatalog']) assert.equal(report.installedBefore[key], true, key);
  const health = backend('health'); assert.equal(health.protocol, 'cortex-remote-auth-native-v1'); assert.equal(health.platform, 'darwin'); assert.equal(health.port, 9457); assert.equal(canonical(health.root), canonical(macDirectory)); assert(/^[a-f0-9-]{36}$/.test(health.runID));
  assert.equal(health.scriptSHA256, sha(fs.readFileSync('/tmp/opencode/remote-auth-native-backend.mjs'))); runID = health.runID; report.backendBefore = receipt(); save();
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs'))); assert(modules);
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href); ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href)); expect = expect.configure({ timeout: 10000 });
  browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 }); cdp = await browser.newBrowserCDPSession(); await identity();
  const pages = browser.contexts().flatMap(c => c.pages()); [page] = pages.filter(p => p.url().startsWith('cortex://app/')); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(15000);
  const watch = p => { p.on('pageerror', e => report.errors.push({ type: 'page', sha256: sha(e.message) })); p.on('console', m => { if (m.type() === 'error') report.errors.push({ type: 'console', sha256: sha(m.text()) }); }); p.on('dialog', async d => { report.dialogs++; await d.dismiss().catch(() => { report.dialogs++; }); }); };
  pages.forEach(watch); for (const context of browser.contexts()) { context.on('page', watch); context.on('request', r => { if (/^https?:/.test(r.url())) report.rendererHttp.push({ sha256: sha(r.url()) }); }); }
  await page.waitForFunction(() => window.cortex?.platform === 'darwin');
  original = await page.evaluate(() => ({ url: location.href, locale: localStorage.getItem('cortex.locale'), theme: localStorage.getItem('cortex.theme'), lang: document.documentElement.lang, appliedTheme: document.documentElement.dataset.theme }));
  originalAppearance = appearance(); assert(['true', 'false'].includes(originalAppearance)); originalConnection = await call('/api/connection');
  assert(originalConnection.mode === 'local' || (originalConnection.mode === 'selfhost' && originalConnection.url === origin), 'Only the isolated local/fixture connection is accepted');
  changed = true; await call('/api/connection', 'PUT', { mode: 'selfhost', url: `${origin}/`, signedIn: false }); await submit({ action: 'logout' }); assert.deepEqual(await call('/api/connection/auth'), signedOut);
  dom = await page.context().newCDPSession(page); await dom.send('DOM.enable'); await dom.send('CSS.enable');
  const settled = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => document.querySelector('.systeme-login')?.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished')); };
  const verifyView = async (locale, theme, status, t, common) => {
    assert(Date.now() < deadline, 'Work deadline reached'); stage = `${locale}/${theme}/${status}`;
    const view = { locale, theme, status, keyboard: [] }; report.views.push(view);
    await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown');
    const wrong = status === 'code_sent', signed = status === 'signed_in';
    await expect(page.locator('.systeme-login h1')).toHaveText(t[wrong ? 'login.checkTitle' : signed ? 'auth.signedIn' : 'unavailable']);
    await expect(page.locator('.systeme-lead')).toHaveText(wrong ? `${t['login.checkLead']} person@example.test.` : t[signed ? 'auth.sessionOnly' : 'auth.continuationUnavailable']);
    await expect(page.locator('.systeme-login button')).toHaveText(wrong ? [t['login.resend'], t['onb.continue'], t['login.otherEmail'], common.cancel] : signed ? [t['onb.continue'], t['auth.settings']] : [t['login.otherEmail'], common.cancel]);
    if (wrong) { await expect(page.locator('[role=alert]')).toHaveText(t['auth.failed']); await expect(page.locator('.systeme-otp input')).toHaveValue('000000'); await expect(page.locator('.systeme-otp input')).toBeEditable(); await expect(page.locator('.systeme-cell')).toHaveText([...('000000')]); }
    await settled(); view.privacy = await privateInMain(); assert.deepEqual(view.privacy.auth, { status, signedIn: signed, email: status === 'mfa_enrollment' ? 'mfa@example.test' : 'person@example.test' });
    view.layout = await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], window: [document.querySelector('.window').getBoundingClientRect().width, document.querySelector('.window').getBoundingClientRect().height], fonts: document.fonts.status, locale: localStorage.getItem('cortex.locale'), url: location.href }));
    view.copy = await geometry(textSelector); save(); assert.deepEqual(view.layout.viewport, [960, 640]); assert.deepEqual(view.layout.window, [960, 640]); assert.equal(view.layout.fonts, 'loaded'); assert.equal(view.layout.locale, locale); assert(view.copy.length > 0 && view.copy.every(r => r.readable && r.opacity === 1), 'Clipped or unsettled primary copy');
    view.controls = await geometry('.systeme-login input, .systeme-login button'); save(); const apart = (a, b) => a[2] <= b[0] || a[0] >= b[2] || a[3] <= b[1] || a[1] >= b[3];
    assert(view.controls.every((c, i) => c.reachable && view.controls.slice(i + 1).every(d => apart(c.bounds, d.bounds))), 'Initial controls clip, overlap or fail hit testing');
    assert(view.copy.filter(r => r.kind === 'copy').every(r => r.ink.every(b => view.controls.every(c => apart(b, c.bounds)))), 'Primary copy overlaps a control');
    const doc = await dom.send('DOM.getDocument'), nodes = await dom.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: '.systeme-login h1, .systeme-login .systeme-lead, .systeme-login .systeme-err' });
    view.platformFonts = await Promise.all(nodes.nodeIds.map(async nodeId => (await dom.send('CSS.getPlatformFontsForNode', { nodeId })).fonts)); assert.equal(view.platformFonts.length, wrong ? 3 : 2); assert(view.platformFonts.every(group => group.some(f => f.glyphCount > 0)));
    await page.locator('.content-top button').focus(); const controls = page.locator('.systeme-login input, .systeme-login button'); assert.equal(await controls.count(), wrong ? 5 : 2);
    for (let i = 0; i < await controls.count(); i++) { await page.keyboard.press('Tab'); await expect(controls.nth(i)).toBeFocused(); await expect(controls.nth(i)).toBeEnabled(); const row = (await geometry('.systeme-login input, .systeme-login button'))[i]; view.keyboard.push(row); assert(row.reachable); }
    assert.deepEqual(await call('/api/connection'), { mode: 'selfhost', url: origin, signedIn: signed });
    view.window = await identity(); assert.deepEqual([view.window.bounds.Width, view.window.bounds.Height], [960, 640]); assert.equal(appearance(), String(theme === 'dark')); save();
    if (wrong) {
      assert.deepEqual(installed(), report.installedBefore); const response = await fetch(`http://127.0.0.1:19445/${view.window.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) }); assert(response.ok);
      const png = Buffer.from(await response.arrayBuffer()); assert(png.length > 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
      const pixels = [png.readUInt32BE(16), png.readUInt32BE(20)]; assert(pixels[0] >= 960 && pixels[0] / 960 === pixels[1] / 640);
      const file = `auth-${locale}-${theme}-wrong-code.png`; fs.writeFileSync(path.join(out, file), png, { flag: 'wx' });
      report.captures.push({ file, locale, theme, origin, pixels, viewport: [960, 640], native: true, window: view.window, expectedAsar, expectedRevision: expectedRevision ?? null, sha256: sha(png) }); save();
      assert.deepEqual(await identity(), view.window); assert.equal(appearance(), String(theme === 'dark')); await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme); assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), [960, 640]); assert((await geometry(textSelector)).every(row => row.readable && row.opacity === 1));
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.rendererHttp, []); assert.equal(report.dialogs, 0); view.passed = true; save();
  };
  for (const theme of ['light', 'dark']) {
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate'`);
    const native = await dom.send('Browser.getWindowForTarget'); assert.equal(native.bounds.windowState, 'normal'); await dom.send('Browser.setWindowBounds', { windowId: native.windowId, bounds: { width: 960, height: 640 } });
    for (const locale of locales) {
      stage = `${locale}/${theme}/setup`; assert(Date.now() < deadline); await submit({ action: 'logout' });
      const t = readJSON(path.join(repo, `packages/i18n/locales/${locale}/system.json`)), common = readJSON(path.join(repo, `packages/i18n/locales/${locale}/common.json`));
      await page.evaluate(({ locale, theme }) => { localStorage.setItem('cortex.locale', locale); localStorage.setItem('cortex.theme', theme); }, { locale, theme });
      await page.goto(`cortex://app/index.html?native-auth-locales-final=${locale}-${theme}#/login?theme=${theme}`); await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const input = page.getByRole('textbox', { name: t['login.codeLabel'], exact: true }), button = name => page.getByRole('button', { name, exact: true });
      const email = page.getByRole('textbox', { name: t['login.email'], exact: true }); await expect(email).toBeEditable(); await email.fill('person@example.test'); await button(t['login.getCode']).click();
      const enter = async code => { await expect(input).toBeEditable(); await input.fill(code); await button(t['onb.continue']).click(); };
      await enter('000000'); await expect(page.locator('[role=alert]')).toHaveText(t['auth.failed']); await verifyView(locale, theme, 'code_sent', t, common);
      await enter('123456'); await expect(page.locator('.systeme-login h1')).toHaveText(t['auth.signedIn']); await page.reload(); await verifyView(locale, theme, 'signed_in', t, common);
      await submit({ action: 'logout' }); await submit({ action: 'email', email: 'mfa@example.test' }); await page.reload(); await enter('123456');
      await expect(page.locator('.systeme-lead')).toHaveText(t['auth.continuationUnavailable']); await page.reload(); await verifyView(locale, theme, 'mfa_enrollment', t, common);
    }
  }
  report.backendAfter = receipt(); report.counterDelta = Object.fromEntries(Object.keys(report.backendBefore.counts).map(key => [key, report.backendAfter.counts[key] - report.backendBefore.counts[key]]));
  assert.deepEqual(report.counterDelta, { email: 32, code: 48, finishedCode: 48, wrongCode: 16, session: 16, enrollment: 16, logout: 0, abortedReply: 0, discovery: 0, inspections: 48, inspectionsPassed: 48, errors: 0 });
  assert.equal(report.views.length, 48); assert(report.views.every(v => v.passed)); assert.equal(report.views.reduce((n, v) => n + v.keyboard.length, 0), 144); assert.equal(report.captures.length, 16); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, sha256: sha(String(error?.message ?? error)) }; }
finally {
  if (changed) {
    try { await submit({ action: 'logout' }); assert.deepEqual(await call('/api/connection', 'PUT', { ...originalConnection, signedIn: false }), { ...originalConnection, signedIn: false }); assert.deepEqual(await call('/api/connection/auth'), signedOut); report.cleanup.connectionRestoredSignedOut = true; }
    catch (error) { report.status = 'failed'; report.cleanup.connectionFailureSHA256 = sha(String(error?.message ?? error)); }
    try {
      ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${originalAppearance}'`);
      await page.evaluate(original => { for (const [key, value] of [['cortex.locale', original.locale], ['cortex.theme', original.theme]]) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } }, original);
      await page.goto(original.url); await expect(page.locator('html')).toHaveAttribute('lang', original.lang); await expect(page.locator('html')).toHaveAttribute('data-theme', original.appliedTheme); assert.equal(page.url(), original.url); assert.deepEqual(await page.evaluate(() => [localStorage.getItem('cortex.locale'), localStorage.getItem('cortex.theme')]), [original.locale, original.theme]); assert.equal(appearance(), originalAppearance); report.cleanup.routeLocaleThemeRestored = true;
    } catch (error) { report.status = 'failed'; report.cleanup.rendererFailureSHA256 = sha(String(error?.message ?? error)); }
    try { report.backendAfterCleanup = receipt(); if (report.backendAfter) assert.deepEqual(report.backendAfterCleanup.counts, report.backendAfter.counts); } catch (error) { report.status = 'failed'; report.cleanup.backendFailureSHA256 = sha(String(error?.message ?? error)); }
  }
  try { report.inputsAfter = boundInputs(); assert.deepEqual(report.inputsAfter, report.inputsBefore); if (report.installedBefore) { report.installedAfter = installed(); assert.deepEqual(report.installedAfter, report.installedBefore); } }
  catch (error) { report.status = 'failed'; report.cleanup.identityFailureSHA256 = sha(String(error?.message ?? error)); }
  if (report.errors.length || report.rendererHttp.length || report.dialogs) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.scope = '16 native wrong-code captures; 48 native-locale primary geometries/144 Tab stops; controlled SDK auth only. Artifact admission and image review remain coordinator-owned.'; save();
}
console.log(`Native auth locales: ${report.status}; ${path.join(out, 'manifest.json')}`);
// Disconnect this client by exiting. Never close the installed browser, context, window or shared helpers.
process.exit(report.status === 'passed' ? 0 : 1);
