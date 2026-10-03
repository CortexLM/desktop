import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('playwright');

const [out, expectedAsar] = process.argv.slice(2);
assert(out && /^[a-f0-9]{64}$/.test(expectedAsar), 'Output directory and expected installed ASAR required');
const ssh = (command) => execFileSync('ssh', ['-o','BatchMode=yes','mac-live',command], {encoding:'utf8',timeout:30000}).trim();
assert.equal(ssh('shasum -a 256 /Applications/Cortex.app/Contents/Resources/app.asar').split(/\s/)[0],expectedAsar);
const wid = ssh(`swift -e 'import CoreGraphics; for w in CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String:Any]] where w["kCGWindowOwnerName"] as? String == "Cortex" && w["kCGWindowLayer"] as? Int == 0 { print(w["kCGWindowNumber"] as! Int); break }' 2>/dev/null`);
assert(/^\d+$/.test(wid));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:19444');
const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('cortex://app/'));
assert(page);assert.equal(await page.evaluate(()=>window.cortex.platform),'darwin');
const errors=[],captures=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.evaluate(()=>localStorage.setItem('cortex.locale','en'));
  for(const theme of ['light','dark']) {
    ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme==='dark'}' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}'`);
    await page.goto(`cortex://app/index.html#/work-task?shot&theme=${theme}&v=done`);
    await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme && !!document.querySelector('.travail-recap'),theme);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>{const el=document.querySelector('.travail-tl .thread');return el && el.scrollTop===el.scrollHeight-el.clientHeight;});
    const before=await page.locator('.travail-tl .thread').evaluate(el=>({top:el.scrollTop,height:el.scrollHeight,viewport:el.clientHeight,gap:el.scrollHeight-el.clientHeight-el.scrollTop}));
    assert.equal(before.gap,0);
    await page.waitForTimeout(500);
    const response=await fetch(`http://127.0.0.1:19445/${wid}`,{method:'POST'});assert(response.ok);
    const bytes=Buffer.from(await response.arrayBuffer()),file=`work-done-bottom-${theme}.png`;
    fs.writeFileSync(`${out}/${file}`,bytes);
    await page.locator('.travail-tl .thread').hover();await page.mouse.wheel(0,-140);
    await page.waitForFunction(top=>document.querySelector('.travail-tl .thread').scrollTop<top-50,before.top);
    const after=await page.locator('.travail-tl .thread').evaluate(el=>({top:el.scrollTop,gap:el.scrollHeight-el.clientHeight-el.scrollTop}));
    captures.push({file,theme,sha256:createHash('sha256').update(bytes).digest('hex'),before,afterUserWheel:after});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/work-manifest.json`,JSON.stringify({timestamp:new Date().toISOString(),installedASAR:expectedAsar,captures,errors,scope:'Warm/ambient installed font readiness; deterministic cold-font ordering is exercised separately in committed Electron tests.'},null,2)+'\n');
} finally {await browser.close();}
