// Prepared only. Future Files package + independently reviewed native Save-sheet contract required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { protocol, key, prompt, answer, reasoning, filename, model, png, fixture, validateFixture } from './files-native-backend.mjs';
const [out, root, asar, revision, membersFile] = process.argv.slice(2), repo = fs.realpathSync(process.cwd());
assert(process.argv.length === 7 && /^\/tmp\/opencode\/files-native-[\w.-]+$/.test(out ?? '') && /^\/(?:private\/)?tmp\/opencode\/desktop-files-native-[\w.-]+$/.test(root ?? '') && /^[a-f0-9]{64}$/.test(asar ?? '') && /^[a-f0-9]{40}$/.test(revision ?? '') && path.isAbsolute(membersFile ?? ''), 'Usage: node files-native.mjs <fresh-output> <fresh-mac-root> <asar-sha256> <revision> <members.json>');
assert(!['9ba8e59', 'd390cce', '96df66c', 'f82a648'].some(pin => revision.startsWith(pin)), 'Future Files package required'); assert(!fs.existsSync(out) && out !== repo && !out.startsWith(`${repo}/`)); fs.mkdirSync(out);
const sha = value => createHash('sha256').update(value).digest('hex'), quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const helpers = { 'files-native-backend.mjs': '5c8239ef27f8d962b4a1cd5fcfb08e34c8ba4f3871f5242fe1043f73ef90476d', 'launch-files-native.py': 'd7463d642ab0348e8bcebb58f18db9495fbc8594f0dfcdae657e6f9878d149c8' };
const report = { status: 'running', revision, asar, startedAt: new Date().toISOString(), invocation: { argv: process.argv.slice(1), cwd: repo, nodeVersion: process.version }, budget: { flowMs: 150000, captures: 4, nativeSamples: 8, originalBytes: 3145728, totalBytes: 12582912, manifestBytes: 409600, ipcCalls: 100, downloads: 1 }, capturesRequested: 0, captures: [], nativeChecks: [], checks: [], calls: [], errors: [], cleanup: {} };
const save = () => { const text = JSON.stringify(report, null, 2) + '\n'; assert(Buffer.byteLength(text) <= report.budget.manifestBytes); fs.writeFileSync(path.join(out, 'manifest.json'), text); };
const diagnostic = error => String(error?.stack ?? error).replaceAll(key, '[redacted-test-key]').replace(/\bBearer\s+[^\s"'`,]+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s"'<>]+/g, '[network-url]').slice(0, 1200);
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'mac-live', command], { encoding: 'utf8', timeout: 15000, maxBuffer: 1048576, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const python = (source, args = []) => JSON.parse(ssh(`/usr/bin/python3 -c ${quote(source)} ${args.map(quote).join(' ')}`));
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
const setAppearance = dark => assert.equal(ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${dark}' -e 'tell application "System Events" to tell appearance preferences to get dark mode'`), String(dark));
const backend = endpoint => { assert(['health', 'receipt'].includes(endpoint)); return JSON.parse(ssh(`/usr/bin/curl --fail --silent --show-error --max-time 5 http://127.0.0.1:9456/${endpoint}`)); };
const receipt = count => { const r = backend('receipt'); report.backendReceipt = r; save(); for (const field of ['runID', 'root', 'pid', 'scriptSHA256']) assert.equal(r[field], report.backend[field]); assert.deepEqual(r.fixture, fixture); assert.equal(r.counts.errors, 0); assert.equal(r.counts.inference, count); assert.deepEqual(r.failures, []); assert.deepEqual(r.requests, count ? [{ imageSHA256: fixture.sha256, imageBytes: fixture.bytes, modelExact: true, authorizationExact: true, messagesExact: true, toolsAbsent: true, httpStatus: 200, completed: true }] : []); };
const installed = () => { const value = JSON.parse(ssh(`/usr/bin/python3 ${quote(`${root}/launch-files-native.py`)} --inspect ${quote(root)} ${asar} ${revision}`)); assert.equal(value.membersSHA256, report.membersSHA256); assert.equal(value.membersVerified, report.memberCount); assert.equal(value.inspectorSHA256, helpers['launch-files-native.py']); return value; };
const swift = 'import Foundation; import AppKit; import CoreGraphics; let rows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]).filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const nativeProbe = String.raw`import json,subprocess,sys; rows=json.loads(subprocess.check_output(["/usr/bin/swift","-e",sys.argv[1]],text=True,timeout=10)); dark=subprocess.run(["/usr/bin/osascript","-e",'tell application "System Events" to tell appearance preferences to get dark mode'],capture_output=True,text=True,timeout=3); print(json.dumps({"rows":rows,"appearanceStatus":dark.returncode,"appearanceStdout":dark.stdout}))`;
const nativeWindow = (theme, point) => { assert(report.nativeChecks.length < 8); const sample = python(nativeProbe, [swift]); report.nativeChecks.push({ stage, theme, point, measuredAt: new Date().toISOString(), ...sample }); save(); assert.equal(sample.appearanceStatus, 0); assert(['true\n', 'false\n'].includes(sample.appearanceStdout)); assert(Array.isArray(sample.rows)); assert.equal(sample.rows.length, 1); const w = { ...sample.rows[0], osDark: sample.appearanceStdout === 'true\n' }; assert(w.active && w.pid === report.installedBefore.pid && w.bounds.Width === 960 && w.bounds.Height === 640 && w.osDark === (theme === 'dark')); if (report.captures.length) assert.equal(w.id, report.captures[0].id); return w; };
// Candidate AX contract; named descendant Save controls, no window title assumption or download interception.
const saveSheet = `on run argv
set ownerPID to (item 1 of argv) as integer
set folderPath to item 2 of argv
set leafName to item 3 of argv
set operation to item 4 of argv
tell application "System Events"
set ownerProcess to first application process whose unix id is ownerPID
tell ownerProcess
log {"owner", ownerPID, name, frontmost}
if name is not "Cortex" or frontmost is not true then error "Save owner mismatch"
if operation is "cancel" and not (exists sheet 1 of window 1) then return "no-owned-save-sheet"
repeat 30 times
if exists sheet 1 of window 1 then exit repeat
delay 0.1
end repeat
log {"sheet-count", count of sheets of window 1}
if (count of sheets of window 1) is not 1 then error "Expected one Save sheet"
set panel to sheet 1 of window 1
set saveButtons to {}
set fields to {}
set cancelButtons to {}
repeat with element in (entire contents of panel)
if role of element is "AXButton" and name of element is "Save" then set end of saveButtons to contents of element
if role of element is "AXButton" and name of element is "Cancel" then set end of cancelButtons to contents of element
if role of element is "AXTextField" then
log {"text-field", role of element, value of element}
if value of element is leafName then set end of fields to contents of element
end if
end repeat
log {"save-sheet", role of panel, position of panel, size of panel, count of saveButtons, count of fields}
if role of panel is not "AXSheet" or (count of saveButtons) is not 1 or (count of fields) is not 1 then error "Save controls mismatch"
set nameField to item 1 of fields
log {"filename", value of nameField}
if operation is "cancel" then
if exists sheet 1 of panel then error "Nested dialog retained for coordinator"
if (count of cancelButtons) is not 1 then error "Cancel button mismatch"
click (item 1 of cancelButtons)
return "owned-save-cancelled"
end if
if operation is not "save" then error "Invalid native operation"
set value of nameField to leafName
if value of nameField is not leafName then error "Save filename mismatch"
keystroke "g" using {command down, shift down}
repeat 20 times
if exists sheet 1 of panel then exit repeat
delay 0.1
end repeat
if (count of sheets of panel) is not 1 then error "Go to Folder sheet missing"
set field to value of attribute "AXFocusedUIElement" of ownerProcess
log {"go-to-folder", role of field, count of sheets of panel}
if role of field is not "AXTextField" then error "Go to Folder focus mismatch"
keystroke "a" using {command down}
keystroke folderPath
if value of field is not folderPath then error "Go to Folder value mismatch"
log {"folder-value", value of field}
key code 36
repeat 20 times
if not (exists sheet 1 of panel) then exit repeat
delay 0.1
end repeat
if exists sheet 1 of panel then error "Go to Folder did not close"
if frontmost is not true or value of nameField is not leafName then error "Save owner or filename changed"
click (item 1 of saveButtons)
repeat 20 times
if not (exists sheet 1 of window 1) then exit repeat
delay 0.1
end repeat
log {"after-save", count of sheets of window 1}
if exists sheet 1 of window 1 then error "Save sheet did not close"
end tell
end tell
return "native-save-clicked"
end run`;
const nativeSaveProbe = String.raw`import base64,hashlib,json,subprocess,sys
try:
 r=subprocess.run(["/usr/bin/osascript","-e",sys.argv[1],*sys.argv[2:]],capture_output=True,timeout=12); status=r.returncode; out=r.stdout; err=r.stderr; timed=False
except subprocess.TimeoutExpired as e: status=None; out=e.stdout or b""; err=e.stderr or b""; timed=True
def sample(b): return {"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"base64":base64.b64encode(b[:16384]).decode(),"truncated":len(b)>16384}
print(json.dumps({"status":status,"timedOut":timed,"stdout":sample(out),"stderr":sample(err)}))`;
let page, expect, call, verifyLists, go, session, history, previous, previousProvider, oldDark, initialHash, downloadDir, downloadPath, downloadRequested = false, downloadMatched, fresh = false, changed = false, providerChanged = false, cleanupPhase = false, stage = 'preflight', promptAttempts = 0;
const writes = new Set(), elapsed = () => Date.now() - Date.parse(report.startedAt), budget = () => assert(elapsed() < 150000, 'Files flow exceeded 150-second budget');
const mark = next => { stage = next; report.stage = next; save(); budget(); };
const preference = () => page.evaluate(() => ({ stored: localStorage.getItem('cortex.theme'), pref: document.querySelector('.theme [aria-checked=true]')?.dataset.themeValue, theme: document.documentElement.dataset.theme }));
const sessionInput = { kind: 'chat', title: 'Native saved image', model }, promptInput = { parts: [{ type: 'text', text: prompt }, { type: 'file', mime: 'image/png', filename, data: png }], reasoning: true };
save();
try {
  report.helperHashes = { [path.basename(fileURLToPath(import.meta.url))]: sha(fs.readFileSync(new URL(import.meta.url))), ...Object.fromEntries(Object.keys(helpers).map(name => [name, sha(fs.readFileSync(new URL(name, import.meta.url)))])) }; for (const [name, hash] of Object.entries(helpers)) assert.equal(report.helperHashes[name], hash); validateFixture(); report.fixture = fixture;
  const pins = fs.readFileSync(membersFile), members = JSON.parse(pins); assert.equal(members.revision, revision); assert(Array.isArray(members.members) && members.members.length >= 4 && members.members.every(m => /^(packages\/app\/dist\/|packages\/desktop\/dist\/)/.test(m.path) && /^[a-f0-9]{64}$/.test(m.sha256))); assert.equal(new Set(members.members.map(m => m.path)).size, members.members.length); report.membersSHA256 = sha(pins); report.memberCount = members.members.length;
  const hashSource = 'import hashlib,json,pathlib,sys; p=pathlib.Path(sys.argv[1]); print(json.dumps({n:hashlib.sha256((p/n).read_bytes()).hexdigest() for n in sys.argv[2:]}))'; report.rootHelperHashes = python(hashSource, [root, ...Object.keys(helpers)]); assert.deepEqual(report.rootHelperHashes, helpers);
  mark('identity'); report.installedBefore = installed(); report.backend = backend('health'); assert.equal(report.backend.protocol, protocol); assert.equal(report.backend.platform, 'darwin'); assert.equal(report.backend.port, 9456); assert.equal(report.backend.root, report.installedBefore.root); assert.equal(report.backend.scriptSHA256, helpers['files-native-backend.mjs']); receipt(0);
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, '@playwright/test/index.mjs'))); assert(modules); report.playwrightVersion = JSON.parse(fs.readFileSync(path.join(modules, '@playwright/test/package.json'))).version; assert.equal(report.playwrightVersion, '1.63.0', 'Review noDefaults support before changing this pin'); const pw = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href); expect = pw.expect.configure({ timeout: 10000 });
  const browser = await pw.chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 10000, noDefaults: true }), cdp = await browser.newBrowserCDPSession(); report.nativeDownloadOverrides = 'none; connectOverCDP noDefaults:true';
  const pidCheck = async () => assert.deepEqual((await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser').map(p => p.id), [report.installedBefore.pid]); await pidCheck();
  const pages = browser.contexts().flatMap(context => context.pages()).filter(p => p.url().startsWith('cortex://app/')); assert.equal(pages.length, 1); [page] = pages; page.setDefaultTimeout(10000); initialHash = new URL(page.url()).hash; assert.equal(initialHash, '#/home');
  await page.emulateMedia({ colorScheme: null, reducedMotion: null, forcedColors: null, contrast: null }); const fail = error => { if (report.errors.length < 20) report.errors.push(diagnostic(error)); }; page.on('pageerror', fail); page.on('console', message => { if (message.type() === 'error') fail('Renderer console error'); }); page.on('dialog', async dialog => { fail('Unexpected JavaScript dialog'); await dialog.dismiss(); }); for (const context of browser.contexts()) { context.on('page', () => fail('Unexpected page')); context.on('request', request => { if (/^https?:/.test(request.url())) fail('Unexpected renderer HTTP request'); }); }
  const lists = ['/api/bots', '/api/sessions', '/api/projects', '/api/providers', '/api/tasks', '/api/plugins', '/api/permissions'];
  call = async (route, method = 'GET', body) => {
    if (!cleanupPhase) budget(); assert(report.calls.length < (cleanupPhase ? 100 : 80)); const ownSession = session && route === `/api/sessions/${session.id}`, messages = session && route === `/api/sessions/${session.id}/messages`; let allowed = false, status = 200;
    if (method === 'GET') allowed = body === undefined && (lists.includes(route) || ['/api/connection', '/api/providers/fake', '/api/catalog/providers', '/api/catalog/providers/fake/models'].includes(route) || ownSession || messages);
    else if (fresh && cleanupPhase) { allowed = method === 'DELETE' && body === undefined && (ownSession || providerChanged && route === '/api/providers/fake/key'); if (providerChanged && method === 'PATCH' && route === '/api/providers/fake') { assert.deepEqual(body, { enabled: previousProvider.enabled, baseURL: null }); allowed = true; } }
    else if (fresh) {
      if (method === 'PATCH' && route === '/api/providers/fake') { assert([JSON.stringify({ enabled: true, baseURL: 'http://127.0.0.1:9456/v1' }), JSON.stringify({ enabled: false })].includes(JSON.stringify(body))); allowed = true; }
      if (method === 'PUT' && route === '/api/providers/fake/key') { assert.deepEqual(body, { key }); allowed = true; }
      if (method === 'POST' && route === '/api/sessions' && !session) { assert.deepEqual(body, sessionInput); allowed = true; status = 201; }
      if (session && method === 'POST' && route === `/api/sessions/${session.id}/prompt` && promptAttempts === 0) { assert.deepEqual(body, promptInput); promptAttempts++; allowed = true; status = 202; }
    }
    assert(allowed, 'Refused uncontrolled IPC request'); if (method !== 'GET') { const token = sha(JSON.stringify([cleanupPhase, method, route, body])); assert(!writes.has(token), 'Duplicate mutation refused'); writes.add(token); }
    const response = await page.evaluate(async ({ route, method, body }) => { const r = await window.cortex.request({ url: `cortex://local${route}`, method, headers: body === undefined ? [] : [['content-type', 'application/json']], body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, data: JSON.parse(r.body) }; }, { route, method, body }); report.calls.push({ stage, route, method, status: response.status, ...(Array.isArray(response.data) ? { count: response.data.length } : {}) }); save(); assert(response.status === status || cleanupPhase && method === 'DELETE' && response.status === 404, `Unexpected IPC status: ${method} ${route}`); return response.data;
  };
  verifyLists = async () => { for (const route of lists) assert.deepEqual(await call(route), cleanupPhase && providerChanged && route === '/api/providers' ? [previousProvider] : []); assert.deepEqual(await call('/api/connection'), { mode: 'local', signedIn: false }); };
  await page.waitForFunction(() => window.cortex?.platform === 'darwin' && document.querySelector('.theme [aria-checked=true]')); await expect(page.locator('html')).toHaveAttribute('lang', 'en'); mark('fresh-profile'); await verifyLists(); previousProvider = await call('/api/providers/fake'); assert.deepEqual(previousProvider, { providerID: 'fake', enabled: true, hasKey: false }); fresh = true;
  const providers = await call('/api/catalog/providers'), models = await call('/api/catalog/providers/fake/models'); assert.deepEqual(providers.map(p => [p.id, p.api, p.npm, p.modelCount]), [['fake', 'http://127.0.0.1:9456/v1', '@ai-sdk/openai-compatible', 1]]); assert.deepEqual(models.map(m => [m.providerID, m.id, m.capabilities.imageInput, m.tool_call]), [['fake', 'reasoner', true, false]]);
  await page.waitForFunction(() => document.documentElement.dataset.theme === (document.querySelector('.theme [aria-checked=true]')?.dataset.themeValue === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : document.querySelector('.theme [aria-checked=true]')?.dataset.themeValue)); previous = await preference(); oldDark = appearance(); assert(['true', 'false'].includes(oldDark) && ['system', 'light', 'dark'].includes(previous.pref)); report.previous = { ...previous, nativeDark: oldDark, hash: initialHash };
  go = async hash => { assert(hash === initialHash || session && hash === `#/chat?id=${session.id}`); await page.evaluate(value => { history.pushState(null, '', value); dispatchEvent(new Event('cortex-variant')); }, hash); await expect(page).toHaveURL(`cortex://app/index.html${hash}`); };
  mark('controlled-image'); providerChanged = true; await call('/api/providers/fake', 'PATCH', { enabled: true, baseURL: 'http://127.0.0.1:9456/v1' }); const saved = await call('/api/providers/fake/key', 'PUT', { key }); assert.deepEqual(saved, { providerID: 'fake', enabled: true, hasKey: true, keyHint: key.slice(-4), baseURL: 'http://127.0.0.1:9456/v1' });
  session = await call('/api/sessions', 'POST', sessionInput); report.session = session; save(); assert(/^ses_[0-9a-f]{32,}$/.test(session.id) && session.kind === 'chat' && session.title === sessionInput.title && session.parentID === undefined && session.botID === undefined && session.projectID === undefined && session.directory === undefined); assert.deepEqual(session.model, model);
  const accepted = await call(`/api/sessions/${session.id}/prompt`, 'POST', promptInput); assert(/^msg_[0-9a-f]{32,}$/.test(accepted.messageID)); await expect.poll(async () => { history = await call(`/api/sessions/${session.id}/messages`); return history.length === 2 && Number.isFinite(history[1]?.info.time.completed); }, { intervals: [100, 250, 500] }).toBe(true);
  assert.deepEqual(history.map(m => m.info.role), ['user', 'assistant']); assert(history.every(m => m.info.sessionID === session.id && m.info.agent === 'build' && m.info.error === undefined && m.parts.every(p => p.sessionID === session.id && p.messageID === m.info.id && ['text', 'file', 'reasoning', 'step-start', 'step-finish'].includes(p.type)))); assert.equal(history[0].info.id, accepted.messageID);
  assert.deepEqual(history[0].parts.map(({ id: _id, sessionID: _sid, messageID: _mid, ...part }) => part), promptInput.parts); assert.deepEqual(history[1].parts.filter(p => ['text', 'reasoning'].includes(p.type)).map(p => [p.type, p.text]), [['reasoning', reasoning], ['text', answer]]); assert.deepEqual(history[1].parts.filter(p => p.type === 'step-finish').map(p => p.reason), ['stop']);
  const part = history[0].parts.find(p => p.type === 'file'); assert(/^prt_[0-9a-f]{32,}$/.test(part.id)); report.savedImage = { sessionID: session.id, messageID: accepted.messageID, partID: part.id, historySHA256: sha(JSON.stringify(history)), fileSHA256: fixture.sha256 }; save(); receipt(1);
  const disabled = await call('/api/providers/fake', 'PATCH', { enabled: false }); assert.deepEqual(disabled, { ...saved, enabled: false }); const settledSession = await call(`/api/sessions/${session.id}`);
  changed = true; ssh('/usr/bin/osascript -e \'tell application "Cortex" to activate\' -e \'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}\''); await page.locator('.rail .theme [aria-checked=true]').focus(); await page.keyboard.press('Home'); await expect.poll(preference).toEqual({ stored: 'dark', pref: 'dark', theme: 'dark' }); await page.keyboard.press('ArrowLeft'); await expect.poll(async () => (await preference()).pref).toBe('system');
  const viewer = page.locator('main .medias-image-live'), stageView = viewer.locator('.medias-view'), image = stageView.locator('img'), fit = viewer.getByRole('button', { name: 'Fit', exact: true }), zoomIn = viewer.getByRole('button', { name: 'Zoom in', exact: true }), zoomOut = viewer.getByRole('button', { name: 'Zoom out', exact: true }), download = viewer.getByRole('button', { name: 'Download', exact: true });
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => document.fonts.status === 'loaded' && document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished')); };
  const ready = async zoom => {
    await expect(viewer).toBeVisible(); await expect(image).toBeVisible(); await expect(viewer.locator('.medias-name')).toHaveText(filename); await expect(viewer.locator('.medias-zoomv')).toHaveText(`${zoom}% of Fit`); await expect(download).toBeEnabled(); await expect(viewer.locator('.medias-kv > span:last-child')).toHaveText(['120 × 180', 'PNG', '393 bytes']);
    await expect.poll(() => image.evaluate(img => [img.complete, img.naturalWidth, img.naturalHeight])).toEqual([true, 120, 180]);
    const sample = await image.evaluate(img => { const c = document.createElement('canvas'); c.width = 120; c.height = 180; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return { dimensions: [img.naturalWidth, img.naturalHeight], complete: img.complete, protocol: new URL(img.src).protocol, scale: img.style.scale, translate: img.style.translate, rgba: [30, 90, 150].map(y => [...ctx.getImageData(60, y, 1, 1).data]) }; }); assert.deepEqual(sample.dimensions, [120, 180]); assert(sample.complete && sample.protocol === 'blob:' && sample.scale === String(zoom / 100)); assert.deepEqual(sample.rgba, fixture.rgb.map(rgb => [...rgb, 255])); return sample;
  };
  const geometry = target => target.evaluate(el => {
    const clip = start => { let l = 0, t = 0, r = innerWidth, b = innerHeight, opacity = 1; for (let n = start; n; n = n.parentElement) { const s = getComputedStyle(n), q = n.getBoundingClientRect(); opacity *= s.visibility === 'visible' && s.display !== 'none' ? +s.opacity : 0; if (!['inline', 'contents'].includes(s.display)) { if (/^(auto|scroll|hidden|clip)$/.test(s.overflowX)) { l = Math.max(l, q.left + n.clientLeft); r = Math.min(r, q.left + n.clientLeft + n.clientWidth); } if (/^(auto|scroll|hidden|clip)$/.test(s.overflowY)) { t = Math.max(t, q.top + n.clientTop); b = Math.min(b, q.top + n.clientTop + n.clientHeight); } } } return { edges: [l, t, r, b], opacity }; };
    const box = r => [r.left, r.top, r.right, r.bottom], fits = (r, c) => r.width > 0 && r.height > 0 && r.left >= c.edges[0] - .5 && r.top >= c.edges[1] - .5 && r.right <= c.edges[2] + .5 && r.bottom <= c.edges[3] + .5, q = el.getBoundingClientRect(), boundsClip = clip(el.parentElement), ink = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let node; (node = walker.nextNode());) { if (!node.textContent.trim() || node.parentElement.closest('[aria-hidden=true]')) continue; const range = document.createRange(); range.selectNodeContents(node); const c = clip(node.parentElement); for (const r of range.getClientRects()) if (r.width && r.height) ink.push({ bounds: box(r), clip: c.edges, visible: fits(r, c) && c.opacity === 1 }); }
    return { text: (el.getAttribute('aria-label') || el.textContent).slice(0, 500), bounds: box(q), clip: boundsClip.edges, ink, visible: fits(q, boundsClip) && boundsClip.opacity === 1 && ink.length <= 40 && (ink.length > 0 ? ink.every(r => r.visible) : el.matches('button[aria-label],[role=img][aria-label]')), hit: el.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)) };
  });
  const capture = async (label, theme, zoom, focus) => {
    mark(`${theme}:${label}:capture`); await viewer.locator('.medias-name').hover(); await expect(page.locator('.toast, .tip, [role=menu]')).toHaveCount(0); await settle(); await expect(focus).toBeFocused(); assert(await focus.evaluate(el => el.matches(':focus-visible')));
    const renderer = async () => { await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown'); await expect(page.locator('html')).toHaveAttribute('data-theme', theme); assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight, matchMedia('(prefers-color-scheme: dark)').matches]), [960, 640, theme === 'dark']); }; await renderer();
    const measure = async () => { const boxes = []; for (const target of [viewer.locator('.medias-name'), viewer.locator('.medias-bar'), stageView, viewer.locator('.medias-exif'), download]) { const g = await geometry(target); boxes.push(g); if (!g.visible || !g.hit) { report.failedGeometry = boxes; save(); assert.fail('Files target clipped or covered'); } } return boxes; };
    const boxes = await measure(), imageSample = await ready(zoom), win = nativeWindow(theme, 'before'); await pidCheck(); budget(); assert(report.capturesRequested < 4); const shot = { file: `${label}-${theme}.png`, requestedAt: new Date().toISOString(), theme, native: true, ...win, boxes, imageSample, focus: await focus.evaluate(el => ({ visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outline, boxShadow: getComputedStyle(el).boxShadow })), status: 'requested' }; report.capturesRequested++; report.captures.push(shot); save();
    const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) }); shot.httpStatus = response.status; save(); assert(response.ok); const bytes = Buffer.from(await response.arrayBuffer()); fs.writeFileSync(path.join(out, shot.file), bytes, { flag: 'wx' }); Object.assign(shot, { bytes: bytes.length, sha256: sha(bytes), status: 'original-retained' }); save();
    assert(bytes.length <= 3145728 && report.captures.reduce((sum, c) => sum + (c.bytes ?? 0), 0) <= 12582912); assert(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))); shot.pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; assert(shot.pixels[0] >= 960 && shot.pixels[0] / 960 === shot.pixels[1] / 640);
    shot.afterBoxes = await measure(); await renderer(); assert.deepEqual(await ready(zoom), imageSample); await expect(focus).toBeFocused(); assert.deepEqual(nativeWindow(theme, 'after'), win); await pidCheck(); shot.status = 'passed'; shot.finishedAt = new Date().toISOString(); save(); mark(`${theme}:${label}:retained`);
  };
  await go(`#/chat?id=${session.id}`);
  for (const theme of ['light', 'dark']) {
    mark(`${theme}:open-saved-image`); setAppearance(theme === 'dark'); await expect.poll(preference).toEqual({ stored: 'system', pref: 'system', theme }); assert.deepEqual(await call('/api/providers/fake'), disabled); const open = page.getByRole('button', { name: `Open ${filename}`, exact: true }); await expect(open).toHaveCount(1); await expect(open).toBeEnabled(); await expect(page.getByPlaceholder('Reply to Cortex', { exact: true })).toHaveValue(''); if (theme === 'light') await open.press('Enter'); else await open.click();
    const expectedHash = `#/file-image?${new URLSearchParams({ session: session.id, message: accepted.messageID, part: part.id })}`; await expect(page).toHaveURL(`cortex://app/index.html${expectedHash}`); await ready(100); await zoomIn.click(); await ready(150); await zoomOut.press('Space'); await ready(100); await fit.press('Space'); await capture('files-fit', theme, 100, fit);
    await fit.press('Tab'); await expect(viewer.getByRole('button', { name: '200%', exact: true })).toBeFocused(); await page.keyboard.press('Tab'); await expect(stageView).toBeFocused(); await stageView.press('+'); await ready(150); await stageView.press('ArrowDown'); assert.notEqual((await ready(150)).translate, '0px 0px'); const mini = await viewer.locator('.medias-mini').boundingBox(); assert(mini && Math.abs(mini.width / mini.height - 2 / 3) < .01); await capture('files-zoom', theme, 150, stageView);
    report.checks.push({ stage, exactTuple: true, open: theme === 'light' ? 'Enter' : 'pointer', zoomInOutFit: true, keyboardPan: true, minimapRatio: mini.width / mini.height }); save(); if (theme === 'light') { await page.evaluate(() => history.back()); await expect(page).toHaveURL(`cortex://app/index.html#/chat?id=${session.id}`); }
  }
  mark('dark:original-download'); await fit.press('Space'); await ready(100); assert.equal(appearance(), 'true'); downloadDir = `${report.installedBefore.root}/native-download`; downloadPath = `${downloadDir}/${filename}`;
  report.download = python('import json,pathlib,sys; d=pathlib.Path(sys.argv[1]); d.mkdir(mode=0o700); print(json.dumps({"directory":str(d),"fresh":True,"path":str(d/sys.argv[2])}))', [downloadDir, filename]); save(); assert.equal(report.download.path, downloadPath); downloadRequested = true; report.download.requested = true; save(); await download.click();
  const nativeSave = python(nativeSaveProbe, [saveSheet, String(report.installedBefore.pid), downloadDir, filename, 'save']); report.download.nativeSave = nativeSave; save(); assert.equal(nativeSave.status, 0); assert(!nativeSave.timedOut && !nativeSave.stdout.truncated && !nativeSave.stderr.truncated); assert.equal(Buffer.from(nativeSave.stdout.base64, 'base64').toString(), 'native-save-clicked\n');
  const downloaded = python('import base64,hashlib,json,pathlib,stat,sys,time\np=pathlib.Path(sys.argv[1]); expected=base64.b64decode(sys.argv[2]); deadline=time.monotonic()+8; raw=b""; s=None\nwhile time.monotonic()<deadline:\n if p.exists() or p.is_symlink():\n  s=p.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<=len(expected); raw=p.read_bytes()\n  if raw==expected: break\n time.sleep(0.1)\nprint(json.dumps({"path":str(p),"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"byteEqual":raw==expected,"device":s.st_dev if s else None,"inode":s.st_ino if s else None}))', [downloadPath, png]); report.download.result = downloaded; save(); assert(downloaded.byteEqual && downloaded.bytes === fixture.bytes && downloaded.sha256 === fixture.sha256); downloadMatched = downloaded;
  mark('read-only-viewer'); assert.deepEqual(await call(`/api/sessions/${session.id}/messages`), history); assert.deepEqual(await call(`/api/sessions/${session.id}`), settledSession); assert.deepEqual(await call('/api/providers/fake'), disabled); assert.equal(report.capturesRequested, 4); assert.equal(report.nativeChecks.length, 8); assert.equal(report.captures.filter(c => c.status === 'passed').length, 4); assert.equal(promptAttempts, 1); mark('flow-complete'); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, diagnostic: diagnostic(error) }; }
finally {
  report.flowDurationMs = elapsed(); cleanupPhase = true; const clean = async (name, fn) => { try { await fn(); report.cleanup[name] = true; } catch (error) { report.status = 'failed'; report.cleanup[name] = { diagnostic: diagnostic(error) }; } save(); };
  if (downloadRequested && !downloadMatched) await clean('ownedSaveSheetCancelled', async () => { const sample = python(nativeSaveProbe, [saveSheet, String(report.installedBefore.pid), downloadDir, filename, 'cancel']); report.download.cancelSample = sample; save(); assert.equal(sample.status, 0); assert(['no-owned-save-sheet\n', 'owned-save-cancelled\n'].includes(Buffer.from(sample.stdout.base64, 'base64').toString())); });
  if (downloadRequested) await clean('ownedDownloadRemoved', async () => { const value = python('import base64,json,pathlib,stat,sys\np=pathlib.Path(sys.argv[1]); match=json.loads(sys.argv[3]); expected=base64.b64decode(sys.argv[2]); removed=False\nif p.exists() or p.is_symlink():\n s=p.lstat(); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size==len(expected) and p.read_bytes()==expected; assert not match or (s.st_dev,s.st_ino)==(match["device"],match["inode"]); p.unlink(); removed=True\nprint(json.dumps({"removed":removed,"absent":not p.exists() and not p.is_symlink(),"path":str(p)}))', [downloadPath, png, JSON.stringify(downloadMatched ?? null)]); report.download.removal = value; assert(value.absent && (!downloadMatched || value.removed)); });
  if (session?.id && /^ses_[0-9a-f]{32,}$/.test(session.id)) await clean('ownedChatRemoved', () => call(`/api/sessions/${session.id}`, 'DELETE'));
  if (providerChanged) { await clean('fixtureKeyRemoved', async () => { const value = await call('/api/providers/fake/key', 'DELETE'); assert(value.hasKey === false && value.keyHint === undefined); }); await clean('providerValuesRestored', async () => { assert.deepEqual(await call('/api/providers/fake', 'PATCH', { enabled: previousProvider.enabled, baseURL: null }), previousProvider); report.providerDocumentRetained = true; }); }
  if (changed) await clean('nativeAppearanceRestored', async () => setAppearance(oldDark === 'true'));
  if (changed && previous) await clean('themePreferenceRestored', async () => { await page.evaluate(pref => dispatchEvent(new CustomEvent('cortex-theme', { detail: pref })), previous.pref); await expect.poll(async () => { const { stored: _stored, ...value } = await preference(); return value; }).toEqual({ pref: previous.pref, theme: previous.theme }); await page.evaluate(stored => { if (stored === null) localStorage.removeItem('cortex.theme'); else localStorage.setItem('cortex.theme', stored); }, previous.stored); });
  if (go) await clean('routeRestored', async () => { await go(initialHash); if (previous) await expect.poll(preference).toEqual(previous); });
  if (fresh && verifyLists) await clean('controlledListsRestored', verifyLists);
  if (report.backend) await clean('controlledInferenceOnly', async () => receipt(promptAttempts));
  if (report.installedBefore) await clean('installedAfter', async () => { report.installedAfter = installed(); assert.deepEqual(report.installedAfter, report.installedBefore); });
  if (report.errors.length) report.status = 'failed'; report.finishedAt = new Date().toISOString(); report.durationMs = elapsed(); report.scope = 'Four native English saved-PNG Fit/zoom images; actual OS themes; exact Chat Open; one fixture inference; provider-disabled viewing; one candidate native Save-sheet download. Cleanup results determine removal/restoration. No other formats/restart/races/locale/long-name/full-product acceptance.'; save();
}
console.log(`Files native: ${report.status}; ${stage}; ${path.join(out, 'manifest.json')}`); process.exit(report.status === 'passed' ? 0 : 1);
