// Prepared installed-app checks; execution belongs to the coordinator.
// Requires Swift + Accessibility access in the existing Mac SSH session. Native checks fail closed.
// AX/CG clearance cannot certify compositor pixels; inspect the refreshed wipe images before acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: {
  out: { type: 'string' }, repo: { type: 'string' }, 'expected-asar': { type: 'string' },
  'ssh-host': { type: 'string', default: 'mac-live' },
} });
assert(args.out && path.isAbsolute(args.out), '--out requires a new absolute directory');
assert(args.repo && path.isAbsolute(args.repo), '--repo requires an absolute checkout');
assert(/^[a-f0-9]{64}$/.test(args['expected-asar'] ?? ''), '--expected-asar requires the installed artifact SHA-256');
assert(/^[a-zA-Z0-9][a-zA-Z0-9._@-]*$/.test(args['ssh-host']), 'Invalid SSH host');
const out = path.resolve(args.out), repo = fs.realpathSync(args.repo);
assert(!fs.existsSync(out), 'Output already exists; choose a new directory');
assert(out !== repo && !out.startsWith(`${repo}${path.sep}`), 'Output must be outside the repository');
fs.mkdirSync(out, { recursive: true });
const sha = data => createHash('sha256').update(data).digest('hex');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args['ssh-host'], command],
  { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const CDP = 'http://127.0.0.1:19444', CAPTURE = 'http://127.0.0.1:19445';
const F9_ASAR = '23decdd0596b89e8e83284b62f6e7f0eb5314b081ccf178f7dde31c8ac04af77';
const MISSING = 'mem_00000000000000000000000000000000';
const KEY = 'sk-test-native-recovery-5678';
const labels = { add: 'Add', draft: 'New memory…', saveError: 'Couldn’t save. Try again.',
  deleteError: 'Couldn’t forget this memory', forgotten: 'Memory forgotten', erased: 'Memory erased',
  empty: 'Empty memory', wipe: 'Forget everything', loadError: 'Couldn’t load this', retry: 'Try again' };
const manifest = {
  startedAt: new Date().toISOString(), status: 'running', expectedASAR: args['expected-asar'], priorF9ASAR: F9_ASAR,
  scriptSHA256: sha(fs.readFileSync(new URL(import.meta.url))), sources: [], sourceAssertions: [],
  checks: [], captures: [], pageErrors: [], consoleErrors: [], unexpectedDialogs: 0, acceptedConfirmations: 0, nativeWindowChecks: [],
  limits: ['English, one installed window, isolated synthetic data; no real-provider requests or remote-inference proof.',
    'Approval recovery ends at a genuinely empty list; pending-permission coverage belongs to separate CI.',
    'ASAR equality pins installed bytes; local source hashes alone do not attest build-to-source provenance.',
    'No CSS, DOM content, response data, clocks or screenshot pixels are rewritten. Request routing/timing faults are explicit.',
    'Native AX/CG checks bracket captures; stale compositor pixels still require review of every original, especially partial wipes.'],
};
let browser, page, expect, stage = 'source-contract', windowID, confirmExpected = false, confirmations = 0;
let originalDark, failed = false;
const checkpoint = () => fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const record = (name, details = {}) => { manifest.checks.push({ name, ...details }); checkpoint(); };
const source = relative => {
  const bytes = fs.readFileSync(path.join(repo, relative));
  manifest.sources.push({ path: relative, sha256: sha(bytes) });
  return bytes.toString();
};
const contract = (name, ok) => { manifest.sourceAssertions.push({ name, passed: !!ok }); assert(ok, name); };

// Inspect only required process fields; never return a process environment, command line or credentials.
const installed = () => JSON.parse(ssh('python3 -', `
import hashlib,json,pathlib,re,subprocess
binary='/Applications/Cortex.app/Contents/MacOS/Cortex'
processes=[]
for line in subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines():
    fields=line.strip().split(None,1)
    if len(fields)==2 and fields[1]==binary: processes.append(int(fields[0]))
result={'processCount':len(processes)}
with pathlib.Path('/Applications/Cortex.app/Contents/Resources/app.asar').open('rb') as f:
    h=hashlib.sha256()
    for block in iter(lambda:f.read(1048576),b''): h.update(block)
result['asarSHA256']=h.hexdigest()
if len(processes)==1:
    result['pid']=processes[0]
    command=subprocess.check_output(['ps','eww','-p',str(processes[0]),'-o','command='],text=True)
    match=re.search(r'(?:^|\\s)CORTEX_CATALOG_URL=(\\S+)',command)
    value=match.group(1) if match else ''
    result['catalogDataURL']=value.startswith('data:application/json,')
    result['catalogURLSHA256']=hashlib.sha256(value.encode()).hexdigest()
    result['isolatedDataConfigured']=bool(re.search(r'(?:^|\\s)CORTEX_DATA_DIR=\\S+',command))
    result['isolatedProfileConfigured']='--user-data-dir=' in command
print(json.dumps(result))
`));

// One SSH call per predicate wait; bounded native polling, never a blind post-dialog delay.
// Inspect native AX children/sheets, not renderer AXWebArea content or arbitrary labels/values.
const nativeWindowClear = label => {
  const probe = `import Foundation
import ApplicationServices
import CoreGraphics
let pid = pid_t(CommandLine.arguments[1])!
let target = Int(CommandLine.arguments[2])!
let app = AXUIElementCreateApplication(pid)
let timeoutStatus = AXUIElementSetMessagingTimeout(AXUIElementCreateSystemWide(), 0.25)
let started = ProcessInfo.processInfo.systemUptime
let deadline = started + 10
func sample() -> [String: Any] {
  guard AXIsProcessTrusted() else { return ["clear": false, "trusted": false] }
  guard timeoutStatus == .success else { return ["clear": false, "trusted": true, "errors": ["messaging-timeout-unavailable"]] }
  var errors = [String](), roots = [[String: Any]](), blockers = [[String: Any]]()
  func value(_ element: AXUIElement, _ name: String, optional: Bool = false) -> CFTypeRef? {
    guard ProcessInfo.processInfo.systemUptime < deadline else { errors.append("native-read-deadline"); return nil }
    var result: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, name as CFString, &result)
    if error != .success && !(optional && (error == .attributeUnsupported || error == .noValue)) {
      errors.append("\\(name):\\(error.rawValue)")
    }
    return result
  }
  let frontmost = value(app, kAXFrontmostAttribute) as? Bool == true
  let windows = value(app, kAXWindowsAttribute) as? [AXUIElement] ?? []
  var queue = windows, visited = [AXUIElement](), sheetCount = 0
  while !queue.isEmpty {
    if visited.count >= 512 || ProcessInfo.processInfo.systemUptime >= deadline { errors.append("native-tree-limit"); break }
    let element = queue.removeFirst()
    if visited.contains(where: { CFEqual($0, element) }) { continue }
    visited.append(element)
    let root = windows.contains(where: { CFEqual($0, element) })
    let role = value(element, kAXRoleAttribute) as? String ?? ""
    let subrole = value(element, kAXSubroleAttribute, optional: true) as? String ?? ""
    let modal = value(element, kAXModalAttribute, optional: !root) as? Bool
    let info: [String: Any] = ["role": role, "subrole": subrole, "modal": modal ?? false, "modalKnown": modal != nil]
    if root { roots.append(info) }
    if role.isEmpty { errors.append("missing-role") }
    if role == "AXSheet" { sheetCount += 1 }
    if modal == true || ["AXSheet", "AXDialog", "AXAlert"].contains(role) || ["AXDialog", "AXSystemDialog"].contains(subrole) { blockers.append(info) }
    if role == "AXWebArea" { continue }
    queue += value(element, kAXChildrenAttribute, optional: !root) as? [AXUIElement] ?? []
  }
  let cg = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]]
  if cg == nil { errors.append("window-list-unavailable") }
  let ids = (cg ?? []).filter { $0["kCGWindowOwnerPID"] as? Int == Int(pid) && $0["kCGWindowLayer"] as? Int == 0 }
    .compactMap { $0["kCGWindowNumber"] as? Int }.sorted()
  let standard = roots.count == 1 && roots[0]["role"] as? String == "AXWindow" && roots[0]["subrole"] as? String == "AXStandardWindow"
    && roots[0]["modalKnown"] as? Bool == true && roots[0]["modal"] as? Bool == false
  return ["clear": frontmost && standard && ids == [target] && sheetCount == 0 && blockers.isEmpty && errors.isEmpty,
    "trusted": true, "frontmost": frontmost, "axWindowCount": windows.count, "roots": roots, "sheetCount": sheetCount,
    "blockers": blockers, "cgLayerZeroWindowIDs": ids, "nativeNodesVisited": visited.count, "errors": errors]
}
var first: [String: Any]?, last = [String: Any](), consecutive = 0, polls = 0
repeat {
  last = sample(); polls += 1
  if first == nil { first = last }
  consecutive = last["clear"] as? Bool == true ? consecutive + 1 : 0
  if consecutive >= 2 || last["trusted"] as? Bool == false { break }
  let remaining = deadline - ProcessInfo.processInfo.systemUptime
  if remaining > 0 { Thread.sleep(forTimeInterval: min(0.1, remaining)) }
} while ProcessInfo.processInfo.systemUptime < deadline
let result: [String: Any] = ["clear": consecutive >= 2, "polls": polls, "consecutiveClear": consecutive, "first": first!, "last": last,
  "elapsedMs": Int((ProcessInfo.processInfo.systemUptime - started) * 1000)]
print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
`;
  const result = JSON.parse(ssh(`swift - ${manifest.installedBefore.pid} ${windowID}`, probe));
  const index = manifest.nativeWindowChecks.length;
  manifest.nativeWindowChecks.push({ label, pid: manifest.installedBefore.pid, windowID, acceptedConfirmations: confirmations, ...result });
  checkpoint();
  assert.equal(result.clear, true, `Native modal/window clearance failed: ${label}; inspect nativeWindowChecks`);
  return index;
};

try {
  const team = source('packages/app/src/screens/bots/team.tsx');
  const desk = source('packages/app/src/screens/work/desk.tsx');
  const projects = source('packages/app/src/screens/system/projects.tsx');
  const settings = source('packages/app/src/screens/system/settings.tsx');
  source('packages/app/src/screens/system/system.css');
  const bridge = source('packages/app/src/api.ts');
  source('packages/core/src/bot.ts');
  source('packages/protocol/src/index.ts');
  source('packages/desktop/src/preload.ts');
  source('tests/e2e/memory-safety.spec.ts');
  source('tests/e2e/approvals-recovery.spec.ts');
  source('tests/e2e/ui-flows.spec.ts');
  const botsCopy = JSON.parse(source('packages/i18n/locales/en/bots.json'));
  const systemCopy = JSON.parse(source('packages/i18n/locales/en/system.json'));
  const workCopy = JSON.parse(source('packages/i18n/locales/en/work.json'));
  const commonCopy = JSON.parse(source('packages/i18n/locales/en/common.json'));
  const catalog = JSON.parse(source('packages/core/test/fixtures/catalog.json'));
  contract('memory settles every delete and serializes mutations', team.includes('Promise.allSettled') && team.includes('memoryWrite.current') && team.includes('readOnly={memoryBusy}'));
  contract('memory errors use accepted-write and failed-delete paths', team.includes('await api.bots.memory.add') && team.includes('system.memory.forgetFailed'));
  contract('System memory retains refused rows and tracks pending deletes', projects.includes('deleting.current') && projects.includes('system.memory.forgetFailed') && projects.includes('pending.includes(m.id)'));
  contract('approval error branch offers Retry', desk.includes('perms.state === "error"') && desk.includes('onClick={perms.reload}'));
  contract('model rows expose real context/cost and capability selectors', settings.includes('data-model-id={m.id}') && settings.includes('system.providers.cost'));
  contract('request text hook precedes real IPC request', bridge.includes('new Request(input, init)') && bridge.includes('await req.text()') && bridge.includes('await b.request('));
  contract('English labels match source', botsCopy['set.newMemory'] === labels.draft && botsCopy['set.toastWiped'] === labels.erased
    && botsCopy.toastForgotten === labels.forgotten && systemCopy['memory.forgetFailed'] === labels.deleteError
    && workCopy['error.save'] === labels.saveError && workCopy['error.loadTitle'] === labels.loadError && commonCopy.retry === labels.retry);
  contract('deterministic fake fixture is loopback-only', catalog.fake.api === 'http://127.0.0.1:1/v1'
    && catalog.fake.models.reasoner.limit.context === 100000 && catalog.fake.models.reasoner.cost.input === 1 && catalog.fake.models.reasoner.cost.output === 2);
  const catalogURL = `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;
  manifest.catalogURLSHA256 = sha(catalogURL);
  manifest.sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  manifest.sourceBinding = 'Local file snapshots; coordinator supplies artifact/source build receipt separately.';

  stage = 'installed-identity';
  manifest.installedBefore = installed(); checkpoint();
  assert.equal(manifest.installedBefore.processCount, 1, 'Exactly one installed Cortex main process required');
  assert.equal(manifest.installedBefore.asarSHA256, args['expected-asar']);
  assert(manifest.installedBefore.catalogDataURL && manifest.installedBefore.isolatedDataConfigured && manifest.installedBefore.isolatedProfileConfigured);
  assert.equal(manifest.installedBefore.catalogURLSHA256, manifest.catalogURLSHA256, 'Launch with the documented catalog data URL');

  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir =>
    fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs')));
  assert(modules, 'Existing Playwright and @playwright/test installations required');
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
  ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href));
  expect = expect.configure({ timeout: 15000 });
  stage = 'CDP-attach';
  browser = await chromium.connectOverCDP(CDP, { timeout: 20000 });
  const pages = browser.contexts().flatMap(context => context.pages());
  const candidates = pages.filter(p => p.url().startsWith('cortex://app/'));
  assert.equal(candidates.length, 1, 'Exactly one Cortex renderer required');
  [page] = candidates;
  const tracked = new Set();
  const track = p => {
    if (tracked.has(p)) return;
    const index = tracked.size; tracked.add(p);
    manifest.pagesObserved = tracked.size;
    p.on('pageerror', error => manifest.pageErrors.push({ page: index, messageSHA256: sha(error.message) }));
    p.on('console', message => { if (message.type() === 'error') manifest.consoleErrors.push({ page: index, textSHA256: sha(message.text()) }); });
  };
  pages.forEach(track);
  browser.contexts().forEach(context => context.on('page', track));
  page.setDefaultTimeout(15000);
  page.on('dialog', async dialog => {
    try {
      if (confirmExpected && dialog.type() === 'confirm') {
        confirmExpected = false;
        // CDP acceptance resolves JavaScript but can leave Electron's native sheet mounted.
        ssh(`osascript -e 'tell application "System Events" to tell process "Cortex"
          repeat 100 times
            if exists button "OK" of sheet 1 of window 1 then
              click button "OK" of sheet 1 of window 1
              return
            end if
            delay 0.05
          end repeat
          error "Expected memory confirmation sheet missing"
        end tell'`);
        confirmations++; manifest.acceptedConfirmations = confirmations; checkpoint();
      }
      else { manifest.unexpectedDialogs++; await dialog.dismiss(); }
    } catch { manifest.unexpectedDialogs++; }
  });
  await page.goto('cortex://app/index.html#/home');
  await page.waitForFunction(() => !!window.__bridgeFetch && window.cortex?.platform === 'darwin');
  await page.evaluate(() => localStorage.setItem('cortex.locale', 'en'));
  await page.reload();
  await page.waitForFunction(() => !!window.__bridgeFetch);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.bringToFront();
  originalDark = ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
  assert(['true', 'false'].includes(originalDark));
  ssh(`osascript -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960, 640}'`);
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
  if (await page.locator('.window').getAttribute('data-focus') === 'true') await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click();
  if (await page.locator('.window').getAttribute('data-sidebar') !== 'shown') await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();

  // Setup and independent reads use the unmodified preload. No bodies/keys/engine messages enter receipts.
  const request = (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
    const wire = await window.cortex.request({ url: `cortex://local${route}`, method,
      headers: body === undefined ? [] : [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: wire.status, data: wire.body ? JSON.parse(wire.body) : null };
  }, { route, method, body });
  const call = async (...input) => { const r = await request(...input); assert(r.status >= 200 && r.status < 300, 'Setup/read engine request refused'); return r.data; };
  for (const route of ['/api/sessions', '/api/tasks', '/api/bots', '/api/providers', '/api/permissions']) assert.deepEqual(await call(route), [], 'Fresh isolated engine required');
  assert.equal((await call('/api/connection')).mode, 'local');
  const models = await call('/api/catalog/providers/fake/models');
  assert.equal(models.length, 2);
  const reasoner = models.find(m => m.id === 'reasoner');
  assert.equal(reasoner?.capabilities.contextWindow, 100000);
  assert.equal(reasoner.capabilities.cost.input, 1); assert.equal(reasoner.capabilities.cost.output, 2);
  for (const cap of ['reasoning', 'imageInput', 'tools']) assert.equal(reasoner.capabilities[cap], true);
  const config = await call('/api/providers/fake/key', 'PUT', { key: KEY });
  assert(config.hasKey && config.keyHint === '5678' && !JSON.stringify(config).includes(KEY));
  record('isolated-local-engine-and-catalog', { fakeModels: 2, keyWriteAccepted: true, publicHintOnly: true });

  // ponytail: one English installed renderer; expand only when more profiles/locales are requested.
  // Delay/redirect requests, observe original JSON, never synthesize or edit an engine response.
  await page.evaluate(missing => {
    const RequestOriginal = window.Request, jsonOriginal = Response.prototype.json;
    const state = { botID: '', wrongID: '', holdID: '', holdAdd: false, approvals: false, requests: [], responses: [], releases: [], approvalRewrites: 0 };
    window.__recoveryNative = state;
    window.Request = class extends RequestOriginal {
      constructor(input, init) {
        const request = new RequestOriginal(input, init), url = new URL(request.url);
        let redirect = false;
        if (state.wrongID && request.method === 'DELETE' && url.pathname === `/api/bots/${state.botID}/memory/${state.wrongID}`) {
          url.pathname = `/api/bots/${state.botID}/memory/${missing}`; redirect = true;
        }
        if (state.approvals && request.method === 'GET' && url.pathname === '/api/permissions') {
          url.pathname += '/missing-native-recovery'; redirect = true; state.approvalRewrites++;
        }
        super(redirect ? url.href : request, redirect ? { method: request.method, headers: request.headers, signal: request.signal } : undefined);
      }
      async text() {
        const body = await super.text(), url = new URL(this.url);
        const match = url.pathname.match(/^\/api\/bots\/([^/]+)\/memory(?:\/([^/]+))?$/);
        if (match?.[1] === state.botID && ['POST', 'DELETE'].includes(this.method)) {
          const entry = { method: this.method, redirected: match[2] === missing, held: false, dispatched: false };
          state.requests.push(entry);
          if ((this.method === 'POST' && state.holdAdd) || (this.method === 'DELETE' && state.holdID === match[2])) {
            entry.held = true;
            await new Promise(resolve => state.releases.push(resolve));
          }
          entry.dispatched = true;
        }
        return body;
      }
    };
    Response.prototype.json = async function () {
      const value = await jsonOriginal.call(this);
      if (this.status >= 400 || (this.status === 201 && value?.botID === state.botID) || (this.status === 200 && value?.ok === true)) {
        state.responses.push({ status: this.status, ...(this.status >= 400 ? { code: value?.error?.code === 'not_found' ? 'not_found' : 'other' } : {}) });
      }
      return value;
    };
    state.release = () => { state.holdAdd = false; state.holdID = ''; state.releases.splice(0).forEach(resolve => resolve()); };
    state.restore = () => { state.release(); window.Request = RequestOriginal; Response.prototype.json = jsonOriginal; };
  }, MISSING);
  const gate = options => page.evaluate(options => {
    const s = window.__recoveryNative;
    if (s.releases.length) throw new Error('Pending gate must be released before changing phase');
    Object.assign(s, { botID: '', wrongID: '', holdID: '', holdAdd: false, approvals: false, requests: [], responses: [], approvalRewrites: 0 }, options);
  }, options);
  const observed = () => page.evaluate(() => {
    const { requests, responses, approvalRewrites, releases } = window.__recoveryNative;
    return { requests, responses, approvalRewrites, pending: releases.length };
  });
  const release = () => page.evaluate(() => window.__recoveryNative.release());
  const show = async (route, theme) => {
    await page.evaluate(({ route, theme }) => history.pushState(null, '', `#/${route}${route.includes('?') ? '&' : '?'}theme=${theme}`), { route, theme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.evaluate(() => document.fonts.ready);
  };
  const notice = title => page.locator('.toast').filter({ has: page.getByText(title, { exact: true }) });
  const holdNotice = async title => { const toast = notice(title); await expect(toast).toBeVisible(); await toast.hover(); return toast; };
  const drainNotices = async () => { await page.locator('main .content-top').hover(); await expect(page.locator('.toast')).toHaveCount(0, { timeout: 20000 }); };
  const center = async locator => {
    await expect(locator).toBeVisible(); await expect(locator).toBeInViewport({ ratio: 1 });
    const rect = await locator.evaluate(el => {
      const r = el.getBoundingClientRect();
      let opacity = 1;
      for (let node = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      return { x: r.x, y: r.y, width: r.width, height: r.height, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        opacity, inputVisible: !('value' in el) || (el.scrollWidth <= el.clientWidth + 1 && el.scrollLeft === 0) };
    });
    assert(rect.hit && rect.width > 0 && rect.height > 0 && rect.opacity > 0.05 && rect.inputVisible, 'Control/input is clipped, transparent or obstructed');
    return rect;
  };
  const capture = async (name, theme, controls, toast) => {
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const centers = [];
    for (const control of controls) centers.push(await center(control));
    if (toast) { await toast.hover(); await center(toast); }
    const nativeBefore = nativeWindowClear(`${name}-${theme}:before-capture`);
    const response = await fetch(`${CAPTURE}/${windowID}`, { method: 'POST', signal: AbortSignal.timeout(30000) });
    assert(response.ok, 'Native capture helper refused');
    const png = Buffer.from(await response.arrayBuffer());
    assert(png.length > 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Native helper did not return PNG');
    const pixelWidth = png.readUInt32BE(16), pixelHeight = png.readUInt32BE(20);
    assert(pixelWidth >= 960 && pixelHeight >= 640, 'Native capture unexpectedly small');
    const nativeAfter = nativeWindowClear(`${name}-${theme}:after-capture`);
    for (const control of controls) await center(control);
    if (toast) await center(toast);
    const file = `${name}-${theme}.png`;
    fs.writeFileSync(path.join(out, file), png, { flag: 'wx' });
    manifest.captures.push({ file, sha256: sha(png), theme, viewport: [960, 640], pixels: [pixelWidth, pixelHeight], windowID,
      controlCenters: centers, visibleBeforeAndAfter: true, native: true, toastHeldByPointer: !!toast,
      nativeWindowChecks: [nativeBefore, nativeAfter], acceptedConfirmations: confirmations });
    checkpoint();
  };
  const swift = `import CoreGraphics
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in windows where w["kCGWindowOwnerPID"] as? Int == ${manifest.installedBefore.pid} && w["kCGWindowLayer"] as? Int == 0 {
  let b = w["kCGWindowBounds"] as! [String: Any]
  if b["Width"] as? Int == 960 && b["Height"] as? Int == 640 { print(w["kCGWindowNumber"] as! Int) }
}`;
  const ids = ssh(`swift -e ${quote(swift)} 2>/dev/null`).split(/\s+/);
  assert(ids.length === 1 && /^\d+$/.test(ids[0]), 'One visible 960x640 native Cortex window required');
  windowID = Number(ids[0]);
  const memory = id => call(`/api/bots/${id}/memory`);
  const draft = page.getByPlaceholder(labels.draft, { exact: true });
  const add = page.locator('.pg-panel').getByRole('button', { name: labels.add, exact: true });
  const wipe = page.locator('.pg-panel').getByRole('button', { name: labels.wipe, exact: true });
  const rows = page.locator('.pg-panel input[readonly]');
  const forget = () => page.locator('.pg-panel').getByRole('button', { name: 'Forget', exact: true });
  const wipeOnce = async () => {
    const before = confirmations; confirmExpected = true; await wipe.click();
    await expect.poll(() => confirmations).toBe(before + 1); assert.equal(confirmExpected, false);
    nativeWindowClear(`${stage}:confirmation-${confirmations}-accepted`);
  };

  for (const theme of ['light', 'dark']) {
    stage = `${theme}:setup`;
    ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}'`);
    await show('home', theme);
    await expect(page.locator('.home .composer')).toBeVisible();
    const owners = {};
    for (const name of ['Removed', 'Accepted', 'Partial']) owners[name] = await call('/api/bots', 'POST', { name: `${name} memory check ${theme}`, model: { providerID: 'fake', modelID: 'reasoner' } });
    const survivor = await call(`/api/bots/${owners.Partial.id}/memory`, 'POST', { content: 'Keep this survivor.' });
    const removed = await call(`/api/bots/${owners.Partial.id}/memory`, 'POST', { content: 'Delete this note.' });
    for (const owner of Object.values(owners)) assert(!(await memory(owner.id)).some(m => m.id === MISSING));

    stage = `${theme}:add-deleted-owner`;
    await show(`bot-settings?id=${owners.Removed.id}&v=memory`, theme);
    await expect(page.locator('.content-top .title')).toHaveText(`${owners.Removed.name} settings`);
    await expect(page.getByText(labels.empty, { exact: true })).toBeVisible();
    await add.click(); const exactDraft = '  Keep this memory.  '; await draft.fill(exactDraft);
    await call(`/api/bots/${owners.Removed.id}`, 'DELETE');
    await gate({ botID: owners.Removed.id }); await draft.press('Enter');
    let toast = await holdNotice(labels.saveError);
    await expect(draft).toHaveValue(exactDraft); await expect(draft).toBeEditable();
    await expect.poll(async () => (await observed()).responses).toEqual([{ status: 404, code: 'not_found' }]);
    assert.equal((await observed()).requests.length, 1); assert.equal((await request(`/api/bots/${owners.Removed.id}`)).status, 404);
    await capture('memory-add-refused', theme, [draft], toast);
    record('add-real-deleted-owner-404-retains-exact-draft', { theme, wire: await observed() });
    await draft.press('Escape'); await drainNotices();

    stage = `${theme}:add-serialized`;
    await show(`bot-settings?id=${owners.Accepted.id}&v=memory`, theme);
    await expect(page.locator('.content-top .title')).toHaveText(`${owners.Accepted.name} settings`);
    await expect(draft).toHaveCount(0); await expect(page.getByText(labels.empty, { exact: true })).toBeVisible();
    await add.click(); await draft.fill(exactDraft); await gate({ botID: owners.Accepted.id, holdAdd: true });
    await draft.evaluate(el => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); el.blur(); });
    await expect.poll(async () => (await observed()).requests.length).toBe(1);
    await expect(draft).toHaveValue(exactDraft); await expect(draft).toHaveJSProperty('readOnly', true); await expect(draft).toHaveAttribute('aria-busy', 'true'); await expect(add).toBeDisabled();
    await draft.press('Escape'); await expect(draft).toHaveValue(exactDraft);
    await draft.press('Home');
    assert.deepEqual(await memory(owners.Accepted.id), []); assert.equal((await observed()).pending, 1);
    await capture('memory-add-pending', theme, [draft, add]);
    const held = await observed(); await release();
    await expect(draft).toHaveCount(0); await expect(rows).toHaveCount(1); await expect(rows).toHaveValue(exactDraft.trim());
    await expect.poll(async () => (await observed()).responses).toEqual([{ status: 201 }]);
    const accepted = await memory(owners.Accepted.id);
    assert.equal(accepted.length, 1); assert.equal(accepted[0].content, exactDraft.trim()); assert.equal(accepted[0].botID, owners.Accepted.id);
    assert.equal((await observed()).requests.length, 1);
    record('duplicate-enter-blur-pending-one-accepted-write', { theme, held, wire: await observed(), exactOwnerAndSinglePersistedEntry: true });

    stage = `${theme}:single-delete`;
    owners.Single = await call('/api/bots', 'POST', { name: `Single memory check ${theme}`, model: { providerID: 'fake', modelID: 'reasoner' } });
    assert.equal((await call('/api/bots'))[0]?.id, owners.Single.id, 'System memory must resolve the intended latest Bot');
    const single = await call(`/api/bots/${owners.Single.id}/memory`, 'POST', { content: 'Retain this note.' });
    assert.notEqual(single.id, MISSING);
    // Leave BotSettings so its Bot list includes this newly created owner on remount.
    await show('home', theme); await expect(page.locator('.home .composer')).toBeVisible();
    await show(`bot-settings?id=${owners.Single.id}&v=memory`, theme);
    await expect(page.locator('.content-top .title')).toHaveText(`${owners.Single.name} settings`);
    await expect(rows).toHaveCount(1); await expect(rows).toHaveValue(single.content);
    await gate({ botID: owners.Single.id, wrongID: single.id }); await forget().click(); toast = await holdNotice(labels.deleteError);
    await expect(notice(labels.forgotten)).toHaveCount(0); await expect(notice(labels.erased)).toHaveCount(0);
    await expect.poll(async () => (await observed()).responses).toEqual([{ status: 404, code: 'not_found' }]);
    await expect(rows).toHaveValue(single.content); await expect(forget()).toBeEnabled(); assert.deepEqual(await memory(owners.Single.id), [single]);
    const refused = await observed(); assert.equal(refused.requests.length, 1); assert.equal(refused.requests[0].redirected, true);
    await drainNotices(); await gate({ botID: owners.Single.id, wrongID: single.id });
    await show('memory', theme);
    const systemRow = page.locator('.systeme-mem'), systemForget = systemRow.getByRole('button', { name: 'Forget', exact: true });
    await expect(systemRow).toHaveCount(1); await expect(systemRow).toContainText(single.content);
    await systemForget.click(); toast = await holdNotice(labels.deleteError);
    await expect(notice(labels.forgotten)).toHaveCount(0); await expect(systemRow).toContainText(single.content); await expect(systemForget).toBeEnabled();
    await expect.poll(async () => (await observed()).responses).toEqual([{ status: 404, code: 'not_found' }]);
    assert.deepEqual(await memory(owners.Single.id), [single]);
    // Restore ordinary keyboard focus after disabled-pending state so hover-only actions stay painted while the toast is hovered.
    await systemForget.focus(); await expect(systemRow.locator('.systeme-mem-act')).toHaveCSS('opacity', '1');
    await capture('memory-delete-refused', theme, [systemRow, systemForget], toast);
    const systemRefused = await observed(); assert.equal(systemRefused.requests.length, 1); assert.equal(systemRefused.requests[0].redirected, true);
    await drainNotices(); await gate({ botID: owners.Single.id }); await systemForget.click(); await holdNotice(labels.forgotten);
    await expect(systemRow).toHaveCount(0); assert.deepEqual(await memory(owners.Single.id), []);
    assert.deepEqual((await observed()).responses, [{ status: 200 }]);
    record('bot-and-system-single-delete-real-404-retains-row-then-retry', { theme, refused, systemRefused, retry: await observed() }); await drainNotices();

    stage = `${theme}:partial-wipe`;
    await show(`bot-settings?id=${owners.Partial.id}&v=memory`, theme);
    await expect(page.locator('.content-top .title')).toHaveText(`${owners.Partial.name} settings`); await expect(rows).toHaveCount(2);
    await gate({ botID: owners.Partial.id, wrongID: survivor.id, holdID: removed.id }); await wipeOnce();
    await expect.poll(async () => (await observed()).requests.length).toBe(2);
    await expect.poll(async () => (await observed()).responses).toEqual([{ status: 404, code: 'not_found' }]);
    await expect(wipe).toBeDisabled(); await expect(rows).toHaveCount(2);
    await expect(notice(labels.deleteError)).toHaveCount(0); await expect(notice(labels.erased)).toHaveCount(0);
    for (const button of await forget().all()) await expect(button).toBeDisabled();
    const pendingWipe = await observed(); assert.equal(pendingWipe.pending, 1);
    assert.equal(pendingWipe.requests.filter(r => r.redirected && r.dispatched).length, 1);
    assert.equal(pendingWipe.requests.filter(r => r.held && !r.dispatched && !r.redirected).length, 1);
    await release(); toast = await holdNotice(labels.deleteError);
    await expect.poll(async () => (await observed()).responses.map(r => r.status).sort()).toEqual([200, 404]);
    await expect(wipe).toBeEnabled(); await expect(rows).toHaveCount(1); await expect(rows).toHaveValue(survivor.content);
    await expect(notice(labels.erased)).toHaveCount(0); await expect(notice(labels.forgotten)).toHaveCount(0);
    assert.deepEqual(await memory(owners.Partial.id), [survivor]);
    await capture('memory-wipe-partial', theme, [rows, forget(), wipe], toast);
    const partial = await observed(); await drainNotices(); await gate({ botID: owners.Partial.id }); await wipeOnce(); await holdNotice(labels.erased);
    await expect(rows).toHaveCount(0); await expect(page.getByText(labels.empty, { exact: true })).toBeVisible();
    assert.deepEqual(await memory(owners.Partial.id), []); assert.deepEqual((await observed()).responses, [{ status: 200 }]);
    assert.equal((await observed()).requests.length, 1);
    record('wipe-waits-for-both-real-results-refreshes-exact-survivor-retry-erases', { theme, pendingWipe, partial, retry: await observed() }); await drainNotices();

    stage = `${theme}:approvals`;
    await show('home', theme); await expect(page.locator('.home .composer')).toBeVisible(); assert.deepEqual(await call('/api/permissions'), []);
    await gate({ approvals: true }); await show('approvals', theme);
    const loadError = page.getByRole('heading', { name: labels.loadError, exact: true });
    const retry = page.getByRole('button', { name: labels.retry, exact: true });
    await expect(loadError).toBeVisible(); await expect(page.getByText('Nothing to approve', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('approval-allow')).toHaveCount(0); await retry.click({ trial: true });
    await expect.poll(async () => (await observed()).responses.some(r => r.status === 404 && r.code === 'not_found')).toBe(true);
    const approvalRefusal = await observed(); assert(approvalRefusal.approvalRewrites >= 1);
    await capture('approvals-load-error', theme, [loadError, retry]);
    await gate({}); await retry.click(); await expect(page.getByText('Nothing to approve', { exact: true })).toBeVisible();
    await expect(loadError).toHaveCount(0); await expect(retry).toHaveCount(0); assert.deepEqual(await call('/api/permissions'), []);
    record('approval-real-route-404-then-UI-retry-empty-success', { theme, wire: approvalRefusal, pendingPermissionCoverage: false });

    stage = `${theme}:settings-models`;
    await show('settings?section=providers', theme); await page.getByTestId('provider-search').fill('fake');
    await page.locator('[data-testid="provider-row"][data-provider-id="fake"]').click();
    await expect(page.getByText('Saved · 5678', { exact: true })).toBeVisible(); await expect(page.getByTestId('provider-key-input')).toHaveValue('');
    assert.equal(await page.evaluate(key => document.body.innerText.includes(key), KEY), false);
    const modelRows = page.locator('[data-testid="model-row"][data-model-id="reasoner"]');
    await expect(modelRows).toHaveCount(2);
    const geometries = [];
    for (let i = 0; i < 2; i++) {
      const row = modelRows.nth(i);
      await row.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(row.locator('.ttl')).toHaveText('Reasoner Large'); await expect(row.locator('.sub')).toHaveText('100K context · $1 / $2 per 1M');
      await expect(row.locator('[data-cap]')).toHaveCount(3);
      for (const [cap, text] of [['reasoning', 'Reasoning'], ['image', 'Image input'], ['tools', 'Tools']]) {
        await expect(row.locator(`[data-cap="${cap}"]`)).toHaveText(text);
      }
      const geometry = await row.evaluate(el => {
        const row = el.getBoundingClientRect(), grow = el.querySelector('.grow').getBoundingClientRect();
        const texts = [...el.querySelectorAll('.ttl, .sub, .badge')];
        const readable = texts.every(text => {
          const box = text.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(text);
          const rects = [...range.getClientRects()];
          return text.scrollWidth <= text.clientWidth + 1 && rects.length > 0 && rects.every(r => r.width > 0 && r.height > 0
            && r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1
            && r.left >= row.left - 1 && r.right <= row.right + 1 && r.top >= 0 && r.bottom <= innerHeight
            && [r.left + 1, r.x + r.width / 2, r.right - 1].every(x => text.contains(document.elementFromPoint(x, r.y + r.height / 2))));
        });
        const boxes = [...el.querySelectorAll(':scope > .grow, :scope > .badge')].map(x => x.getBoundingClientRect());
        return { readable, badgesBelowText: [...el.querySelectorAll('.badge')].every(x => x.getBoundingClientRect().top >= grow.bottom - 1),
          nonoverlap: boxes.every((a, i) => boxes.slice(i + 1).every(b => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)),
          noPageOverflow: document.documentElement.scrollWidth <= innerWidth };
      });
      assert(Object.values(geometry).every(Boolean), 'Model metadata/capability geometry failed'); geometries.push(geometry);
      if (i === 0) { await row.click({ trial: true }); await capture('settings-model-metadata', theme, [row, row.locator('.sub')]); }
    }
    const persistedConfig = await call('/api/providers/fake');
    assert(persistedConfig.hasKey && persistedConfig.keyHint === '5678' && !JSON.stringify(persistedConfig).includes(KEY));
    assert.deepEqual(await call('/api/sessions'), []);
    record('settings-matching-and-detail-metadata-readable-at-960', { theme, geometries, keyHintOnly: true, noSessionsCreated: true });
    assert.deepEqual(manifest.pageErrors, []); assert.equal(manifest.unexpectedDialogs, 0);
  }
  stage = 'final-identity';
  manifest.installedAfter = installed();
  assert.deepEqual(manifest.installedAfter, manifest.installedBefore, 'Installed app/process changed during the batch');
  assert.equal(manifest.captures.length, 12);
  assert.equal(confirmations, 4, 'Initial wipe and retry must each finish accepting, in both themes');
  for (const s of manifest.sources) assert.equal(sha(fs.readFileSync(path.join(repo, s.path))), s.sha256, 'Source input changed during verification');
  assert.deepEqual(manifest.pageErrors, []); assert.equal(manifest.unexpectedDialogs, 0);
  manifest.status = 'passed';
} catch (error) {
  failed = true; manifest.status = 'failed';
  manifest.failure = { stage, kind: error?.name ?? 'Error', messageSHA256: sha(String(error?.message ?? error)) };
  if (page && !page.isClosed()) {
    try { manifest.failure.wire = await page.evaluate(() => {
      const s = window.__recoveryNative;
      return s ? { requests: s.requests, responses: s.responses, pending: s.releases.length, approvalRewrites: s.approvalRewrites } : null;
    }); } catch { /* Preserve the original failure when its page has disconnected. */ }
  }
} finally {
  if (page && !page.isClosed()) {
    try { await page.evaluate(() => { window.__recoveryNative?.restore(); }); manifest.requestHooksRestored = true; }
    catch { manifest.requestHooksRestored = false; failed = true; }
  }
  if (originalDark) {
    try { ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${originalDark}'`); manifest.appearanceRestored = true; }
    catch { manifest.appearanceRestored = false; failed = true; }
  }
  if (browser) { try { await browser.close(); } catch { failed = true; manifest.disconnectFailed = true; } }
  if (manifest.pageErrors.length || manifest.unexpectedDialogs) failed = true;
  if (failed) manifest.status = 'failed';
  manifest.finishedAt = new Date().toISOString(); checkpoint();
}
console.log(`${manifest.status.toUpperCase()}: ${failed ? stage : '12 native captures; installed recovery assertions'}; ${path.join(out, 'manifest.json')}`);
if (failed) process.exitCode = 1;
