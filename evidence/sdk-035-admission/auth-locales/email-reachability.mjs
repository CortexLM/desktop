// Follow-up only: retain the email step's initial clipping, prove Tab/scroll reachability.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd(), out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'email-reachability');
assert(!fs.existsSync(out)); fs.mkdirSync(out);
const sha = value => createHash('sha256').update(value).digest('hex'), json = file => JSON.parse(fs.readFileSync(file));
const frozen = '/tmp/opencode/build-7885736', members = json(path.join(frozen, 'members.json')).members;
const integrity = () => { for (const m of members) for (const base of [root, frozen]) assert.equal(sha(fs.readFileSync(path.join(base, m.path))), m.sha256); return { count: members.length, matched: true }; };
const report = { status: 'running', before: integrity(), startedAt: new Date().toISOString(), scriptSHA256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), views: [], errors: [], rendererHttp: [] };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const { _electron } = await import(pathToFileURL(path.join(root, 'node_modules/playwright/index.mjs')).href);
const { expect } = await import(pathToFileURL(path.join(root, 'node_modules/@playwright/test/index.mjs')).href);
let app, active;
try {
  const env = { ...process.env, NODE_ENV: 'test', TMPDIR: path.dirname(fileURLToPath(import.meta.url)) + '/temp', HOME: path.join(out, 'home'), CORTEX_DATA_DIR: path.join(out, 'engine'), CORTEX_START_HASH: '#/login?theme=light', CORTEX_LOCALE: 'en', CORTEX_CATALOG_URL: 'data:application/json,{}', CORTEX_TEST_PROVIDER_BASEURL: '' };
  fs.mkdirSync(env.HOME); delete env.CORTEX_RENDERER_URL;
  app = await _electron.launch({ args: [path.join(root, 'packages/desktop/dist/main.cjs'), `--user-data-dir=${path.join(out, 'profile')}`, '--no-sandbox'], env });
  const page = await app.firstWindow(); page.setDefaultTimeout(12000);
  page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('request', req => { if (/^https?:/.test(req.url())) report.rendererHttp.push(sha(req.url())); });
  await page.waitForFunction(() => !!window.__bridgeFetch); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  const measure = () => page.evaluate(() => {
    const c = document.querySelector('.systeme-center'), b = c.getBoundingClientRect();
    const control = el => {
      const r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
      const boxes = [...range.getClientRects()].filter(x => x.width && x.height);
      return { text: el.textContent, label: el.getAttribute('aria-label'), focused: el === document.activeElement, enabled: !el.disabled,
        rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height },
        visible: r.top >= b.top && r.bottom <= b.bottom && r.left >= b.left && r.right <= b.right,
        textVisible: boxes.every(x => x.top >= b.top && x.bottom <= b.bottom && x.left >= b.left && x.right <= b.right),
        hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    };
    return { viewport: [innerWidth, innerHeight], lang: document.documentElement.lang, theme: document.documentElement.dataset.theme,
      center: { top: b.top, bottom: b.bottom, scrollTop: c.scrollTop, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight },
      logo: control(document.querySelector('.systeme-logo')), controls: [...document.querySelectorAll('.systeme-login input, .systeme-login button')].map(control) };
  });
  for (const locale of ['fr', 'de', 'ja']) for (const theme of ['light', 'dark']) {
    active = { locale, theme, status: 'running', keyboard: [] }; report.views.push(active);
    await page.evaluate(({ locale, theme }) => { localStorage.setItem('cortex.locale', locale); location.hash = `#/login?theme=${theme}`; }, { locale, theme }); await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('#systeme-em')).toBeEditable();
    await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => document.querySelector('.systeme-login').getAnimations({ subtree: true }).every(a => a.playState === 'finished'));
    await page.locator('#systeme-em').fill('person@example.test'); active.initial = await measure();
    const initialFile = `${locale}-${theme}-initial.png`, initialPng = await page.screenshot({ path: path.join(out, initialFile) }); active.initialCapture = { file: initialFile, sha256: sha(initialPng) };
    assert.deepEqual(active.initial.viewport, [960, 640]);
    await page.locator('.content-top button').focus(); const controls = page.locator('.systeme-login input, .systeme-login button');
    for (let i = 0; i < await controls.count(); i++) {
      await page.keyboard.press('Tab'); await expect(controls.nth(i)).toBeFocused(); await expect(controls.nth(i)).toBeEnabled();
      // Focus-scroll may use the platform's smooth behavior; wait for its real endpoint.
      await expect.poll(async () => { const m = await measure(), k = m.controls[i]; return k.visible && k.textVisible && k.hit; }, { timeout: 3000 }).toBe(true);
      active.keyboard.push((await measure()).controls[i]);
    }
    const common = json(path.join(root, `packages/i18n/locales/${locale}/common.json`)); active.afterTab = await measure();
    assert.equal(active.afterTab.controls.at(-1).text, common.cancel); assert(active.afterTab.controls.at(-1).focused);
    const afterFile = `${locale}-${theme}-cancel-focused.png`, afterPng = await page.screenshot({ path: path.join(out, afterFile) }); active.afterCapture = { file: afterFile, sha256: sha(afterPng) };
    await page.keyboard.press('Enter'); await expect(page).toHaveURL(/#\/home(?:\?|$)/); active.cancelNavigatedHome = true;
    assert.equal(report.errors.length, 0); assert.equal(report.rendererHttp.length, 0); active.status = 'passed'; save(); console.log(`${locale} ${theme}: Cancel reachable by Tab; Enter returns Home`);
  }
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); if (active) active.status = 'failed'; }
finally { if (app) await app.close(); report.after = integrity(); report.finishedAt = new Date().toISOString(); save(); }
process.exitCode = report.status === 'passed' ? 0 : 1;
