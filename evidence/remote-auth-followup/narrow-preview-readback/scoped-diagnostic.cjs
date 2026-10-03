const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { _electron } = require(path.join(process.cwd(), 'node_modules/playwright'));
const out = __dirname;
const report = { diagnosticOnly: true, sourceEdited: false, rule: '@media (max-width: 1200px) { .code-approval-defaults .grow { display: flex; flex-direction: column; gap: 2px; } .code-approval-defaults .sub { white-space: normal; } }', views: [], pageErrors: [] };
async function measure(page) {
  return page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    return { window: rect(document.querySelector('.window')), panel: rect(document.querySelector('.pg-panel')), rows: [...document.querySelectorAll('.pg-panel > .list > .li')].filter(el => el.querySelector('.ttl') && el.querySelector('.sub')).map(el => {
      const t = el.querySelector('.ttl'), s = el.querySelector('.sub'), control = el.querySelector('button,[role="switch"]'), r = rect(s), c = rect(control);
      const range = document.createRange(); range.selectNodeContents(s); const glyphs = [...range.getClientRects()].map(x => ({ x: x.x, right: x.right, y: x.y, bottom: x.bottom }));
      return { row: rect(el), title: rect(t), sub: r, text: s.textContent, glyphs, whiteSpace: getComputedStyle(s).whiteSpace, control: c, allSubGlyphsContained: glyphs.every(g => g.x >= r.x - 1 && g.right <= r.right + 1), noControlOverlap: glyphs.every(g => g.right <= c.x || g.bottom <= c.y || g.y >= c.bottom) };
    }) };
  });
}
(async () => {
  for (const dir of ['diagnostic-profile', 'diagnostic-engine', 'diagnostic-temp']) fs.mkdirSync(path.join(out, dir), { recursive: true });
  const app = await _electron.launch({ args: [path.join(process.cwd(), 'packages/desktop/dist/main.cjs'), `--user-data-dir=${path.join(out, 'diagnostic-profile')}`, '--no-sandbox', '--disable-gpu'], env: { ...process.env, NODE_ENV: 'test', CORTEX_DATA_DIR: path.join(out, 'diagnostic-engine'), TMPDIR: path.join(out, 'diagnostic-temp'), CORTEX_LOCALE: 'en', CORTEX_CATALOG_URL: 'http://127.0.0.1:5309/audit-no-catalog', CORTEX_RENDERER_URL: 'http://127.0.0.1:5309/#/code-settings?theme=light&shot&v=approvals' } });
  try {
    const page = await app.firstWindow(); page.on('pageerror', e => report.pageErrors.push(String(e)));
    await page.waitForSelector('.code-radios'); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => document.fonts.ready);
    // Three measured views; one existing route, no screenshots, no source edits.
    for (const size of [{width:960,height:640},{width:1024,height:686},{width:1440,height:900}]) {
      await app.evaluate(({BrowserWindow},size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);
      await page.waitForFunction(size => innerWidth===size.width && innerHeight===size.height,size);
      const before = await measure(page); assert.equal(before.rows.length,2);
      await page.locator('.pg-panel > .list').first().evaluate(el => el.classList.add('code-approval-defaults'));
      const style = await page.addStyleTag({ content: report.rule });
      const after = await measure(page);
      const checks = size.width===1440 ? { wideUnchanged: JSON.stringify(before)===JSON.stringify(after) } : { descriptionsSeparate: after.rows.every(r=>r.sub.y>=r.title.bottom+1), descriptionsFullyFit: after.rows.every(r=>r.allSubGlyphsContained&&r.noControlOverlap) };
      report.views.push({size,theme:'light',before,after,checks});
      await style.evaluate(el=>el.remove()); await page.locator('.code-approval-defaults').evaluate(el=>el.classList.remove('code-approval-defaults'));
    }
    report.scriptSha256=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  } finally { fs.writeFileSync(path.join(out,'scoped-diagnostic.json'),JSON.stringify(report,null,2)+'\n'); await app.close(); }
  assert(report.views.every(v=>Object.values(v.checks).every(Boolean))); console.log(JSON.stringify(report.views.map(v=>({size:v.size,checks:v.checks})),null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
