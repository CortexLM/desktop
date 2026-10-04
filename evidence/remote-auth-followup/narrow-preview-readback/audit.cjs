const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { _electron } = require(path.join(process.cwd(), 'node_modules/playwright'));

const root = process.cwd();
const out = __dirname;
const approvalsOnly = process.argv.includes('--approvals-only');
const suffix = approvalsOnly ? '-approvals' : '';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const sourceFiles = ['packages/app/src/screens/files/docs.tsx', 'packages/app/src/screens/files/files.css', 'packages/app/src/screens/code/lot-code.tsx', 'packages/app/src/screens/code/lot-code.css', 'packages/app/src/screens/code/parts.tsx', 'packages/app/src/kit/styles.css'];
const report = {
  timestamp: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: 'Linux Electron under independent Xvfb; existing renderer served at http://127.0.0.1:5309; real preload/desktop layout',
  sources: Object.fromEntries(sourceFiles.map(f => [f, sha(fs.readFileSync(f))])),
  desktop: Object.fromEntries(['main', 'preload'].map(f => [f, sha(fs.readFileSync(`packages/desktop/dist/${f}.cjs`))])),
  views: [], screenshots: [], pageErrors: [], consoleErrors: [], checks: [],
};
function check(name, actual) { report.checks.push({ name, passed: !!actual }); }
function save() { fs.writeFileSync(path.join(out, `geometry${suffix}.json`), JSON.stringify(report, null, 2) + '\n'); }

async function geometry(page, kind) {
  return page.evaluate(kind => {
    const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const visible = el => {
      if (!el) return null;
      const b = el.getBoundingClientRect(); let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p), r = p.getBoundingClientRect();
        if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) { clip.left = Math.max(clip.left, r.left); clip.right = Math.min(clip.right, r.left + p.clientWidth); }
        if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY)) { clip.top = Math.max(clip.top, r.top); clip.bottom = Math.min(clip.bottom, r.top + p.clientHeight); }
      }
      const point = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { rect: rect(el), clip, fullyVisible: b.left >= clip.left - 1 && b.right <= clip.right + 1 && b.top >= clip.top - 1 && b.bottom <= clip.bottom + 1, centerHit: !!point && el.contains(point) };
    };
    const scroll = el => el ? { rect: rect(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, overflowX: getComputedStyle(el).overflowX, overflowY: getComputedStyle(el).overflowY, tabIndex: el.tabIndex } : null;
    const base = { innerWidth, innerHeight, dpr: devicePixelRatio, host: document.querySelector('.desk')?.dataset.host, platform: document.querySelector('.desk')?.dataset.platform, window: rect(document.querySelector('.window')), content: scroll(document.querySelector('main.content')), document: scroll(document.scrollingElement), theme: document.documentElement.dataset.theme };
    if (kind === 'docx') return { ...base, scroll: scroll(document.querySelector('.fichiers-scroll')), row: rect(document.querySelector('.fichiers-docrow')), article: rect(document.querySelector('.fichiers-a4')), comments: visible(document.querySelector('.fichiers-cmts')), reply: visible(document.querySelector('.fichiers-reply input')), cards: [...document.querySelectorAll('.fichiers-cmt')].map(visible) };
    if (kind === 'approvals') {
      const rs = el => [...el.getClientRects()].map(r => ({ x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height }));
      return { ...base, panel: rect(document.querySelector('.pg-panel')), rows: [...document.querySelectorAll('.pg-panel > .list > .li')].filter(el => el.querySelector('.ttl') && el.querySelector('.sub')).map(el => { const title = el.querySelector('.ttl'), sub = el.querySelector('.sub'); const tr = rs(title), sr = rs(sub); return { text: el.textContent, innerText: el.innerText, parentClass: title.parentElement.className, parentDisplay: getComputedStyle(title.parentElement).display, title: title.textContent, sub: sub.textContent, titleDisplay: getComputedStyle(title).display, subDisplay: getComputedStyle(sub).display, titleRects: tr, subRects: sr, touchingSameLine: Math.abs(tr.at(-1).y - sr[0].y) < 2 && Math.abs(tr.at(-1).right - sr[0].x) < 1, control: visible(el.querySelector('button')) }; }) };
    }
    const pane = document.querySelector('.code-split');
    const halves = [...document.querySelectorAll('.code-sr')].slice(0, 1).flatMap(row => [...row.querySelectorAll('.code-half')].map(rect));
    return { ...base, diff: scroll(pane), outerPane: scroll(document.querySelector('.code-dpane')), header: visible(document.querySelector('.code-file .code-head')), columns: halves, endpoints: [1, 2].map(side => {
      const lines = [...document.querySelectorAll(`.code-half:nth-child(${side}) .code-src`)];
      const el = lines.reduce((a, b) => b.textContent.length > a.textContent.length ? b : a), node = el.firstChild;
      const range = document.createRange(); range.setStart(node, Math.max(0, node.textContent.length - 1)); range.setEnd(node, node.textContent.length);
      const r = range.getBoundingClientRect(), p = pane.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { side, text: el.textContent, lastCharacter: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }, distanceToCenter: r.x + r.width / 2 - p.x - p.width / 2, visible: r.left >= p.left && r.right <= p.right && !!hit && el.contains(hit) };
    }) };
  }, kind);
}

async function waitFrame(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function wheel(page, selector, x, y) { await page.locator(selector).hover(); await page.mouse.wheel(x, y); await page.waitForTimeout(250); }
async function resetScroll(page, selector) { await page.locator(selector).evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; }); await waitFrame(page); }

(async () => {
  for (const d of [`profile${suffix}`, `engine${suffix}`, `temp${suffix}`, 'images']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const html = await (await fetch('http://127.0.0.1:5309/')).text();
  report.assets = [];
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
    const b = Buffer.from(await (await fetch('http://127.0.0.1:5309' + asset)).arrayBuffer());
    const local = fs.readFileSync(path.join(root, 'packages/app/dist', asset));
    assert(b.equals(local), 'HTTP asset differs from current dist');
    report.assets.push({ url: asset, sha256: sha(b), bytes: b.length });
  }
  assert(report.revision.startsWith('ffc118a'), 'Unexpected revision before runtime audit');
  const app = await _electron.launch({ args: [path.join(root, 'packages/desktop/dist/main.cjs'), `--user-data-dir=${path.join(out, `profile${suffix}`)}`, '--no-sandbox', '--disable-gpu'], env: { ...process.env, NODE_ENV: 'test', TMPDIR: path.join(out, `temp${suffix}`), CORTEX_DATA_DIR: path.join(out, `engine${suffix}`), CORTEX_LOCALE: 'en', CORTEX_CATALOG_URL: 'http://127.0.0.1:5309/audit-no-catalog', CORTEX_RENDERER_URL: 'http://127.0.0.1:5309/#/file-docx?theme=light&shot&v=comments' }, timeout: 30000 });
  try {
    const page = await app.firstWindow();
    page.on('pageerror', e => report.pageErrors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push({ text: msg.text(), location: msg.location() }); });
    await page.waitForFunction(() => !!window.cortex && !!document.querySelector('.fichiers-docrow'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const cases = [['docx', 'file-docx', 'comments', '.fichiers-docrow'], ['approvals', 'code-settings', 'approvals', '.code-radios'], ['diff', 'code-diff', 'split', '.code-split']].filter(c => !approvalsOnly || c[0] === 'approvals');
    for (const size of [{ width: 960, height: 640 }, { width: 1024, height: 686 }, { width: 1440, height: 900 }]) {
      await app.evaluate(({ BrowserWindow }, size) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(size.width, size.height); w.focus(); }, size);
      await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, size);
      for (const theme of ['light', 'dark']) for (const [kind, route, variant, selector] of cases) {
        const url = `http://127.0.0.1:5309/?audit=${kind}-${size.width}-${theme}#/${route}?theme=${theme}&shot&v=${variant}`;
        await app.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows()[0].loadURL(url), url);
        await page.waitForFunction(({ theme, selector }) => document.documentElement.dataset.theme === theme && !!document.querySelector(selector), { theme, selector });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(180);
        const view = { kind, size, theme, url, before: await geometry(page, kind) };
        report.views.push(view);
        check(`${kind}/${size.width}/${theme}: true desktop bounds`, view.before.host === 'desktop' && view.before.window.width === size.width && view.before.window.height === size.height);
        if (!approvalsOnly && ((size.width === 960 && theme === 'light') || (size.width === 1024 && theme === 'dark'))) {
          const filename = `${kind}-${size.width}x${size.height}-${theme}-initial.png`;
          const buffer = await page.screenshot({ path: path.join(out, 'images', filename) });
          report.screenshots.push({ file: `images/${filename}`, sha256: sha(buffer), view: report.views.length - 1, state: 'unaltered initial view' });
        }
        if (kind === 'docx') {
          await wheel(page, '.fichiers-scroll', 3000, 0);
          view.afterHorizontalWheel = await geometry(page, kind);
          check(`${kind}/${size.width}/${theme}: wheel reveals comments/reply`, view.afterHorizontalWheel.comments.fullyVisible && view.afterHorizontalWheel.reply.fullyVisible && view.afterHorizontalWheel.reply.centerHit);
          await resetScroll(page, '.fichiers-scroll');
          await page.locator('.fichiers-tbtn').last().focus();
          const trace = [];
          for (let n = 0; n < 12; n++) {
            await page.keyboard.press('Tab'); await waitFrame(page);
            const f = await page.evaluate(() => ({ tag: document.activeElement?.tagName, class: document.activeElement?.className, label: document.activeElement?.getAttribute('aria-label'), reply: !!document.activeElement?.matches('.fichiers-reply input'), scrollLeft: document.querySelector('.fichiers-scroll').scrollLeft }));
            trace.push(f); if (f.reply) break;
          }
          view.keyboardTabTrace = trace;
          view.afterKeyboardTab = await geometry(page, kind);
          check(`${kind}/${size.width}/${theme}: Tab reveals reply`, trace.at(-1).reply && view.afterKeyboardTab.reply.fullyVisible && view.afterKeyboardTab.reply.centerHit);
        } else if (kind === 'diff') {
          view.wheelEndpoints = [];
          for (const side of [1, 2]) {
            const g = await geometry(page, kind);
            await wheel(page, '.code-split', g.endpoints[side - 1].distanceToCenter, 0);
            const after = await geometry(page, kind); view.wheelEndpoints.push(after);
            check(`${kind}/${size.width}/${theme}: wheel reaches side ${side} last character`, after.endpoints[side - 1].visible);
          }
          await resetScroll(page, '.code-split');
          await page.locator('.code-file .code-head button').last().focus();
          await page.keyboard.press('Tab');
          view.keyboardStart = await page.evaluate(() => ({ tag: document.activeElement?.tagName, class: document.activeElement?.className, label: document.activeElement?.getAttribute('aria-label'), insideDiff: !!document.activeElement?.closest('.code-split') }));
          for (let n = 0; n < 65; n++) await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(350);
          view.afterKeyboardRight = await geometry(page, kind);
          check(`${kind}/${size.width}/${theme}: keyboard horizontal movement`, view.before.diff.scrollWidth <= view.before.diff.clientWidth || view.afterKeyboardRight.diff.scrollLeft > 0);
        } else {
          assert.equal(view.before.rows.length, 2, 'Approvals diagnostic requires exactly two label/description rows');
          check(`${kind}/${size.width}/${theme}: reproduces inline label-description join`, view.before.rows.every(r => r.touchingSameLine));
          // Diagnostic only: reuse the existing layout class, then restore exact markup.
          await page.locator('.pg-panel > .list > .li > .grow:has(> .ttl)').evaluateAll(els => els.forEach(el => el.className = 'code-grow'));
          await waitFrame(page);
          view.inMemoryCodeGrow = await geometry(page, kind);
          check(`${kind}/${size.width}/${theme}: existing code-grow separates title/description`, view.inMemoryCodeGrow.rows.every(r => !r.touchingSameLine && r.subRects[0].y >= r.titleRects.at(-1).bottom));
          await page.locator('.pg-panel > .list > .li > .code-grow:has(> .ttl)').evaluateAll(els => els.forEach(el => el.className = 'grow'));
          await page.locator('.pg-nav button').last().focus();
          view.keyboardControls = [];
          for (let i = 0; i < 2; i++) {
            await page.keyboard.press('Tab'); await waitFrame(page);
            view.keyboardControls.push(await page.evaluate(() => { const el = document.activeElement, r = el.getBoundingClientRect(), h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { text: el.textContent, label: el.getAttribute('aria-label'), role: el.getAttribute('role'), centerHit: !!h && el.contains(h) }; }));
          }
          check(`${kind}/${size.width}/${theme}: keyboard reaches both controls`, view.keyboardControls.every(c => c.centerHit));
        }
        save();
        console.log(`${kind} ${size.width}x${size.height} ${theme}: measured`);
      }
    }
    report.runtime = await app.evaluate(({ app, BrowserWindow }) => ({ electron: process.versions.electron, chrome: process.versions.chrome, appVersion: app.getVersion(), bounds: BrowserWindow.getAllWindows()[0].getBounds(), contentBounds: BrowserWindow.getAllWindows()[0].getContentBounds() }));
  } catch (e) { report.auditError = String(e.stack || e); throw e; }
  finally {
    report.sourceChanged = sourceFiles.filter(f => report.sources[f] !== sha(fs.readFileSync(f)));
    report.revisionAfter = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    save(); await app.close();
  }
  assert.equal(report.views.length, approvalsOnly ? 6 : 18);
  assert.equal(report.screenshots.length, approvalsOnly ? 0 : 6);
  assert.equal(report.sourceChanged.length, 0);
  console.log(JSON.stringify({ views: report.views.length, screenshots: report.screenshots.length, pageErrors: report.pageErrors, failedChecks: report.checks.filter(x => !x.passed) }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
