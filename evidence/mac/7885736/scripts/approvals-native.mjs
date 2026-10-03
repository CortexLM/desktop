// Prepared only. Coordinator owns the installed artifact, Mac lease, tunnels and helper lifecycle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [outArg, expectedAsar, expectedSource, ...extra] = process.argv.slice(2);
assert(!extra.length && path.isAbsolute(outArg ?? '') && /^[a-f0-9]{64}$/.test(expectedAsar ?? '') && /^[a-f0-9]{40}$/.test(expectedSource ?? ''),
  'Usage: node approvals-native.mjs <fresh-absolute-local-output> <app.asar-sha256> <artifact-source-commit>');
assert.notEqual(expectedAsar, '62ddb71be7bcbd25c37a4519f7a0d982b1d93d4fada6d63dfc2e218add65fa8b', 'ffc118a predates the narrow approval-description fix');
const repo = fs.realpathSync(process.cwd()), parent = fs.realpathSync(path.dirname(outArg)), out = path.join(parent, path.basename(outArg));
assert(!fs.existsSync(out) && out !== repo && !out.startsWith(`${repo}/`)); fs.mkdirSync(out);
const sha = value => createHash('sha256').update(value).digest('hex');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'mac-live', command], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const report = { status: 'running', startedAt: new Date().toISOString(), expectedAsar, expectedSource, sourceBinding: 'Coordinator-supplied immutable artifact receipt; source not inferred from runtime metadata', scriptSHA256: sha(fs.readFileSync(new URL(import.meta.url))), captures: [], checks: [], pageErrors: [], consoleErrors: [], cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
const installed = () => JSON.parse(ssh('/usr/bin/python3 -', `
import hashlib,json,subprocess
binary='/Applications/Cortex.app/Contents/MacOS/Cortex'
rows=[line.strip().split(None,1) for line in subprocess.check_output(['/bin/ps','-axo','pid=,comm='],text=True).splitlines()]
pids=[int(row[0]) for row in rows if len(row)==2 and row[1]==binary]
h=hashlib.sha256()
with open('/Applications/Cortex.app/Contents/Resources/app.asar','rb') as f:
    for block in iter(lambda:f.read(1048576),b''): h.update(block)
print(json.dumps({'pids':pids,'asarSHA256':h.hexdigest(),'executable':binary}))
`));
const swift = 'import Foundation; import AppKit; import CoreGraphics; let rows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]).filter { $0["kCGWindowOwnerName"] as? String == "Cortex" && $0["kCGWindowLayer"] as? Int == 0 }.map { w in ["id": w["kCGWindowNumber"]!, "pid": w["kCGWindowOwnerPID"]!, "bounds": w["kCGWindowBounds"]!, "active": NSWorkspace.shared.frontmostApplication?.processIdentifier == (w["kCGWindowOwnerPID"] as! Int32)] as [String: Any] }; print(String(data: try! JSONSerialization.data(withJSONObject: rows), encoding: .utf8)!)';
const appearance = () => ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`);
let page, expect, changed = false, stage = 'identity';
try {
  report.installedBefore = installed(); save(); assert.equal(report.installedBefore.asarSHA256, expectedAsar); assert.equal(report.installedBefore.pids.length, 1);
  const modules = [path.join(repo, 'node_modules'), '/tmp/opencode/node_modules'].find(dir => fs.existsSync(path.join(dir, 'playwright/index.mjs')) && fs.existsSync(path.join(dir, '@playwright/test/index.mjs'))); assert(modules, 'Existing Playwright dependencies required');
  const { chromium } = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
  ({ expect } = await import(pathToFileURL(path.join(modules, '@playwright/test/index.mjs')).href)); expect = expect.configure({ timeout: 15000 });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444', { timeout: 15000 }), cdp = await browser.newBrowserCDPSession();
  const cdpIdentity = async () => {
    const mains = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser'); assert.equal(mains.length, 1); assert.equal(mains[0].id, report.installedBefore.pids[0]); return mains[0].id;
  };
  await cdpIdentity();
  const identity = async () => {
    const pid = await cdpIdentity();
    const disk = installed(); assert.deepEqual(disk, report.installedBefore);
    const wins = JSON.parse(ssh(`/usr/bin/swift -e ${quote(swift)}`)); assert.equal(wins.length, 1); const win = wins[0];
    assert.equal(win.pid, pid); assert.equal(win.active, true); assert.deepEqual([win.bounds.Width, win.bounds.Height], [960, 640]); return win;
  };
  const targets = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('cortex://app/')); assert.equal(targets.length, 1); [page] = targets;
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => { report.pageErrors.push({ sha256: sha(e.message) }); });
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ sha256: sha(m.text()) }); });
  await page.waitForFunction(() => window.cortex?.platform === 'darwin'); changed = true;
  await page.evaluate(() => localStorage.setItem('cortex.locale', 'en')); await page.reload();
  const measure = () => page.evaluate(() => {
    const rect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
    const paint = (el, text = false) => {
      const r = el.getBoundingClientRect(); let opaque = true;
      const range = document.createRange(); range.selectNodeContents(el);
      const boxes = text ? [...range.getClientRects()] : [r];
      let visible = boxes.length > 0 && boxes.every(b => b.width > 0 && b.height > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight);
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n), b = n.getBoundingClientRect(), left = b.left + n.clientLeft, top = b.top + n.clientTop;
        opaque &&= Number(s.opacity) === 1 && s.visibility === 'visible' && s.display !== 'none';
        if (text || n !== el) {
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) visible &&= boxes.every(x => x.left >= left - 0.5 && x.right <= left + n.clientWidth + 0.5);
          if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) visible &&= boxes.every(x => x.top >= top - 0.5 && x.bottom <= top + n.clientHeight + 0.5);
        }
      }
      return { rect: rect(r), boxes: boxes.map(rect), opaque, visible, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    };
    const headings = [...document.querySelectorAll('.content-top .title, .pg-panel > .page-title')].map(el => ({ text: el.textContent, ...paint(el, true) }));
    const rows = [...document.querySelectorAll('.pg-panel > .list')][0]?.querySelectorAll(':scope > .li') ?? [];
    const data = [...rows].map(el => {
      const title = el.querySelector('.ttl'), sub = el.querySelector('.sub'), control = el.querySelector('button,[role="switch"]');
      if (!title || !sub || !control) return { ready: false };
      const t = paint(title, true), d = paint(sub, true), c = paint(control), allocated = sub.parentElement.getBoundingClientRect();
      // Ink may exceed an unclipped line box vertically; actual clipping ancestors above govern visibility.
      const below = d.boxes.every(r => r.y >= Math.max(...t.boxes.map(b => b.bottom)));
      const fits = d.boxes.every(r => r.x >= allocated.left - 0.5 && r.right <= allocated.right + 0.5);
      const clear = d.boxes.every(r => r.right <= c.rect.x || r.x >= c.rect.right || r.bottom <= c.rect.y || r.y >= c.rect.bottom);
      return { title: title.textContent, description: sub.textContent, titlePaint: t, descriptionPaint: d, control: c, allocated: rect(allocated), below, fits, clear, ready: [t, d, c].every(p => p.opaque && p.visible) && c.hit && below && fits && clear };
    });
    return { viewport: [innerWidth, innerHeight], window: rect(document.querySelector('.window').getBoundingClientRect()), fonts: document.fonts.status, headings, rows: data, ready: headings.length === 2 && headings.every(h => h.opaque && h.visible) && data.length === 2 && data.every(r => r.ready) };
  });
  for (const theme of ['light', 'dark']) {
    stage = `${theme}:layout`; changed = true;
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "Cortex" to activate' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    await page.evaluate(theme => { location.hash = `#/code-settings?shot&v=approvals&theme=${theme}`; }, theme);
    await expect(page.locator('.page-title')).toHaveText('Approvals');
    if (await page.locator('.window').getAttribute('data-focus') === 'true') await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click();
    if (await page.locator('.window').getAttribute('data-sidebar') !== 'shown') await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
    await page.evaluate(() => document.fonts.ready); await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown'); await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    const rows = page.locator('.pg-panel > .list').first().locator(':scope > .li'); await expect(rows).toHaveCount(2);
    await expect(rows.locator('.ttl')).toHaveText(['Default model', 'Notify me when an approval is waiting']); await expect(rows.locator('.sub')).toHaveText(['For new tasks and reviews', 'Desktop and phone notification']);
    await expect.poll(async () => (await measure()).ready).toBe(true); const before = await measure();
    assert.deepEqual(before.headings.map(h => h.text), ['Cortex Code settings', 'Approvals']); assert.deepEqual([before.window.width, before.window.height], [960, 640]);
    stage = `${theme}:keyboard`; await page.locator('.pg-nav').getByRole('button', { name: 'Usage', exact: true }).focus();
    for (const control of [rows.getByRole('button', { name: 'Deep code', exact: true }), rows.getByRole('switch', { name: 'Notify approvals', exact: true })]) {
      await page.keyboard.press('Tab'); await expect(control).toBeFocused(); await expect(control).toBeEnabled();
      assert(await control.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }));
    }
    stage = `${theme}:capture`; await expect.poll(async () => (await measure()).ready).toBe(true); const win = await identity(); assert.equal(appearance(), String(theme === 'dark'));
    report.checks.push({ theme, before, window: win, keyboard: 'Usage, Tab to Deep code, Tab to Notify approvals; enabled and center-hit' }); save();
    const response = await fetch(`http://127.0.0.1:19445/${win.id}`, { method: 'POST', signal: AbortSignal.timeout(15000) }); assert(response.ok);
    const png = Buffer.from(await response.arrayBuffer()); assert(png.length > 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
    const pixels = [png.readUInt32BE(16), png.readUInt32BE(20)]; assert(pixels[0] >= 960 && pixels[0] / 960 === pixels[1] / 640);
    const file = `approvals-960x640-${theme}.png`; fs.writeFileSync(path.join(out, file), png, { flag: 'wx' });
    report.captures.push({ file, native: true, theme, pixels, viewport: before.viewport, window: win, expectedAsar, expectedSource, sha256: sha(png), after: await measure() }); save();
    const after = report.captures.at(-1).after; assert(after.ready); assert.equal(after.fonts, 'loaded'); assert.deepEqual(after.viewport, [960, 640]);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('.window')).toHaveAttribute('data-sidebar', 'shown');
    assert.deepEqual(await identity(), win); assert.equal(appearance(), String(theme === 'dark'));
  }
  assert.equal(report.captures.length, 2); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { stage, message: String(error?.message ?? error) }; }
finally {
  if (changed && page) try {
    ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'`);
    await page.evaluate(() => { localStorage.setItem('cortex.locale', 'en'); localStorage.setItem('cortex.theme', 'dark'); location.hash = '#/home?theme=dark'; }); await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('.variant-pick')).toHaveCount(0);
    assert.equal(appearance(), 'true'); report.cleanup.ordinaryHomeEnglishDark = true;
  } catch (error) { report.status = 'failed'; report.cleanup.error = String(error?.message ?? error); }
  if (report.pageErrors.length || report.consoleErrors.length) report.status = 'failed';
  report.finishedAt = new Date().toISOString(); report.scope = 'Two installed preview-layout/Tab captures at measured 960x640; no live account, permission policy, SDK auth or inference claim'; save();
}
console.log(`Approval native: ${report.status}; ${path.join(out, 'manifest.json')}`);
// Exit this client only. Never close the installed browser/window or coordinator-owned helpers.
process.exit(report.status === 'passed' ? 0 : 1);
