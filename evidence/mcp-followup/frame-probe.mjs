import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { _electron } from 'playwright';

const root=process.cwd();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cortex-frames-'));
const app=await _electron.launch({args:[path.join(root,'packages/desktop/dist/main.cjs'),`--user-data-dir=${dir}/profile`,'--no-sandbox'],env:{...process.env,CORTEX_DATA_DIR:dir,CORTEX_CATALOG_URL:'data:application/json,{}'}});
try {
 const page=await app.firstWindow();
 await page.waitForFunction(()=> '__bridgeFetch' in window);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());
 const frames=()=>page.evaluate(()=>new Promise(r=>{
  let n=0; const tick=()=>{n++; requestAnimationFrame(tick)};requestAnimationFrame(tick);setTimeout(()=>r(n),1200);
 }));
 const throttled=await frames();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
 const unthrottled=await frames();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
 const shown=await frames();
 console.log(JSON.stringify({hiddenWindow:true,throttledFrames:throttled,unthrottledFrames:unthrottled,shownFrames:shown,intervalMs:1200,platform:process.platform}));
} finally {await app.close();fs.rmSync(dir,{recursive:true,force:true})}
