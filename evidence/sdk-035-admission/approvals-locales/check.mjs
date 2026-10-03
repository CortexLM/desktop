import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = process.cwd(), out = path.dirname(new URL(import.meta.url).pathname), frozen = '/tmp/opencode/build-7885736';
const revision = '78857365a509d78af10ebdda5b52348a2e50e961', locales = ['en', 'fr', 'es', 'de', 'ja', 'zh-Hans', 'pt-BR', 'ko'];
const sha = b => createHash('sha256').update(b).digest('hex'), read = f => fs.readFileSync(f), json = f => JSON.parse(read(f));
assert(!fs.existsSync(path.join(out, 'manifest.json')), 'Preserve prior evidence; output already contains a run');
const members = json(path.join(frozen, 'members.json')), pins = json(path.join(frozen, 'pinned-inputs.json'));
assert.equal(members.revision, revision); assert.equal(pins.revision, revision);
const inputs = [...locales.map(l => `packages/i18n/locales/${l}/code.json`), 'packages/app/src/screens/code/lot-code.tsx', 'packages/app/src/screens/code/lot-code.css'];
function verifyInputs() {
  const files = members.members.map(m => {
    assert.equal(sha(read(path.join(frozen, m.path))), m.sha256, `Frozen member changed: ${m.path}`);
    assert.equal(sha(read(path.join(root, m.path))), m.sha256, `Current member differs: ${m.path}`);
    return { path: m.path, sha256: m.sha256 };
  });
  for (const f of inputs) assert.equal(sha(read(path.join(root, f))), pins.inputs.find(p => p.path === f)?.sha256, `Pinned input differs: ${f}`);
  return { members: files.length, sha256: sha(JSON.stringify(files)), allMatch: true };
}
const report = { status: 'running', startedAt: new Date().toISOString(), revision, headAtStart: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  membersBefore: verifyInputs(), sourceReceipt: json(path.join(frozen, 'source.json')), scriptSHA256: sha(read(new URL(import.meta.url))),
  sourceHashes: Object.fromEntries(inputs.map(f => [f, sha(read(path.join(root, f)))])), views: [], startupErrors: [], fatal: null };
assert.equal(report.membersBefore.members, 90);
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const { _electron } = await import(pathToFileURL(path.join(root, 'node_modules/playwright/index.mjs')).href);
const { expect: baseExpect } = await import(pathToFileURL(path.join(root, 'node_modules/@playwright/test/index.mjs')).href);
const expect = baseExpect.configure({ timeout: 15000 });
for (const dir of ['profile', 'engine', 'temp', 'screens']) fs.mkdirSync(path.join(out, dir), { recursive: true });
const env = { ...process.env, NODE_ENV: 'test', TMPDIR: path.join(out, 'temp'), CORTEX_DATA_DIR: path.join(out, 'engine'), CORTEX_LOCALE: 'en', CORTEX_CATALOG_URL: 'data:application/json,{}', CORTEX_START_HASH: '#/code-settings?shot&v=approvals&theme=light' };
delete env.CORTEX_RENDERER_URL;
let app, active;
try {
  app = await _electron.launch({ args: [path.join(root, 'packages/desktop/dist/main.cjs'), `--user-data-dir=${path.join(out, 'profile')}`, '--no-sandbox'], env, timeout: 30000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  const error = (type, text) => (active ? active.errors : report.startupErrors).push({ type, text });
  page.on('pageerror', e => error('pageerror', e.message)); page.on('console', m => { if (m.type() === 'error') error('console', m.text()); });
  await page.waitForFunction(() => !!window.cortex && !!document.querySelector('.code-approval-defaults'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  const cdp = await page.context().newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const measure = () => page.evaluate(() => {
    const rect = r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    const paint = (el, text = false) => {
      const r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
      const boxes = text ? [...range.getClientRects()].filter(b => b.width && b.height) : [r]; let opaque = true;
      let visible = boxes.length > 0 && boxes.every(b => b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight);
      const clipping = [];
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n), b = n.getBoundingClientRect(), l = b.left + n.clientLeft, t = b.top + n.clientTop;
        opaque &&= Number(s.opacity) === 1 && s.visibility === 'visible' && s.display !== 'none';
        if (text || n !== el) {
          const x = /^(auto|scroll|hidden|clip)$/.test(s.overflowX), y = /^(auto|scroll|hidden|clip)$/.test(s.overflowY);
          if (x || y) clipping.push({ className: n.className, x, y, left: l, top: t, right: l + n.clientWidth, bottom: t + n.clientHeight });
          if (x) visible &&= boxes.every(b => b.left >= l - .5 && b.right <= l + n.clientWidth + .5);
          if (y) visible &&= boxes.every(b => b.top >= t - .5 && b.bottom <= t + n.clientHeight + .5);
        }
      }
      return { rect: rect(r), boxes: boxes.map(rect), opaque, visible, clipping, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    };
    const headings = [...document.querySelectorAll('.content-top .title, .pg-panel > .page-title')].map(el => ({ text: el.textContent, paint: paint(el, true) }));
    const rows = [...document.querySelectorAll('.code-approval-defaults > .li')].map(el => {
      const title = el.querySelector('.ttl'), sub = el.querySelector('.sub'), ctl = el.querySelector('button,[role="switch"]');
      const t = paint(title, true), d = paint(sub, true), c = paint(ctl), allocated = sub.parentElement.getBoundingClientRect();
      return { title: title.textContent, description: sub.textContent, titlePaint: t, descriptionPaint: d, control: c, allocated: rect(allocated),
        belowTitle: d.boxes.length > 0 && d.boxes.every(b => b.top >= Math.max(...t.boxes.map(x => x.bottom))),
        fitsAllocated: [...t.boxes, ...d.boxes].every(b => b.left >= allocated.left - .5 && b.right <= allocated.right + .5),
        clearOfControl: [...t.boxes, ...d.boxes].every(b => b.right <= c.rect.left || b.left >= c.rect.right || b.bottom <= c.rect.top || b.top >= c.rect.bottom) };
    });
    const win = document.querySelector('.window');
    return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, lang: document.documentElement.lang, locale: localStorage.getItem('cortex.locale'), theme: document.documentElement.dataset.theme,
      host: document.querySelector('.desk').dataset.host, window: rect(win.getBoundingClientRect()), sidebar: win.dataset.sidebar,
      fonts: { status: document.fonts.status, declared: [...document.fonts].map(f => ({ family: f.family, status: f.status })), bodyFamily: getComputedStyle(document.body).fontFamily, browserLanguages: navigator.languages },
      headings, rows, fullOpacity: headings.every(h => h.paint.opaque) && rows.length === 2 && rows.every(r => [r.titlePaint, r.descriptionPaint, r.control].every(p => p.opaque)) };
  });
  for (const locale of locales) for (const theme of ['light', 'dark']) {
    const catalog = json(path.join(root, `packages/i18n/locales/${locale}/code.json`));
    active = { locale, theme, errors: [], checks: [], expected: { headings: [catalog['settings.title'], catalog['settings.approvals']], titles: [catalog['settings.defaultModel'], catalog['settings.notify']], descriptions: [catalog['settings.defaultModelSub'], catalog['settings.notifySub']], model: catalog['model.thinking'], switch: catalog['settings.notifyLabel'] } };
    report.views.push(active);
    await page.evaluate(({ locale, theme }) => { localStorage.setItem('cortex.locale', locale); localStorage.setItem('cortex.theme', theme); location.hash = `#/code-settings?shot&v=approvals&theme=${theme}`; }, { locale, theme });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.code-approval-defaults > .li')).toHaveCount(2); await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => (await measure()).fullOpacity).toBe(true);
    active.before = await measure();
    const check = (name, passed) => active.checks.push({ name, passed: !!passed });
    const m = active.before;
    check('exact 960x640 desktop/sidebar', m.host === 'desktop' && m.viewport[0] === 960 && m.viewport[1] === 640 && m.window.width === 960 && m.window.height === 640 && m.sidebar === 'shown');
    check('locale and loaded fonts', m.lang === locale && m.locale === locale && m.fonts.status === 'loaded');
    check('catalog headings', JSON.stringify(m.headings.map(h => h.text)) === JSON.stringify(active.expected.headings));
    check('catalog row titles', JSON.stringify(m.rows.map(r => r.title)) === JSON.stringify(active.expected.titles));
    check('catalog row descriptions', JSON.stringify(m.rows.map(r => r.description)) === JSON.stringify(active.expected.descriptions));
    check('headings painted', m.headings.every(h => h.paint.opaque && h.paint.visible));
    for (const [i, row] of m.rows.entries()) {
      check(`row ${i + 1}: complete painted text/control`, [row.titlePaint, row.descriptionPaint, row.control].every(p => p.opaque && p.visible) && row.control.hit);
      check(`row ${i + 1}: description below title`, row.belowTitle); check(`row ${i + 1}: allocated text width`, row.fitsAllocated); check(`row ${i + 1}: no text/control overlap`, row.clearOfControl);
    }
    const doc = await cdp.send('DOM.getDocument'); const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: '.code-approval-defaults .ttl, .code-approval-defaults .sub' });
    active.platformFonts = await Promise.all(nodeIds.map(async nodeId => (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts));
    check('actual text font glyphs reported', active.platformFonts.length === 4 && active.platformFonts.every(fonts => fonts.some(f => f.glyphCount > 0)));
    await page.locator('.pg-nav button').last().focus(); active.keyboard = [];
    const controls = [page.locator('.code-approval-defaults > .li').nth(0).locator('button'), page.locator('.code-approval-defaults > .li').nth(1).locator('[role="switch"]')];
    for (const [i, ctl] of controls.entries()) {
      await page.keyboard.press('Tab'); await expect(ctl).toBeFocused(); await expect(ctl).toBeEnabled();
      const k = await ctl.evaluate(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, label: el.getAttribute('aria-label'), role: el.getAttribute('role'), focused: document.activeElement === el, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }; });
      active.keyboard.push(k); check(`Tab control ${i + 1}: localized and hittable`, k.focused && k.hit && (i === 0 ? k.text === active.expected.model : k.label === active.expected.switch));
    }
    active.after = await measure(); check('full opacity after keyboard', active.after.fullOpacity);
    const file = `screens/approvals-${locale}-${theme}.png`, png = await page.screenshot({ path: path.join(out, file) });
    active.capture = { file, sha256: sha(png), pixels: [png.readUInt32BE(16), png.readUInt32BE(20)] };
    check('960x640 screenshot', active.capture.pixels[0] === 960 && active.capture.pixels[1] === 640); check('no page/console errors', active.errors.length === 0);
    active.status = active.checks.every(c => c.passed) ? 'passed' : 'failed'; save();
    console.log(`${locale} ${theme}: ${active.status}${active.status === 'failed' ? '; ' + active.checks.filter(c => !c.passed).map(c => c.name).join(', ') : ''}`);
    assert.equal(active.status, 'passed', 'Stop at the first failed locale; retain its negative capture and source unchanged');
  }
  report.runtime = await app.evaluate(() => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform }));
  assert.equal(report.views.length, 16); report.status = report.views.every(v => v.status === 'passed') && !report.startupErrors.length ? 'passed' : 'failed';
} catch (e) { report.status = 'failed'; report.fatal = String(e.stack || e); }
finally {
  try { report.membersAfter = verifyInputs(); } catch (e) { report.status = 'failed'; report.integrityFailure = String(e); }
  report.finishedAt = new Date().toISOString(); save(); if (app) await app.close();
}
console.log(`Report: ${path.join(out, 'manifest.json')}`);
process.exitCode = report.status === 'passed' ? 0 : 1;
