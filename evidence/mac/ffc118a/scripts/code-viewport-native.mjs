// Preparation only; the coordinator owns future installed-artifact execution and Mac lease.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { protocol, files, prompt, callID } from './code-viewport-native-backend.mjs';

const [outArg, projectArg, expectedAsar] = process.argv.slice(2);
assert(outArg && path.isAbsolute(outArg) && /^\/(?:private\/)?tmp\/opencode\/desktop-recovery-[a-zA-Z0-9._-]+\/project$/.test(projectArg ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? ''),
  'Usage: node code-viewport-native.mjs <fresh-local-output> <isolated-mac-project> <future-app.asar-sha256>');
assert.notEqual(expectedAsar, '71f560e62bf0d0a8cf0e72beb85611eb413acf9fe10e2cacc3d9f1fedd5b4c04', 'b0e6d78 predates the viewport/departure fixes');
const repo = fs.realpathSync(process.cwd()), out = path.resolve(outArg);
assert(!fs.existsSync(out)); assert(out !== repo && !out.startsWith(`${repo}/`)); fs.mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const canonical = value => value.replace(/^\/private\/tmp\//, '/tmp/');
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const backend = endpoint => JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 http://127.0.0.1:9458/${endpoint}`));
const report = { status: 'running', startedAt: new Date().toISOString(), expectedAsar, scriptSHA256: sha(fs.readFileSync(new URL(import.meta.url))),
  checks: [], captures: [], sessionIDs: [], pageErrors: [], consoleErrors: [], rendererHttp: [], unexpectedDialogs: 0, cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
const record = (name, data = {}) => { report.checks.push({ name, ...data }); save(); };
const installed = () => JSON.parse(ssh('/usr/bin/python3 -', `
import hashlib,json,os,re,subprocess
root=os.path.dirname(os.path.realpath(${JSON.stringify(projectArg)}))
binary='/Applications/Cortex.app/Contents/MacOS/Cortex'
pids=[]
for line in subprocess.check_output(['/bin/ps','-axo','pid=,comm='],text=True).splitlines():
    fields=line.strip().split(None,1)
    if len(fields)==2 and fields[1]==binary: pids.append(int(fields[0]))
with open('/Applications/Cortex.app/Contents/Resources/app.asar','rb') as f:
    h=hashlib.sha256()
    for block in iter(lambda:f.read(1048576),b''): h.update(block)
r={'processCount':len(pids),'asarSHA256':h.hexdigest()}
if len(pids)==1:
    command=subprocess.check_output(['/bin/ps','eww','-p',str(pids[0]),'-o','command='],text=True)
    def value(name):
        match=re.search(r'(?:^|\\s)'+re.escape(name)+r'=(\\S+)',command)
        return match.group(1) if match else ''
    data=value('CORTEX_DATA_DIR'); profile=value('--user-data-dir'); catalog=value('CORTEX_CATALOG_URL')
    r.update({'pid':pids[0],'isolatedEngine':bool(data) and os.path.realpath(data).startswith(root+'/'),
      'isolatedRenderer':bool(profile) and os.path.realpath(profile).startswith(root+'/'),
      'controlledCatalog':catalog.startswith('data:application/json,') or catalog in ['http://127.0.0.1:9458/catalog','http://127.0.0.1:9456/catalog'],
      'projectIsolated':bool(re.fullmatch(r'/(?:private/)?tmp/opencode/desktop-recovery-[a-zA-Z0-9._-]+',root))})
print(json.dumps(r))
`));
const swift = 'import Foundation; import AppKit; import CoreGraphics; let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]; let rows = all.filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeWindow = () => {
  const rows = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`)); assert.equal(rows.length, 1);
  const win = rows[0]; assert.equal(win.active, true); assert.equal(win.pid, report.installedBefore.pid);
  assert.equal(win.bounds.Width, 960); assert.equal(win.bounds.Height, 640);
  assert.equal(ssh(`/bin/ps -p ${Number(win.pid)} -o comm=`), '/Applications/Cortex.app/Contents/MacOS/Cortex'); return win;
};
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
// No file content leaves the Mac. O_NOFOLLOW + exact bounded destination prevents symlink reads.
const disk = (theme, absent = false) => JSON.parse(ssh('/usr/bin/python3 -', `
import hashlib,json,os,stat
root=os.path.realpath(${JSON.stringify(projectArg)})
assert root==${JSON.stringify(projectArg)} or root=='/private'+${JSON.stringify(projectArg)}
planned=json.loads(${JSON.stringify(JSON.stringify(files(theme)))})
rows=[]
for item in planned:
    name=item['path']; target=os.path.join(root,name)
    assert os.path.basename(name)==name and os.path.dirname(target)==root
    if ${absent ? 'True' : 'False'}:
        rows.append({'file':name,'absent':not os.path.lexists(target)})
        continue
    fd=os.open(target,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(fd,'rb') as f:
        assert stat.S_ISREG(os.fstat(f.fileno()).st_mode)
        raw=f.read(1048577)
    expected=item['content'].encode('utf8')
    rows.append({'file':name,'exact':raw==expected,'bytes':len(raw),'lines':len(raw.split(b'\\n')),'sha256':hashlib.sha256(raw).hexdigest()})
print(json.dumps(rows))
`));
let page, expect, call, initialURL, previousProvider, providerChanged = false, rendererChanged = false, activeSession, stage = 'artifact';
try {
  report.installedBefore = installed(); save();
  assert.equal(report.installedBefore.asarSHA256, expectedAsar); assert.equal(report.installedBefore.processCount, 1);
  for (const key of ['isolatedEngine', 'isolatedRenderer', 'controlledCatalog', 'projectIsolated']) assert.equal(report.installedBefore[key], true, key);
  const health = backend('health'); assert.equal(health.protocol, protocol); assert.equal(health.platform, 'darwin'); assert.equal(health.port, 9458);
  assert.equal(canonical(health.project), canonical(projectArg)); assert(/^[a-f0-9-]{36}$/.test(health.runID));
  assert.equal(health.scriptSHA256, sha(fs.readFileSync(new URL('./code-viewport-native-backend.mjs', import.meta.url))));
  assert.equal(health.destinationsInitiallyAbsent, true); assert.deepEqual(backend('receipt').requests, []); report.backend = health;
  for (const theme of ['light', 'dark']) assert(disk(theme, true).every(row => row.absent), 'All four write destinations must be absent');
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs')));
  assert(modules, 'Existing Playwright dependencies required');
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
  ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href)); expect = expect.configure({ timeout: 15000 });
  stage = 'CDP';
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 });
  const cdp = await browser.newBrowserCDPSession();
  const identity = async () => {
    const mains = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(process => process.type === 'browser');
    assert.equal(mains.length, 1); assert.equal(mains[0].id, report.installedBefore.pid);
  };
  await identity();
  const pages = browser.contexts().flatMap(context => context.pages()), targets = pages.filter(target => target.url().startsWith('cortex://app/'));
  assert.equal(targets.length, 1); [page] = targets; initialURL = page.url(); page.setDefaultTimeout(15000);
  const tracked = new Set();
  const watch = target => {
    if (tracked.has(target)) return; tracked.add(target);
    target.on('pageerror', error => report.pageErrors.push({ sha256: sha(error.message) }));
    target.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ sha256: sha(message.text()) }); });
    target.on('dialog', async dialog => { report.unexpectedDialogs++; await dialog.dismiss().catch(() => { report.unexpectedDialogs++; }); });
  };
  pages.forEach(watch);
  for (const context of browser.contexts()) {
    context.on('page', watch); context.on('request', request => { if (/^https?:/.test(request.url())) report.rendererHttp.push({ sha256: sha(request.url()) }); });
  }
  call = (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
    const response = await window.cortex.request({ url: `cortex://local${route}`, method, headers: body === undefined ? [] : [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status < 200 || response.status >= 300) throw new Error('Controlled native engine request refused');
    return response.body ? JSON.parse(response.body) : null;
  }, { route, method, body });
  await page.waitForFunction(() => window.cortex?.platform === 'darwin');
  rendererChanged = true; await page.evaluate(() => localStorage.setItem('cortex.locale', 'en')); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  assert(await page.evaluate(() => typeof document.startViewTransition === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches), 'Native view transitions require ordinary motion preference');
  assert.equal((await call('/api/connection')).mode, 'local');
  const models = await call('/api/catalog/providers/fake/models'); assert(models.some(model => model.id === 'reasoner' && model.capabilities.tools));
  previousProvider = await call('/api/providers/fake'); report.existingFixtureKeyPresent = previousProvider.hasKey;
  providerChanged = true; await call('/api/providers/fake', 'PATCH', { enabled: true, baseURL: 'http://127.0.0.1:9458/v1' });
  const show = hash => page.evaluate(hash => { location.hash = hash; }, hash);
  const painted = async (locator, hit = false, text = false) => {
    await expect(locator).toBeVisible();
    const measure = () => locator.evaluate((el, { hit, text }) => {
      const r = el.getBoundingClientRect(); let opaque = true, visible = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node); opaque &&= Number(style.opacity) === 1 && style.visibility === 'visible' && style.display !== 'none';
        if (node !== el) {
          const b = node.getBoundingClientRect(), left = b.left + node.clientLeft, top = b.top + node.clientTop;
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) visible &&= r.left >= left - 0.5 && r.right <= left + node.clientWidth + 0.5;
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) visible &&= r.top >= top - 0.5 && r.bottom <= top + node.clientHeight + 0.5;
        }
      }
      let textFits = true;
      if (text) {
        const range = document.createRange(); range.selectNodeContents(el); const t = range.getBoundingClientRect();
        // Font ink can extend beyond an unclipped line box; only actual clipping ancestors bound visibility.
        textFits = t.width > 0 && t.height > 0 && t.left >= 0 && t.top >= 0 && t.right <= innerWidth && t.bottom <= innerHeight;
        for (let node = el; node; node = node.parentElement) {
          const s = getComputedStyle(node), b = node.getBoundingClientRect(), left = b.left + node.clientLeft, top = b.top + node.clientTop;
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) textFits &&= t.left >= left - 0.5 && t.right <= left + node.clientWidth + 0.5;
          if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) textFits &&= t.top >= top - 0.5 && t.bottom <= top + node.clientHeight + 0.5;
        }
      }
      const hitTarget = el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      return { x: r.x, y: r.y, width: r.width, height: r.height, opaque, visible, textFits, hitTarget, ready: opaque && visible && textFits && r.width > 0 && r.height > 0 && (!hit || hitTarget) };
    }, { hit, text });
    await expect.poll(async () => (await measure()).ready).toBe(true); return measure();
  };
  const capture = async (name, theme, probes) => {
    assert.equal(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.status; }), 'loaded');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown');
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const boxes = []; for (const probe of probes) boxes.push(await painted(...probe));
    await identity(); const process = installed(); assert.equal(process.asarSHA256, expectedAsar); assert.equal(process.pid, report.installedBefore.pid);
    assert.equal(appearance(), String(theme === 'dark')); const win = nativeWindow();
    const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) }); assert(response.ok);
    const png = Buffer.from(await response.arrayBuffer()); assert(png.length > 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
    const pixels = [png.readUInt32BE(16), png.readUInt32BE(20)]; assert(pixels[0] >= 960 && pixels[1] >= 640);
    for (const probe of probes) await painted(...probe);
    assert.equal(nativeWindow().id, win.id); assert.equal(appearance(), String(theme === 'dark'));
    const file = `${name}-${theme}.png`; fs.writeFileSync(path.join(out, file), png, { flag: 'wx' });
    report.captures.push({ file, theme, native: true, viewport: [960, 640], pixels, windowID: win.id, pid: win.pid, asarSHA256: process.asarSHA256, sha256: sha(png), boxes, fontsLoaded: true, fullOpacityBeforeAndAfter: true }); save();
  };
  for (const theme of ['light', 'dark']) {
    stage = `${theme}:preview-departure`;
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    const before = await Promise.all(['/api/bots', '/api/sessions'].map(route => call(route)));
    await show(`#/work-task?shot&theme=${theme}&v=done`);
    await expect(page.locator('.travail-recap')).toBeVisible(); await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.travail-recap')).toHaveCSS('opacity', '1');
    if (await page.locator('.window').getAttribute('data-focus') === 'true') await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click();
    if (await page.locator('.window').getAttribute('data-sidebar') !== 'shown') await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
    await expect(page.locator('.variant-pick')).toBeVisible();
    const draft = 'Preserve the departing Work draft'; await page.getByTestId('composer-input').fill(draft);
    const outgoing = await page.locator('main.content').elementHandle(); assert(outgoing);
    const documentStart = await page.evaluate(() => performance.timeOrigin);
    await show(`#/code?theme=${theme}`);
    const composer = page.getByTestId('code-composer-input'); await expect(composer).toBeEditable(); await expect(composer).toHaveValue('');
    assert.equal(await page.evaluate(() => performance.timeOrigin), documentStart, 'Departure must remain same-document');
    assert.equal(await outgoing.evaluate(el => el.isConnected), false); await outgoing.dispose();
    await expect(page.locator('.travail-recap')).toHaveCount(0); await expect(page.locator('.variant-pick')).toHaveCount(0);
    await expect(page.locator('.sidebar').getByText('Nova', { exact: true })).toHaveCount(0);
    await expect(page.locator('.sidebar').getByText('cortex-web', { exact: true })).toHaveCount(0);
    await expect(page.locator('main .ctx').filter({ hasText: 'cortex-web' })).toHaveCount(0);
    await expect(page.getByTestId('code-pick-folder')).toBeEnabled();
    assert.deepEqual(await Promise.all(['/api/bots', '/api/sessions'].map(route => call(route))), before, 'Preview must not seed or mutate live engine lists');
    assert.deepEqual(report.pageErrors, []);
    await capture('preview-to-live-code', theme, [[composer, true], [page.getByTestId('code-pick-folder'), true], [page.locator('main .home h1'), false, true]]);
    record('Work-done-preview-departs-to-live-Code', { theme, sameDocument: true, oldTreeDetached: true, fixtureControlsAbsent: true, engineListsUnchanged: true, nativeTransitionAvailable: true });

    stage = `${theme}:real-writes`;
    const planned = files(theme); assert(disk(theme, true).every(row => row.absent));
    const session = await call('/api/sessions', 'POST', { title: `Code viewport ${theme}`, kind: 'code', agent: 'build', directory: health.project, model: { providerID: 'fake', modelID: 'reasoner' } });
    assert.equal(session.directory, health.project); assert.equal(session.kind, 'code');
    activeSession = session.id; report.sessionIDs.push(session.id); save();
    await show(`#/code-session?id=${session.id}&theme=${theme}`);
    await expect(page.locator('main .content-top .title')).toHaveText(`Code viewport ${theme}`);
    await expect(page.locator('.split-r')).toBeVisible();
    await expect(composer).toBeEditable(); await composer.fill(prompt(health.runID, theme)); await composer.press('Enter');
    const messages = () => call(`/api/sessions/${session.id}/messages`);
    const tools = async () => (await messages()).flatMap(message => message.parts.filter(part => part.type === 'tool'));
    const diffs = page.locator('.split-r > .diff');
    for (const [index, file] of planned.entries()) {
      await expect.poll(async () => (await call('/api/permissions')).filter(permission => permission.sessionID === session.id).map(permission => ({ tool: permission.tool, pattern: permission.pattern, callID: permission.callID })))
        .toEqual([{ tool: 'write', pattern: `${health.project}/${file.path}`, callID: callID(health.runID, theme, index) }]);
      const once = page.getByTestId('permission-allow-once'); await expect(once).toHaveCount(1); await expect(once).toBeEnabled(); await once.click();
      await expect.poll(async () => (await tools())[index]?.state.status).toBe('completed'); await expect(diffs).toHaveCount(index + 1);
      const result = (await tools())[index]; assert.equal(result.tool, 'write'); assert.deepEqual(result.state.input, file);
      assert.equal(result.state.output, `Wrote ${file.content.length} characters to ${health.project}/${file.path}`);
    }
    await expect(page.getByText('All files written.', { exact: true })).toBeVisible();
    await expect.poll(async () => (await messages()).at(-1)?.info.time.completed).toBeDefined();
    assert(!(await messages()).some(message => message.info.error)); assert.equal((await tools()).length, 2);
    assert.equal((await call('/api/permissions')).filter(permission => permission.sessionID === session.id).length, 0); activeSession = undefined;
    const verifiedFiles = disk(theme); assert(verifiedFiles.every(row => row.exact)); assert.deepEqual(verifiedFiles.map(row => row.lines), [1, 161]);
    const receipt = backend('receipt'); assert.equal(receipt.runID, health.runID); assert.equal(receipt.errors, 0);
    const rows = receipt.requests.filter(row => row.theme === theme); assert.deepEqual(rows.map(row => row.phase), ['short', 'long', 'complete']);
    assert(rows.every(row => row.modelExact && row.toolResultsExact));
    record('two-real-write-approvals-and-exact-disk-bytes', { theme, approvals: 2, files: verifiedFiles, providerRows: rows });

    stage = `${theme}:asymmetric-diff-wheel`;
    await page.getByRole('tab', { name: 'Changes', exact: true }).click(); await expect(diffs).toHaveCount(2); await page.evaluate(() => document.fonts.ready);
    const short = diffs.nth(0), long = diffs.nth(1), shortHead = short.locator('.code-head'), longHead = long.locator('.code-head'), pre = long.locator('pre');
    await expect(short.locator('pre > div')).toHaveCount(1); await expect(pre.locator(':scope > div')).toHaveCount(161);
    await expect(shortHead.locator('span')).toHaveText(planned[0].path); await expect(longHead.locator('span')).toHaveText(planned[1].path);
    const headersBefore = [await painted(shortHead, true), await painted(longHead, true)];
    for (const head of [shortHead, longHead]) {
      assert(await head.evaluate(el => { const h = el.getBoundingClientRect(), card = el.parentElement.getBoundingClientRect(); return h.top >= card.top && h.bottom <= card.bottom; }), 'Header must remain inside its own card');
    }
    assert(headersBefore[0].y + headersBefore[0].height <= headersBefore[1].y, 'Headers overlap');
    const box = await painted(pre, true), scroll = await pre.evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight }));
    assert.equal(scroll.top, 0); assert(scroll.height > scroll.client, 'Long body must have genuine scroll overflow');
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 20)); await page.mouse.wheel(0, scroll.height);
    await expect.poll(() => pre.evaluate(el => el.scrollTop > 0 && Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1)).toBe(true);
    const shortTail = short.locator('pre > div').last(), longTail = pre.locator(':scope > div').last();
    await expect(shortTail).toHaveText(`+${planned[0].content}`); await expect(longTail).toHaveText(`+DIFF END ${theme}`);
    await painted(shortTail, true, true); await painted(longTail, true, true);
    for (const [index, head] of [shortHead, longHead].entries()) assert(Math.abs((await painted(head, true)).y - headersBefore[index].y) <= 0.5, 'Wheel must scroll the body, not its header');
    const probes = [[shortHead, true], [longHead, true], [shortHead.locator('span'), true, true], [longHead.locator('span'), true, true],
      [shortHead.getByRole('button', { name: 'Copy path', exact: true }), true], [longHead.getByRole('button', { name: 'Copy path', exact: true }), true], [shortTail, true, true], [longTail, true, true]];
    await capture('code-asymmetric-diffs', theme, probes);
    record('asymmetric-diffs-keep-headers-and-wheel-reveal-entire-tail', { theme, unequalLines: [1, 161], bodyWheelScrolled: true, bothHeadersReadable: true, bothLastLinesFullyVisible: true });
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.rendererHttp, []);
  }
  report.backendReceipt = backend('receipt'); assert.equal(report.backendReceipt.errors, 0); assert.equal(report.backendReceipt.requests.length, 6);
  assert.equal(report.captures.length, 4); assert.equal(report.unexpectedDialogs, 0);
  report.installedAfter = installed(); assert.equal(report.installedAfter.asarSHA256, expectedAsar); assert.equal(report.installedAfter.pid, report.installedBefore.pid);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = { stage, message: String(error?.message ?? error), sha256: sha(String(error?.message ?? error)) };
} finally {
  if (activeSession && call) try { await call(`/api/sessions/${activeSession}/abort`, 'POST'); report.cleanup.ownPendingSessionAborted = true; }
  catch (error) { report.status = 'failed'; report.cleanup.abortFailureSHA256 = sha(String(error?.message ?? error)); }
  if (providerChanged && call) try {
    const restored = await call('/api/providers/fake', 'PATCH', { enabled: previousProvider.enabled, baseURL: previousProvider.baseURL ?? null });
    assert.equal(restored.enabled, previousProvider.enabled); assert.equal(restored.baseURL, previousProvider.baseURL); assert.equal(restored.hasKey, previousProvider.hasKey); report.cleanup.providerRestored = true;
  } catch (error) { report.status = 'failed'; report.cleanup.providerFailureSHA256 = sha(String(error?.message ?? error)); }
  if (rendererChanged && page) try {
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'`);
    await page.evaluate(() => { localStorage.setItem('cortex.locale', 'en'); localStorage.setItem('cortex.theme', 'dark'); });
    const url = new URL(initialURL), [route, query] = url.hash.split('?'), params = new URLSearchParams(query); params.set('theme', 'dark'); url.hash = `${route || '#/home'}?${params}`;
    await page.goto(url.href); await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    assert.equal(appearance(), 'true'); report.cleanup.originalRouteEnglishDark = true;
  } catch (error) { report.status = 'failed'; report.cleanup.rendererFailureSHA256 = sha(String(error?.message ?? error)); }
  if (report.pageErrors.length || report.consoleErrors.length || report.rendererHttp.length || report.unexpectedDialogs) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.scope = 'Future fixed installed artifact; ordinary same-document Work-preview departure, real main inference and approved writes, asymmetric native Code diff viewports. Controlled local model, not hosted inference. Native pixels/build provenance require coordinator review.'; save();
}
console.log(`Code viewport native: ${report.status}; stage ${stage}; ${path.join(out, 'manifest.json')}`);
// Disconnect by exiting this client only; leave the installed app, native helper and backend running.
process.exit(report.status === 'passed' ? 0 : 1);
