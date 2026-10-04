const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/playwright');

const root = __dirname;
const samples = JSON.parse(fs.readFileSync(path.join(root, 'samples.json'), 'utf8'));
const configs = JSON.parse(fs.readFileSync(path.join(root, 'configs.json'), 'utf8'));
const sha = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const face = fs.readFileSync(path.join(root, 'source/packages/app/public/fonts/Geist-Variable.woff2'));
const css = `@font-face{font-family:Geist;src:url(data:font/woff2;base64,${face.toString('base64')}) format('woff2');font-weight:100 900;font-display:block}
body{margin:0;background:#171717;color:#f4f4f4;font:12px/16px Geist,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:24px;box-sizing:border-box;width:960px;height:640px}
section{border:1px solid #313131;border-radius:16px;padding:28px 30px;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden}
label{color:#969696;margin-bottom:24px}h1{font-size:26px;line-height:32px;font-weight:500;letter-spacing:-.02em;margin:0 0 20px;width:360px}
p{font-size:12px;line-height:16px;font-weight:400;color:#ff6369;width:360px;margin:0 0 24px}
button{color:inherit;font:500 12px/16px Geist,ui-sans-serif,system-ui,sans-serif;background:none;border:1px solid #5b9bff;padding:2px}
.latin{margin-top:auto;color:#969696;font-size:12px}
`;
const html = `<meta charset="utf-8"><style>${css}</style><main>${samples.map(s => `<section lang="${s.locale}"><label>${s.locale}</label><h1 id="${s.locale}-heading">${s.heading}</h1><p id="${s.locale}-error">${s.error}</p><button id="${s.locale}-cancel">${s.cancel}</button><span class="latin">Cortex · person@example.test · 000000</span></section>`).join('')}</main>`;
fs.writeFileSync(path.join(root, 'probe.html'), html);

(async () => {
  const results = [];
  for (const config of configs) {
    const dir = path.dirname(config.config);
    assert(!fs.existsSync(path.join(dir, 'capture.png')), 'Two-capture bound: already captured this font environment');
    const context = await chromium.launchPersistentContext(path.join(dir, 'profile'), {
      executablePath: chromium.executablePath(), headless: true,
      args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'],
      env: { ...process.env, FONTCONFIG_FILE: config.config, FONTCONFIG_PATH: dir, XDG_CACHE_HOME: path.join(dir, 'cache'), HOME: path.join(dir, 'home'), TMPDIR: path.join(dir, 'tmp') },
      viewport: { width: 960, height: 640 }, deviceScaleFactor: 1,
    });
    try {
      const page = context.pages()[0];
      const requests = [], errors = [];
      await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(async () => { await document.fonts.ready; await document.fonts.load('500 26px Geist'); await document.fonts.load('400 12px Geist'); });
      const client = await context.newCDPSession(page);
      await client.send('DOM.enable'); await client.send('CSS.enable');
      const { root: dom } = await client.send('DOM.getDocument');
      const fonts = [];
      for (const sample of samples) for (const kind of ['heading', 'error', 'cancel']) {
        const selector = `#${sample.locale}-${kind}`;
        const { nodeId } = await client.send('DOM.querySelector', { nodeId: dom.nodeId, selector });
        fonts.push({ locale: sample.locale, kind, ...(await client.send('CSS.getPlatformFontsForNode', { nodeId })) });
      }
      const measurements = await page.evaluate((samples) => {
        const range = el => { const r = document.createRange(); r.selectNodeContents(el); return Array.from(r.getClientRects()).map(b => ({ x:b.x, y:b.y, width:b.width, height:b.height })); };
        const bitmap = (text, weight) => {
          const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 72;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.font = `${weight} 26px Geist,ui-sans-serif,system-ui,sans-serif`; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.fillText(text, 8, 8);
          return { text, width:ctx.measureText(text).width, png:canvas.toDataURL('image/png'), alphaPixels:Array.from(ctx.getImageData(0,0,160,72).data).filter((v,i) => i%4===3 && v>0).length };
        };
        const sentinels = { en:['A','B'], ja:['あ','ア'], ko:['한','글'], 'zh-Hans':['汉','字'] };
        return samples.map(sample => {
          const el = document.getElementById(`${sample.locale}-heading`), style = getComputedStyle(el), rect = el.getBoundingClientRect(), boxes = range(el);
          const weightProbes = [400,500].map(weight => {
            const a = bitmap(sentinels[sample.locale][0],weight), b = bitmap(sentinels[sample.locale][1],weight), missing = bitmap('\u{10ffff}',weight);
            return { weight, a, b, missing, coveragePass:a.alphaPixels>0 && b.alphaPixels>0 && a.png!==b.png && a.png!==missing.png && b.png!==missing.png };
          });
          return { locale:sample.locale, heading:sample.heading, family:style.fontFamily, weight:style.fontWeight, fontSize:style.fontSize, letterSpacing:style.letterSpacing,
            fontFaceSetCheck:document.fonts.check('500 26px Geist',sample.heading), boxes,
            geometryReadable:boxes.every(b => b.x>=rect.x-.5 && b.x+b.width<=rect.right+.5 && b.y>=0 && b.y+b.height<=innerHeight),
            weightProbes };
        });
      }, samples);
      const capture = await page.screenshot({ path: path.join(dir, 'capture.png') });
      const record = { mode:config.mode, browser:await client.send('Browser.getVersion'), userAgent:await page.evaluate(() => navigator.userAgent), fontConfigSHA256:config.sha256,
        fontFaceSHA256:sha(face), fonts, measurements, screenshot:{path:path.join(dir,'capture.png'),sha256:sha(capture)}, requests, errors };
      fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify(record,null,2)+'\n');
      results.push(record);
    } finally { await context.close(); }
  }
  fs.writeFileSync(path.join(root,'probe-results.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results.map(r => ({ mode:r.mode, browser:r.browser.product, requests:r.requests, errors:r.errors,
    measurements:r.measurements.map(m => ({locale:m.locale,fontFaceSetCheck:m.fontFaceSetCheck,geometryReadable:m.geometryReadable,weightCoverage:m.weightProbes.map(p => ({weight:p.weight,coveragePass:p.coveragePass,pairBitmapsIdentical:p.a.png===p.b.png,firstMatchesMissing:p.a.png===p.missing.png}))})),fonts:r.fonts })),null,2));
})().catch(error => { console.error(error); process.exitCode = 1; });
