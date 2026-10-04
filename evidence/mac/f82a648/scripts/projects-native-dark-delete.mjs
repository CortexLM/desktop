import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const out = '/tmp/opencode/projects-native-f82a648-dark-delete', root = '/tmp/opencode/desktop-terminal-state-projects-f82a648-pointer', revision = 'f82a64800c0fffd6ebaa99e571a8af0fa4307095', asar = 'a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422';
assert(!fs.existsSync(out)); fs.mkdirSync(out);
const source = fs.readFileSync(new URL(import.meta.url));
const result = { status: 'running', revision, asar, startedAt: new Date().toISOString(), sourceSHA256: createHash('sha256').update(source).digest('hex'), captures: 0, calls: [], errors: [], cleanup: {} };
const save = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2) + '\n');
const ssh = command => execFileSync('ssh', ['mac-live', command], { encoding: 'utf8', timeout: 15000 }).trim();
const inspect = () => JSON.parse(ssh(`/usr/bin/python3 ${root}/launch-terminal-state-native.py --inspect ${root} ${asar} ${revision}`));
let page, call, projectID, sessionID, initialURL;
save();
try {
  result.installedBefore = inspect(); assert.equal(result.installedBefore.pid, 67608);
  result.nativeDark = ssh(`/usr/bin/osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`); assert.equal(result.nativeDark, 'true');
  const { chromium, expect } = await import(pathToFileURL(path.join(process.cwd(), 'node_modules/@playwright/test/index.mjs')));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19444'), cdp = await browser.newBrowserCDPSession();
  assert.deepEqual((await cdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p => p.type === 'browser').map(p => p.id), [result.installedBefore.pid]);
  const pages = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('cortex://app/')); assert.equal(pages.length, 1); [page] = pages; initialURL = page.url(); page.setDefaultTimeout(10000);
  await page.emulateMedia({ colorScheme: null, reducedMotion: null, forcedColors: null, contrast: null });
  page.on('pageerror', e => result.errors.push(e.name));
  page.on('console', m => { if (m.type() === 'error') result.errors.push('console-error'); });
  call = async (route, method = 'GET', body, statuses = [200]) => {
    const r = await page.evaluate(async ({ route, method, body }) => { const r = await window.cortex.request({ url: `cortex://local${route}`, method, headers: [['content-type','application/json']], body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: JSON.parse(r.body) }; }, { route, method, body });
    result.calls.push({ route, method, status: r.status }); save(); assert(statuses.includes(r.status)); return r.body;
  };
  for (const route of ['/api/projects','/api/sessions','/api/providers']) assert.deepEqual(await call(route), []);
  await page.locator('.sidebar').getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Native dark deletion');
  await dialog.getByRole('textbox', { name: 'Instructions', exact: true }).fill('Keep this controlled context.');
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.locator('.systeme-phead h1')).toHaveText('Native dark deletion');
  const projects = await call('/api/projects'); assert.equal(projects.length, 1); projectID = projects[0].id; result.project = projects[0];
  const chat = await call('/api/sessions','POST',{ kind:'chat', title:'Native dark retained chat', projectID, model:{providerID:'native-project',modelID:'reasoner'},agent:'build' },[201]); sessionID = chat.id; result.chat = chat; save();
  await expect(page.locator('.systeme-phead .sub')).toHaveText('1 chat'); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.locator('main .content-top').getByRole('button',{name:'More actions',exact:true}).click();
  await page.getByRole('menuitem',{name:'Delete project',exact:true}).click(); await expect(page).toHaveURL(/#\/projects(?:\?|$)/);
  await call(`/api/projects/${projectID}`,'GET',undefined,[404]); assert.deepEqual(await call('/api/projects'),[]);
  const {projectID: _projectID,...detached}=chat; result.detached=await call(`/api/sessions/${sessionID}`); assert.deepEqual(result.detached,detached);
  assert.deepEqual(await call(`/api/sessions/${sessionID}/messages`),[]); result.darkUIDeletePreservesChat=true;
  result.installedAfter=inspect(); assert.deepEqual(result.installedAfter,result.installedBefore);
  assert(Date.now()-Date.parse(result.startedAt)<30000,'Supplement exceeded 30-second budget'); result.status='passed';
} catch(e) { result.status='failed'; result.failure=String(e.stack); }
finally {
  const clean=async(name,fn)=>{try{await fn();result.cleanup[name]=true;}catch(e){result.status='failed';result.cleanup[name]=String(e.message);}save();};
  if(call&&projectID)await clean('projectRemoved',()=>call(`/api/projects/${projectID}`,'DELETE',undefined,[200,404]));
  if(call&&sessionID)await clean('sessionRemoved',()=>call(`/api/sessions/${sessionID}`,'DELETE'));
  if(call)await clean('engineEmpty',async()=>{for(const r of ['/api/projects','/api/sessions','/api/providers'])assert.deepEqual(await call(r),[]);});
  if(page&&initialURL)await clean('routeRestored',()=>page.goto(initialURL));
  await clean('zeroInference',async()=>{const r=JSON.parse(ssh('/usr/bin/curl --fail --silent http://127.0.0.1:9456/receipt'));assert.deepEqual(r.requests,[]);assert.deepEqual(r.failures,[]);assert.equal(r.counts.errors,0);result.backendReceipt=r;});
  if(result.errors.length)result.status='failed'; result.finishedAt=new Date().toISOString();result.durationMs=Date.parse(result.finishedAt)-Date.parse(result.startedAt);save();
}
console.log(JSON.stringify({status:result.status,durationMs:result.durationMs,captures:0}));process.exit(result.status==='passed'?0:1);
