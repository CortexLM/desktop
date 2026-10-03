import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd(), out = path.dirname(fileURLToPath(import.meta.url)), frozen = '/tmp/opencode/build-7885736';
const revision = '78857365a509d78af10ebdda5b52348a2e50e961', locales = ['en', 'fr', 'es', 'de', 'ja', 'zh-Hans', 'pt-BR', 'ko'];
const sha = value => createHash('sha256').update(value).digest('hex'), read = file => fs.readFileSync(file), json = file => JSON.parse(read(file));
assert(!fs.existsSync(path.join(out, 'manifest.json')), 'Preserve prior run evidence');
const members = json(path.join(frozen, 'members.json')), pins = json(path.join(frozen, 'pinned-inputs.json'));
const inputs = [...locales.flatMap(locale => ['system', 'common'].map(ns => `packages/i18n/locales/${locale}/${ns}.json`)), 'packages/app/src/screens/system/account.tsx', 'packages/app/src/screens/system/system.css'];
function integrity() {
  assert.equal(members.revision, revision); assert.equal(members.members.length, 90);
  for (const member of members.members) for (const base of [root, frozen]) assert.equal(sha(read(path.join(base, member.path))), member.sha256, `Dist mismatch: ${member.path}`);
  for (const file of inputs) assert.equal(sha(read(path.join(root, file))), pins.inputs.find(p => p.path === file)?.sha256, `Catalog/renderer mismatch: ${file}`);
  return { members: 90, matched: true, orderedDigest: sha(JSON.stringify(members.members.map(({ path, sha256 }) => ({ path, sha256 })))), checkedSource: Object.fromEntries(inputs.map(file => [file, sha(read(path.join(root, file)))])) };
}
const privateValues = Array.from({ length: 8 }, () => `test-only-auth-${randomUUID()}`);
const redact = value => privateValues.reduce((text, secret) => text.replaceAll(secret, '[fixture-private]'), String(value));
const counts = { email: 0, sendRefused: 0, code: 0, wrongCode: 0, session: 0, enrollment: 0, discovery: 0, logout: 0 };
const fixture = { origin: '', counts, freshRequestsCredentialFree: true, errors: [], failSend: false };
const report = { status: 'running', startedAt: new Date().toISOString(), revision, headAtStart: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  before: integrity(), scriptSHA256: sha(read(fileURLToPath(import.meta.url))), harnessNode: process.version, sourceReceipt: json(path.join(frozen, 'source.json')),
  currentMainSourceMatchesPin: sha(read(path.join(root, 'packages/desktop/src/remote-session.ts'))) === pins.inputs.find(p => p.path === 'packages/desktop/src/remote-session.ts').sha256,
  views: [], auxiliary: [], startupErrors: [], rendererHttp: [], fixture: { counts }, fatal: null };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
for (const directory of ['screens', 'profile', 'engine', 'temp', 'home']) fs.mkdirSync(path.join(out, directory), { recursive: true });
const send = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const empty = res => { res.writeHead(204); res.end(); };
const problem = (res, status, code) => { res.writeHead(status, { 'content-type': 'application/problem+json' }); res.end(JSON.stringify({ type: 'about:blank', title: 'Authentication refused', status, code, request_id: 'req_test_locale_auth', detail: privateValues[7] })); };
const server = http.createServer((req, res) => { void (async () => {
  assert.equal(req.headers.host, new URL(fixture.origin).host); assert.equal(req.headers.origin, undefined);
  let text = ''; for await (const chunk of req) { text += chunk; assert(text.length <= 16384); }
  const body = text ? JSON.parse(text) : {}, route = new URL(req.url, fixture.origin).pathname;
  if (req.method === 'GET' && ['/readyz', '/v1/instance', '/v1/registry/models'].includes(route)) {
    counts.discovery++;
    if (route === '/readyz') { res.end('ok'); return; }
    return send(res, route === '/v1/instance' ? { mode: 'self_host', version: 'test', auth: { mode: 'cortex', required: true, providers: ['cortex'] }, registry: { enabled: true } } : { items: [], has_more: false, source: 'cache' });
  }
  if (req.method === 'POST' && ['/v1/auth/magic-auth', '/v1/auth/magic-auth/verify'].includes(route)) {
    assert(['person@example.test', 'mfa@example.test'].includes(body.email));
    fixture.freshRequestsCredentialFree &&= !req.headers.cookie && !req.headers.authorization;
    if (route === '/v1/auth/magic-auth') {
      assert.deepEqual(Object.keys(body), ['email']); counts.email++;
      if (fixture.failSend) { counts.sendRefused++; return problem(res, 429, 'rate_limited'); }
      return empty(res);
    }
    assert.deepEqual(Object.keys(body).sort(), ['code', 'email']); assert(['000000', '123456'].includes(body.code)); counts.code++;
    if (body.code === '000000') { counts.wrongCode++; return problem(res, 401, 'invalid_credential'); }
    if (body.email === 'mfa@example.test') {
      counts.enrollment++; return send(res, { status: 'mfa_enrollment', pending_authentication_token: privateValues[2], authentication_challenge_id: privateValues[3], authentication_factor_id: privateValues[4], qr_code: privateValues[5], totp_secret: privateValues[6] });
    }
    counts.session++; res.setHeader('set-cookie', `cortex_rt=${privateValues[1]}; HttpOnly; SameSite=Lax; Path=/v1/auth; Max-Age=3600`);
    return send(res, { status: 'session', access_token: privateValues[0] });
  }
  if (req.method === 'POST' && route === '/v1/auth/logout') { counts.logout++; return empty(res); }
  fixture.errors.push({ type: 'unexpected_request', method: req.method, pathSHA256: sha(route) }); problem(res, 404, 'not_found');
})().catch(error => { fixture.errors.push({ type: 'fixture_validation', message: redact(error.message) }); if (!res.headersSent) problem(res, 500, 'internal'); else res.end(); }); });

const { _electron } = await import(pathToFileURL(path.join(root, 'node_modules/playwright/index.mjs')).href);
const { expect: baseExpect } = await import(pathToFileURL(path.join(root, 'node_modules/@playwright/test/index.mjs')).href);
const expect = baseExpect.configure({ timeout: 12000 });
let app, page, active, stage = 'launch';
const check = (name, passed) => { active.checks.push({ name, passed: !!passed }); assert(passed, name); };
const request = (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
  const res = await window.__bridgeFetch(`cortex://local${route}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, headers: [...res.headers], body: await res.json() };
}, { route, method, body });
const call = async (route, method = 'GET', body) => { const res = await request(route, method, body); assert(res.status >= 200 && res.status < 300, `Bridge refused ${route}: ${res.status}`); return res.body; };
const auth = body => call('/api/connection/auth', 'POST', body);
async function privacy() {
  const wire = await request('/api/connection/auth'); assert.equal(wire.status, 200);
  assert.deepEqual(Object.keys(wire.body).sort(), (wire.body.email === undefined ? ['signedIn', 'status'] : ['email', 'signedIn', 'status']).sort());
  const browser = await page.evaluate(async () => ({ html: document.documentElement.outerHTML, local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie,
    indexedDB: await indexedDB.databases(), caches: typeof caches === 'undefined' ? [] : await caches.keys() }));
  const cookies = await app.context().cookies(), snapshot = JSON.stringify({ wire, browser, cookies });
  assert(privateValues.every(value => !snapshot.includes(value)), 'Private fixture material reached renderer');
  assert(!wire.headers.some(([name]) => name.toLowerCase() === 'set-cookie')); assert.equal(browser.cookie, ''); assert.deepEqual(cookies, []); assert.deepEqual(browser.indexedDB, []); assert.deepEqual(browser.caches, []);
  assert.equal(report.rendererHttp.length, 0); return { privateMaterialAbsent: true, setCookieAbsent: true, rendererCookieCount: 0, rendererHttpCount: 0, auth: wire.body };
}
const capture = async file => {
  await privacy(); const png = await page.screenshot({ path: path.join(out, file) });
  return { file, sha256: sha(png), pixels: [png.readUInt32BE(16), png.readUInt32BE(20)] };
};
const inspect = selector => page.evaluate(selector => {
  const rect = r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  return [...document.querySelectorAll(selector)].map(el => {
    const r = el.getBoundingClientRect(), boxes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent.trim() && !node.parentElement.closest('svg')) {
      const range = document.createRange(); range.selectNodeContents(node); boxes.push(...[...range.getClientRects()].filter(b => b.width && b.height));
    }
    let visible = boxes.length > 0 && boxes.every(b => b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight);
    let boxVisible = r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, opaque = true;
    const clipping = [], opacities = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n), b = n.getBoundingClientRect(), left = b.left + n.clientLeft, top = b.top + n.clientTop;
      if (Number(s.opacity) !== 1) opacities.push({ className: n.className, opacity: Number(s.opacity) });
      opaque &&= Number(s.opacity) === 1 && s.visibility === 'visible' && s.display !== 'none';
      const x = /^(auto|scroll|hidden|clip)$/.test(s.overflowX), y = /^(auto|scroll|hidden|clip)$/.test(s.overflowY);
      if (x || y) clipping.push({ className: n.className, x, y, left, top, right: left + n.clientWidth, bottom: top + n.clientHeight });
      if (x) { visible &&= boxes.every(b => b.left >= left - .5 && b.right <= left + n.clientWidth + .5); if (n !== el) boxVisible &&= r.left >= left - .5 && r.right <= left + n.clientWidth + .5; }
      if (y) { visible &&= boxes.every(b => b.top >= top - .5 && b.bottom <= top + n.clientHeight + .5); if (n !== el) boxVisible &&= r.top >= top - .5 && r.bottom <= top + n.clientHeight + .5; }
    }
    const key = `${el.tagName}.${el.className}:${el.textContent.trim()}`;
    return { key, tag: el.tagName, className: el.className, text: el.textContent.trim(), label: el.getAttribute('aria-label'), value: el.tagName === 'INPUT' ? el.value : undefined,
      rect: rect(r), boxes: boxes.map(rect), visible, boxVisible, opaque, opacities, clipping, focused: document.activeElement === el,
      enabled: !el.disabled, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
      textFitsWidth: boxes.every(b => b.left >= r.left - .5 && b.right <= r.right + .5) };
  });
}, selector);
const textSelector = '.systeme-login h1, .systeme-login .systeme-lead, .systeme-login .systeme-err, .systeme-login .systeme-otp-meta, .systeme-login button, .systeme-cell';
async function measure() {
  const [texts, controls, ornament, env, native] = await Promise.all([
    inspect(textSelector), inspect('.systeme-login button, .systeme-login input'), inspect('.systeme-login > .systeme-logo, .systeme-login > .li-ic'),
    page.evaluate(() => { const c = document.querySelector('.systeme-center'), w = document.querySelector('.window'); return {
      viewport: [innerWidth, innerHeight], lang: document.documentElement.lang, locale: localStorage.getItem('cortex.locale'), theme: document.documentElement.dataset.theme, url: location.href,
      fonts: { status: document.fonts.status, declared: [...document.fonts].map(f => ({ family: f.family, status: f.status })), browserLanguages: navigator.languages }, sidebar: w.dataset.sidebar,
      window: { width: w.getBoundingClientRect().width, height: w.getBoundingClientRect().height }, scroll: { top: c.scrollTop, height: c.scrollHeight, client: c.clientHeight } }; }),
    app.evaluate(({ BrowserWindow }) => { const windows = BrowserWindow.getAllWindows(); return { count: windows.length, bounds: windows[0].getBounds(), content: windows[0].getContentBounds() }; }),
  ]);
  return { texts, controls, ornament, env, native };
}
async function settled() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.systeme-login, .toast')].every(el => el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState === 'finished')));
}
async function fonts(selector) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const { root } = await cdp.send('DOM.getDocument');
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
    return await Promise.all(nodeIds.map(async nodeId => (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts));
  } finally { await cdp.detach(); }
}
async function wheel(delta) {
  const box = await page.locator('.systeme-center').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, delta); await page.waitForTimeout(180); active.scrolling.push({ input: 'wheel', delta });
}
async function reachable(locator) {
  // Native wheel input only; preserve initial layout before any recovery scroll.
  for (let attempt = 0; attempt < 4; attempt++) {
    const visible = await locator.evaluate(el => { const r = el.getBoundingClientRect(), c = document.querySelector('.systeme-center').getBoundingClientRect(); return { fits: r.top >= c.top && r.bottom <= c.bottom, direction: r.top < c.top ? -1 : 1 }; });
    if (visible.fits) return;
    await wheel(visible.direction * 220);
  }
  assert(false, 'Control not reachable through native wheel input');
}
async function auxiliary(locale, theme, catalog) {
  active = { locale, theme, state: 'email-auxiliary', keys: ['auth.sendFailed', 'auth.optionUnavailable'], status: 'running', checks: [], errors: [], scrolling: [] }; report.auxiliary.push(active);
  stage = `${locale}/${theme}/option-unavailable`;
  active.initial = await measure();
  const provider = page.locator('.systeme-providers button').first(); await reachable(provider); await provider.click();
  await expect(page.locator('.toast .t-desc')).toHaveText(catalog['auth.optionUnavailable']); await settled();
  active.option = { measurements: await inspect('.toast .t-title, .toast .t-desc'), fonts: await fonts('.toast .t-title, .toast .t-desc') };
  check('optionUnavailable complete painted copy', active.option.measurements.length === 2 && active.option.measurements.every(t => t.visible && t.textFitsWidth && t.opacities.every(o => o.className === 't-desc' && o.opacity === .7)));
  check('optionUnavailable localized', active.option.measurements[1].text === catalog['auth.optionUnavailable']);
  await page.reload(); await expect(page.locator('#systeme-em')).toBeEditable(); await settled();
  stage = `${locale}/${theme}/send-failed`; fixture.failSend = true;
  await page.getByRole('textbox', { name: catalog['login.email'], exact: true }).fill('person@example.test');
  const getCode = page.getByRole('button', { name: catalog['login.getCode'], exact: true }); await reachable(getCode); await getCode.click();
  await expect(page.locator('.systeme-login [role="alert"]')).toHaveText(catalog['auth.sendFailed']); await settled();
  active.sendInitial = await inspect('.systeme-login .systeme-err');
  const error = page.locator('.systeme-login .systeme-err'); await reachable(error);
  active.send = { measurements: await inspect('.systeme-login .systeme-err'), fonts: await fonts('.systeme-login .systeme-err') };
  check('sendFailed complete painted copy', active.send.measurements[0].visible && active.send.measurements[0].opaque && active.send.measurements[0].textFitsWidth);
  check('sendFailed localized', active.send.measurements[0].text === catalog['auth.sendFailed']);
  check('auxiliary glyph-bearing font evidence', [...active.option.fonts, ...active.send.fonts].every(group => group.some(f => f.glyphCount > 0)));
  active.privacy = await privacy(); check('no auxiliary page/console errors', active.errors.length === 0);
  active.status = 'passed'; fixture.failSend = false; save();
}
async function prove(locale, theme, state, catalog, common) {
  stage = `${locale}/${theme}/${state}`; active = { locale, theme, state, keys: state === 'wrong-code' ? ['auth.failed'] : state === 'signed-in' ? ['auth.signedIn', 'auth.sessionOnly', 'auth.settings'] : ['auth.continuationUnavailable'], status: 'running', checks: [], errors: [], scrolling: [], keyboard: [] }; report.views.push(active);
  await settled(); active.initial = await measure(); active.capture = await capture(`screens/auth-${locale}-${theme}-${state}.png`); save();
  const m = active.initial, heading = state === 'wrong-code' ? catalog['login.checkTitle'] : state === 'signed-in' ? catalog['auth.signedIn'] : catalog.unavailable;
  const body = state === 'wrong-code' ? `${catalog['login.checkLead']} person@example.test.` : state === 'signed-in' ? catalog['auth.sessionOnly'] : catalog['auth.continuationUnavailable'];
  check('real live route, locale, theme', m.env.url.endsWith(`#/login?theme=${theme}`) && m.env.lang === locale && m.env.locale === locale && m.env.theme === theme);
  check('one 960x640 native client and renderer', m.native.count === 1 && m.native.content.width === 960 && m.native.content.height === 640 && m.env.viewport[0] === 960 && m.env.viewport[1] === 640 && m.env.window.width === 960 && m.env.window.height === 640);
  check('fonts ready', m.env.fonts.status === 'loaded');
  check('localized heading', m.texts.find(t => t.tag === 'H1')?.text === heading);
  check('localized body', m.texts.find(t => t.className === 'systeme-lead')?.text === body);
  check('full opacity and text width', m.texts.every(t => t.opaque && t.textFitsWidth));
  const apart = (a, b) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
  check('heading/body/error clear of controls', m.texts.filter(t => t.tag === 'H1' || ['systeme-lead', 'systeme-err'].includes(t.className)).every(t => t.boxes.every(b => m.controls.every(c => apart(b, c.rect)))));
  check('controls do not overlap', m.controls.every((c, i) => m.controls.slice(i + 1).every(d => apart(c.rect, d.rect))));
  const buttons = state === 'wrong-code' ? [catalog['login.resend'], catalog['onb.continue'], catalog['login.otherEmail'], common.cancel]
    : state === 'signed-in' ? [catalog['onb.continue'], catalog['auth.settings']] : [catalog['login.otherEmail'], common.cancel];
  check('localized button order', JSON.stringify(m.controls.filter(c => c.tag === 'BUTTON').map(c => c.text)) === JSON.stringify(buttons));
  if (state === 'wrong-code') {
    check('localized refusal', m.texts.find(t => t.className === 'systeme-err')?.text === catalog['auth.failed']);
    const input = page.getByRole('textbox', { name: catalog['login.codeLabel'], exact: true }); await expect(input).toHaveValue('000000'); await expect(input).toBeEditable();
    check('wrong code retained in painted cells', m.texts.filter(t => t.className.includes('systeme-cell')).map(t => t.text).join('') === '000000');
  }
  active.platformFonts = await fonts('.systeme-login h1, .systeme-login .systeme-lead, .systeme-login .systeme-err, .systeme-login button, .systeme-cell');
  check('actual glyph-bearing font evidence', active.platformFonts.length > 0 && active.platformFonts.every(group => group.some(f => f.glyphCount > 0)));
  active.scrollSamples = [];
  const covered = new Set(m.texts.filter(t => t.visible).map(t => t.key));
  if (covered.size < new Set(m.texts.map(t => t.key)).size) {
    for (const delta of [-1200, 240, 240, -1200]) {
      await wheel(delta); const sample = await measure(); active.scrollSamples.push(sample); sample.texts.filter(t => t.visible).forEach(t => covered.add(t.key));
      if (m.texts.every(t => covered.has(t.key))) break;
    }
  }
  check('all copy accessible without clipping', m.texts.every(t => covered.has(t.key)));
  await page.locator('.content-top button').focus();
  const controls = page.locator('.systeme-login input, .systeme-login button');
  for (let i = 0; i < await controls.count(); i++) {
    await page.keyboard.press('Tab'); await expect(controls.nth(i)).toBeFocused(); await expect(controls.nth(i)).toBeEnabled();
    const k = (await inspect('.systeme-login input, .systeme-login button'))[i]; active.keyboard.push(k);
    check(`Tab ${i + 1}: label, full bounds and center hit`, k.focused && k.boxVisible && k.hit && (k.tag === 'INPUT' ? k.label === catalog['login.codeLabel'] : k.visible && k.opaque));
  }
  active.after = await measure(); active.privacy = await privacy();
  const expectedStatus = state === 'wrong-code' ? 'code_sent' : state === 'signed-in' ? 'signed_in' : 'mfa_enrollment';
  check('real main authentication status', active.privacy.auth.status === expectedStatus && active.privacy.auth.signedIn === (state === 'signed-in'));
  check('canonical connection sign-in', (await call('/api/connection')).signedIn === (state === 'signed-in'));
  check('no scoped errors or renderer HTTP', !active.errors.length && !fixture.errors.length && !report.rendererHttp.length);
  check('960x640 capture', active.capture.pixels[0] === 960 && active.capture.pixels[1] === 640);
  active.status = 'passed'; active.fixtureCounts = { ...counts }; save(); console.log(`${locale} ${theme} ${state}: passed`);
}
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); fixture.origin = `http://127.0.0.1:${server.address().port}`;
  report.fixture.origin = fixture.origin;
  const env = { ...process.env, NODE_ENV: 'test', TMPDIR: path.join(out, 'temp'), HOME: path.join(out, 'home'), CORTEX_DATA_DIR: path.join(out, 'engine'), CORTEX_START_HASH: '#/login?theme=light', CORTEX_LOCALE: 'en', CORTEX_CATALOG_URL: 'data:application/json,{}', CORTEX_TEST_PROVIDER_BASEURL: '' };
  delete env.CORTEX_RENDERER_URL;
  app = await _electron.launch({ args: [path.join(root, 'packages/desktop/dist/main.cjs'), `--user-data-dir=${path.join(out, 'profile')}`, '--no-sandbox'], env, timeout: 30000 });
  page = await app.firstWindow(); page.setDefaultTimeout(12000);
  const error = (type, value) => (active ? active.errors : report.startupErrors).push({ type, message: redact(value) });
  page.on('pageerror', e => error('pageerror', e.message)); page.on('console', m => { if (m.type() === 'error') error('console', m.text()); });
  page.on('request', req => { if (/^https?:/.test(req.url())) report.rendererHttp.push({ urlSHA256: sha(req.url()), method: req.method() }); });
  await page.waitForFunction(() => !!window.__bridgeFetch); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
  assert.deepEqual(await call('/api/connection', 'PUT', { mode: 'selfhost', url: `${fixture.origin}/`, signedIn: true }), { mode: 'selfhost', url: fixture.origin, signedIn: false });
  for (const locale of locales) for (const theme of ['light', 'dark']) {
    const catalog = json(path.join(root, `packages/i18n/locales/${locale}/system.json`)), common = json(path.join(root, `packages/i18n/locales/${locale}/common.json`));
    stage = `${locale}/${theme}/setup`; await auth({ action: 'logout' });
    await page.evaluate(({ locale, theme }) => { localStorage.setItem('cortex.locale', locale); localStorage.setItem('cortex.theme', theme); location.hash = `#/login?theme=${theme}`; }, { locale, theme });
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('#systeme-em')).toBeEditable(); await settled();
    await auxiliary(locale, theme, catalog);
    const getCode = page.getByRole('button', { name: catalog['login.getCode'], exact: true }); await reachable(getCode); await getCode.click();
    const code = page.getByRole('textbox', { name: catalog['login.codeLabel'], exact: true }); await expect(code).toBeEditable(); await code.fill('000000');
    await page.getByRole('button', { name: catalog['onb.continue'], exact: true }).click(); await expect(page.locator('.systeme-err')).toHaveText(catalog['auth.failed']);
    await prove(locale, theme, 'wrong-code', catalog, common);
    await code.fill('123456'); await page.getByRole('button', { name: catalog['onb.continue'], exact: true }).click(); await expect(page.locator('.systeme-login h1')).toHaveText(catalog['auth.signedIn']);
    await page.reload(); await expect(page.locator('.systeme-login h1')).toHaveText(catalog['auth.signedIn']); await prove(locale, theme, 'signed-in', catalog, common);
    await auth({ action: 'logout' }); await auth({ action: 'email', email: 'mfa@example.test' }); await page.reload(); await expect(code).toBeEditable();
    await code.fill('123456'); await page.getByRole('button', { name: catalog['onb.continue'], exact: true }).click(); await expect(page.locator('.systeme-login h1')).toHaveText(catalog.unavailable);
    await page.reload(); await expect(page.locator('.systeme-login h1')).toHaveText(catalog.unavailable); await prove(locale, theme, 'unavailable-enrollment', catalog, common);
  }
  assert.equal(report.views.length, 48); assert.equal(report.auxiliary.length, 16); assert.equal(fixture.errors.length, 0); assert.equal(report.startupErrors.length, 0); assert(fixture.freshRequestsCredentialFree);
  assert([...report.views, ...report.auxiliary].every(view => view.status === 'passed' && view.errors.length === 0));
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.fatal = { stage, message: redact(error.stack || error) }; if (active) active.status = 'failed';
  if (page) try { active.failureMeasurement = await measure(); active.failureCapture = await capture(`screens/failure-${report.views.length}-${report.auxiliary.length}.png`); } catch (failure) { report.failureEvidenceError = redact(failure.message); }
} finally {
  if (app) {
    report.runtime = await app.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome, embeddedNode: process.versions.node, platform: process.platform })).catch(() => null);
    try { await app.close(); report.appClosed = true; } catch (error) { report.status = 'failed'; report.closeError = redact(error.message); }
  }
  server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve));
  try { report.after = integrity(); } catch (error) { report.status = 'failed'; report.integrityError = redact(error.message); }
  report.fixture = { origin: fixture.origin, counts, freshRequestsCredentialFree: fixture.freshRequestsCredentialFree, errors: fixture.errors };
  report.finishedAt = new Date().toISOString(); save();
}
console.log(`Auth locale check: ${report.status}; ${path.join(out, 'manifest.json')}`); process.exitCode = report.status === 'passed' ? 0 : 1;
