// Prepared native checks. Coordinator owns artifact installation, GUI launch, lease and execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [outArg, macDirectory, expectedAsar] = process.argv.slice(2);
assert(outArg && path.isAbsolute(outArg) && /^\/(?:private\/)?tmp\/opencode\/desktop-remote-auth-[a-zA-Z0-9._-]+$/.test(macDirectory ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? ''),
  'Usage: node remote-auth-native.mjs <fresh-absolute-local-output> <isolated-mac-run-directory> <expected-app.asar-sha256>');
assert.notEqual(expectedAsar, '71f560e62bf0d0a8cf0e72beb85611eb413acf9fe10e2cacc3d9f1fedd5b4c04', 'Installed b0e6d78 has no remote authentication; supply a future auth artifact');
const out = path.resolve(outArg), repo = fs.realpathSync(process.cwd());
assert(!fs.existsSync(out), 'Use a fresh output directory');
assert(out !== repo && !out.startsWith(`${repo}/`), 'Output belongs outside the repository');
fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command],
  { input, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const canonical = value => value.replace(/^\/private\/tmp\//, '/tmp/');
const backend = (endpoint, body) => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 ${body === undefined ? '' : "--request POST --header 'content-type: application/json' --data-binary @- "}http://127.0.0.1:9457/${endpoint}`,
  body === undefined ? undefined : JSON.stringify(body)));
const report = {
  status: 'running', startedAt: new Date().toISOString(), expectedAsar, scriptSHA256: sha(fs.readFileSync(new URL(import.meta.url))),
  captures: [], checks: [], pageErrors: [], consoleErrors: [], rendererHttp: [], unexpectedDialogs: 0, cleanup: {},
};
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
const record = (name, details = {}) => { report.checks.push({ name, ...details }); save(); };
const installed = () => JSON.parse(ssh('/usr/bin/python3 -', `
import hashlib,json,os,re,subprocess
root=os.path.realpath(${JSON.stringify(macDirectory)})
binary='/Applications/Cortex.app/Contents/MacOS/Cortex'
pids=[]
for line in subprocess.check_output(['/bin/ps','-axo','pid=,comm='],text=True).splitlines():
    fields=line.strip().split(None,1)
    if len(fields)==2 and fields[1]==binary: pids.append(int(fields[0]))
with open('/Applications/Cortex.app/Contents/Resources/app.asar','rb') as f:
    h=hashlib.sha256()
    for block in iter(lambda:f.read(1048576),b''): h.update(block)
r={'asarSHA256':h.hexdigest(),'processCount':len(pids)}
if len(pids)==1:
    pid=pids[0]
    command=subprocess.check_output(['/bin/ps','eww','-p',str(pid),'-o','command='],text=True)
    def value(name):
        match=re.search(r'(?:^|\\s)'+re.escape(name)+r'=(\\S+)',command)
        return match.group(1) if match else ''
    r.update({'pid':pid,'engineIsolated':os.path.realpath(value('CORTEX_DATA_DIR'))==root+'/engine',
      'rendererIsolated':os.path.realpath(value('--user-data-dir'))==root+'/renderer',
      'localeEnglish':value('CORTEX_LOCALE')=='en','controlledCatalog':value('CORTEX_CATALOG_URL')=='http://127.0.0.1:9457/catalog'})
print(json.dumps(r))
`));
const swift = 'import Foundation; import AppKit; import CoreGraphics; let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]; let rows = all.filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeWindow = () => {
  const rows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`));
  assert.equal(rows.length, 1, 'Exactly one normal on-screen Cortex window required');
  assert.equal(rows[0].active, true, 'Installed Cortex must be foregrounded');
  assert.equal(rows[0].pid, report.installedBefore.pid, 'Native window process changed');
  assert.equal(ssh(`/bin/ps -p ${Number(rows[0].pid)} -o comm=`), '/Applications/Cortex.app/Contents/MacOS/Cortex');
  assert.equal(rows[0].bounds.Width, 960); assert.equal(rows[0].bounds.Height, 640);
  return rows[0];
};
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
const signedOut = { status: 'signed_out', signedIn: false };
const sessionCopy = 'Sign-in lasts until Cortex closes. Chats still use your local provider settings.';
const refusalCopy = 'Couldn’t sign in. Check your details and try again.';
const continuationCopy = 'This sign-in step isn’t available in Cortex yet. Use another address or cancel.';
let page, expect, cdp, initialURL, originalConnection, backendRun, changed = false, rendererChanged = false, stage = 'installed-artifact';
let call, request;
try {
  report.installedBefore = installed(); save();
  assert.equal(report.installedBefore.asarSHA256, expectedAsar, 'Installed artifact mismatch');
  assert.equal(report.installedBefore.processCount, 1, 'Exactly one installed main process required');
  for (const name of ['engineIsolated', 'rendererIsolated', 'localeEnglish', 'controlledCatalog']) assert.equal(report.installedBefore[name], true, name);
  const health = backend('health');
  assert.equal(health.protocol, 'cortex-remote-auth-native-v1'); assert.equal(health.platform, 'darwin'); assert.equal(health.port, 9457);
  assert.equal(canonical(health.root), canonical(macDirectory)); assert(/^[a-f0-9-]{36}$/.test(health.runID));
  backendRun = health.runID; report.backend = health;
  assert(Object.values(backend('receipt').counts).every(count => count === 0), 'Fresh unused auth fixture required');
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs')));
  assert(modules, 'Run from the checkout with installed Playwright dependencies');
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
  ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href));
  expect = expect.configure({ timeout: 10000 });
  stage = 'native-CDP-identity';
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 });
  cdp = await browser.newBrowserCDPSession();
  const browserPID = async () => {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const main = processInfo.filter(process => process.type === 'browser');
    assert.equal(main.length, 1, 'Exactly one CDP browser process required');
    assert.equal(main[0].id, report.installedBefore.pid, 'CDP must belong to the installed native window process');
  };
  await browserPID();
  const pages = browser.contexts().flatMap(context => context.pages());
  const candidates = pages.filter(target => target.url().startsWith('cortex://app/'));
  assert.equal(candidates.length, 1, 'Exactly one Cortex renderer required');
  [page] = candidates; initialURL = page.url(); page.setDefaultTimeout(10000);
  const tracked = new Set();
  const watch = target => {
    if (tracked.has(target)) return; tracked.add(target);
    target.on('pageerror', error => report.pageErrors.push({ sha256: sha(error.message) }));
    target.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ sha256: sha(message.text()) }); });
    target.on('dialog', async dialog => { report.unexpectedDialogs++; await dialog.dismiss().catch(() => { report.unexpectedDialogs++; }); });
  };
  pages.forEach(watch);
  for (const context of browser.contexts()) {
    context.on('page', watch);
    context.on('request', req => { if (/^https?:/.test(req.url())) report.rendererHttp.push({ sha256: sha(req.url()) }); });
  }
  request = (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
    const wire = await window.cortex.request({ url: `cortex://local${route}`, method, headers: body === undefined ? [] : [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: wire.status, headers: wire.headers, body: wire.body ? JSON.parse(wire.body) : null };
  }, { route, method, body });
  call = async (...args) => { const wire = await request(...args); assert(wire.status >= 200 && wire.status < 300, 'Real engine request refused; no older-artifact fallback'); return wire.body; };
  const auth = async () => {
    const state = await call('/api/connection/auth');
    assert.deepEqual(Object.keys(state).sort(), (state.email === undefined ? ['signedIn', 'status'] : ['email', 'signedIn', 'status']).sort(), 'Sanitized auth DTO required');
    assert(['signed_out', 'code_sent', 'signed_in', 'verify_email', 'mfa_challenge', 'mfa_enrollment'].includes(state.status));
    assert.equal(typeof state.signedIn, 'boolean');
    return state;
  };
  stage = 'live-home-auth-contract';
  // Full document load avoids the separately tracked preview-departure bug; no page error is filtered.
  assert.notEqual(new URL(initialURL).search, '?native-auth-live', 'Fresh renderer launch required');
  rendererChanged = true;
  await page.goto('cortex://app/index.html?native-auth-live#/home');
  await page.waitForFunction(() => window.cortex?.platform === 'darwin');
  assert.deepEqual(await auth(), signedOut, 'A real auth route on the future package is mandatory');
  originalConnection = await call('/api/connection');
  assert.deepEqual(originalConnection, { mode: 'local', signedIn: false }, 'Fresh local engine required');
  for (const route of ['/api/sessions', '/api/bots', '/api/tasks', '/api/providers', '/api/permissions']) assert.deepEqual(await call(route), [], 'Fresh isolated engine required');
  changed = true;
  await page.evaluate(() => localStorage.setItem('cortex.locale', 'en')); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  assert.deepEqual(await call('/api/connection', 'PUT', { mode: 'selfhost', url: 'http://127.0.0.1:9457', signedIn: true }), { mode: 'selfhost', url: 'http://127.0.0.1:9457', signedIn: false });
  record('real-auth-contract-and-isolated-engine', { rendererSignedInIgnored: true });
  const control = action => backend('__control', { runID: backendRun, action });
  const receipt = () => { const value = backend('receipt'); assert.equal(value.runID, backendRun); return value; };
  const show = (route, theme) => page.evaluate(({ route, theme }) => history.pushState(null, '', `#/${route}${route.includes('?') ? '&' : '?'}theme=${theme}`), { route, theme });
  const button = name => page.getByRole('button', { name, exact: true });
  const input = () => page.getByRole('textbox', { name: '6-digit code', exact: true });
  const sendEmail = async email => {
    const emailInput = page.getByRole('textbox', { name: 'Email address', exact: true });
    await expect(emailInput).toBeEditable(); await emailInput.fill(email);
    await button('Get a code').click(); await expect(input()).toBeEditable();
    assert.deepEqual(await auth(), { status: 'code_sent', signedIn: false, email });
    assert.equal(receipt().freshRequestsCredentialFree, true, 'A fresh candidate must not send prior credentials');
  };
  const enterCode = async value => { await input().fill(value); await button('Continue').click(); };
  const privateInMain = async () => {
    const wire = await request('/api/connection/auth'); await auth();
    assert.equal(wire.status, 200); assert(!wire.headers.some(([name]) => name.toLowerCase() === 'set-cookie'));
    const renderer = await page.evaluate(async () => ({ html: document.documentElement.outerHTML, local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, indexedDB: await indexedDB.databases(), caches: typeof caches === 'undefined' ? [] : await caches.keys() }));
    const cookies = await page.context().cookies();
    assert.equal(renderer.cookie, ''); assert.deepEqual(cookies, []); assert.deepEqual(renderer.indexedDB, []); assert.deepEqual(renderer.caches, []);
    assert.deepEqual(report.rendererHttp, []);
    // Secret values stay on the fixture. Send isolated public observations to its checker, never secrets to the renderer.
    assert.equal(backend('__inspect', { runID: backendRun, snapshot: JSON.stringify({ wire, renderer, cookies }) }).privateMaterialAbsent, true, 'Authentication material crossed into the renderer');
  };
  const painted = async (locator, hit = false) => {
    await expect(locator).toBeVisible();
    const measure = () => locator.evaluate((el, hit) => {
      const r = el.getBoundingClientRect();
      let opaque = true, unclipped = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node); opaque &&= Number(s.opacity) === 1 && s.visibility === 'visible' && s.display !== 'none';
        if (node !== el) {
          const b = node.getBoundingClientRect(), left = b.left + node.clientLeft, top = b.top + node.clientTop;
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) unclipped &&= r.left >= left - 0.5 && r.right <= left + node.clientWidth + 0.5;
          if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) unclipped &&= r.top >= top - 0.5 && r.bottom <= top + node.clientHeight + 0.5;
        }
      }
      const hitTarget = el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      return { x: r.x, y: r.y, width: r.width, height: r.height, opaque, unclipped, hitTarget, ready: opaque && unclipped && r.width > 0 && r.height > 0 && (!hit || hitTarget) };
    }, hit);
    await expect.poll(async () => (await measure()).ready).toBe(true);
    return measure();
  };
  const capture = async (name, theme, visuals, controls) => {
    assert.equal(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.status; }), 'loaded');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const boxes = [];
    for (const locator of visuals) boxes.push(await painted(locator));
    for (const locator of controls) { await expect(locator).toBeEnabled(); boxes.push(await painted(locator, true)); }
    assert.equal(appearance(), String(theme === 'dark'));
    await browserPID();
    const identity = installed(); assert.equal(identity.asarSHA256, expectedAsar); assert.equal(identity.pid, report.installedBefore.pid);
    const win = nativeWindow();
    const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) });
    assert(response.ok, 'Native capture helper refused');
    const png = Buffer.from(await response.arrayBuffer());
    assert(png.length > 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Native helper must return PNG');
    const pixels = [png.readUInt32BE(16), png.readUInt32BE(20)]; assert(pixels[0] >= 960 && pixels[1] >= 640);
    for (const locator of visuals) await painted(locator);
    for (const locator of controls) await painted(locator, true);
    const afterWindow = nativeWindow(); assert.equal(afterWindow.id, win.id); assert.equal(appearance(), String(theme === 'dark'));
    const file = `${name}-${theme}.png`; fs.writeFileSync(path.join(out, file), png, { flag: 'wx' });
    report.captures.push({ file, theme, viewport: [960, 640], pixels, native: true, windowID: win.id, pid: win.pid, asarSHA256: identity.asarSHA256, sha256: sha(png), boxes, fontsLoaded: true, fullOpacityBeforeAndAfter: true }); save();
  };
  for (const theme of ['light', 'dark']) {
    stage = `${theme}:refused-code`;
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    await show('login', theme); await sendEmail('person@example.test'); await enterCode('000000');
    await expect(page.getByText(refusalCopy, { exact: true })).toBeVisible(); await expect(input()).toHaveValue('000000'); await expect(input()).toBeEditable();
    assert.deepEqual(await auth(), { status: 'code_sent', signedIn: false, email: 'person@example.test' });
    const cells = page.locator('.systeme-cell'); await expect(cells).toHaveCount(6); await expect(cells).toHaveText(['0', '0', '0', '0', '0', '0']);
    await privateInMain();
    // OTP input is intentionally transparent; verify its six painted cells, plus actual button hit rectangles.
    await capture('remote-code-refused', theme, [page.getByRole('heading', { name: 'Check your email', exact: true }), page.getByText(refusalCopy, { exact: true }), ...await cells.all()], [button('Continue'), button('Resend the code'), button('Use another address'), button('Cancel')]);
    record('wrong-code-remains-editable-and-private', { theme });

    stage = `${theme}:signed-in`;
    const before = receipt().counts.code; control('hold');
    await input().fill('123456'); await button('Continue').dblclick({ delay: 30 });
    await expect.poll(() => receipt().held).toBe(1); assert.equal(receipt().counts.code, before + 1);
    await expect(input()).toBeDisabled(); await expect(input()).toHaveValue('123456'); assert.equal((await auth()).signedIn, false);
    control('release');
    await expect(page.getByRole('heading', { name: 'Signed in', exact: true })).toBeVisible();
    assert.deepEqual(await auth(), { status: 'signed_in', signedIn: true, email: 'person@example.test' });
    assert.equal((await call('/api/connection')).signedIn, true); await privateInMain();
    await capture('remote-signed-in', theme, [page.getByRole('heading', { name: 'Signed in', exact: true }), page.getByText(sessionCopy, { exact: true })], [button('Continue'), button('Open connection settings')]);
    const countBeforeReload = receipt().counts.code;
    await page.reload(); await expect(page.getByRole('heading', { name: 'Signed in', exact: true })).toBeVisible();
    assert.equal(receipt().counts.code, countBeforeReload); assert.equal((await auth()).signedIn, true); await browserPID(); await privateInMain();
    record('one-held-submit-and-same-process-renderer-reload', { theme, codeRequestsAdded: 1, sessionSurvivesRendererReload: true });

    stage = `${theme}:settings-signout`;
    await button('Open connection settings').click();
    await expect(page.getByTestId('connection-mode-selfhost')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('selfhost-url')).toHaveValue('http://127.0.0.1:9457');
    await page.getByTestId('settings-nav-account').click();
    await expect(page.getByRole('heading', { name: 'Session', exact: true })).toBeVisible(); await button('Sign out').click();
    await expect.poll(auth).toEqual(signedOut); assert.equal((await call('/api/connection')).signedIn, false); assert.equal(receipt().counts.logout, 0);
    record('settings-account-signout-is-device-local', { theme });

    stage = `${theme}:cancel-pending-code`;
    await show('login', theme); await sendEmail('person@example.test'); control('hold'); await enterCode('123456');
    await expect.poll(() => receipt().held).toBe(1); await expect(button('Cancel')).toBeEnabled(); await button('Cancel').click();
    await expect(page).toHaveURL(/#\/home(?:\?|$)/); await expect.poll(auth).toEqual(signedOut);
    const finished = receipt().counts.finishedCode; control('release');
    await expect.poll(() => receipt().counts.finishedCode).toBe(finished + 1); assert.deepEqual(await auth(), signedOut);
    record('cancelled-held-code-cannot-commit-late', { theme });

    stage = `${theme}:unavailable`;
    await show('login', theme); await sendEmail('mfa@example.test'); await enterCode('123456');
    await expect(page.getByText(continuationCopy, { exact: true })).toBeVisible();
    assert.deepEqual(await auth(), { status: 'mfa_enrollment', signedIn: false, email: 'mfa@example.test' });
    assert.equal((await call('/api/connection')).signedIn, false); await expect(input()).toHaveCount(0); await privateInMain();
    await capture('remote-mfa-unavailable', theme, [page.getByRole('heading', { name: 'Not available yet', exact: true }), page.getByText(continuationCopy, { exact: true })], [button('Use another address'), button('Cancel')]);
    await button('Use another address').click(); await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toBeEditable();
    assert.deepEqual(await auth(), signedOut); await button('Cancel').click(); await expect(page).toHaveURL(/#\/home(?:\?|$)/);
    await privateInMain(); record('MFA-enrollment-status-only-and-cancel', { theme });
    assert.equal(receipt().counts.errors, 0); assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.rendererHttp, []);
  }
  report.backendReceipt = receipt();
  assert.equal(report.backendReceipt.held, 0); assert.equal(report.backendReceipt.freshRequestsCredentialFree, true);
  assert.equal(report.backendReceipt.counts.inspections, report.backendReceipt.counts.inspectionsPassed);
  assert.equal(report.captures.length, 6); assert.equal(report.unexpectedDialogs, 0);
  report.installedAfter = installed(); assert.equal(report.installedAfter.asarSHA256, expectedAsar); assert.equal(report.installedAfter.pid, report.installedBefore.pid);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { stage, sha256: sha(String(error?.message ?? error)) };
} finally {
  if (changed && page) {
    try {
      await call('/api/connection/auth', 'POST', { action: 'cancel' });
      assert.deepEqual(await call('/api/connection', 'PUT', originalConnection), originalConnection);
      assert.deepEqual(await call('/api/connection/auth'), signedOut);
    report.cleanup.connectionRestored = true;
    } catch (error) { report.status = 'failed'; report.cleanup.connectionFailureSHA256 = sha(String(error?.message ?? error)); }
    try { backend('__control', { runID: backendRun, action: 'release' }); report.cleanup.backendReleased = true; }
    catch (error) { report.status = 'failed'; report.cleanup.backendFailureSHA256 = sha(String(error?.message ?? error)); }
  }
  if (rendererChanged && page) {
    try {
      ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'`);
      await page.evaluate(() => { localStorage.setItem('cortex.locale', 'en'); localStorage.setItem('cortex.theme', 'dark'); });
      const restored = new URL(initialURL), [route, query] = restored.hash.split('?'), params = new URLSearchParams(query);
      params.set('theme', 'dark'); restored.hash = `${route || '#/home'}?${params}`;
      await page.goto(restored.href); await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      assert.equal(appearance(), 'true'); report.cleanup.originalRouteEnglishDark = true;
    } catch (error) { report.status = 'failed'; report.cleanup.rendererFailureSHA256 = sha(String(error?.message ?? error)); }
  }
  if (changed) {
    try {
      const final = backend('receipt'); assert.equal(final.runID, backendRun); assert.equal(final.held, 0);
      assert.equal(final.counts.errors, 0); assert.equal(final.counts.inspections, final.counts.inspectionsPassed);
      report.backendReceiptAfterCleanup = final;
    } catch (error) { report.status = 'failed'; report.cleanup.receiptFailureSHA256 = sha(String(error?.message ?? error)); }
  }
  if (report.pageErrors.length || report.consoleErrors.length || report.rendererHttp.length || report.unexpectedDialogs) report.status = 'failed';
  report.finishedAt = new Date().toISOString();
  report.scope = 'Prepared for future installed auth artifact. Real main SDK/IPC, controlled Mac loopback fixture, six native captures. Renderer reload is not process-restart proof; no remote inference, real account or server-revocation claim. Launch/build provenance and pixel review remain coordinator-owned.';
  save();
}
console.log(`Remote auth native: ${report.status}; stage ${stage}; ${path.join(out, 'manifest.json')}`);
// Exit only this CDP client. Never Browser.close, window.close, app.quit or stop shared helpers.
process.exit(report.status === 'passed' ? 0 : 1);
