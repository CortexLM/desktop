import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('playwright');
const browser = await chromium.connectOverCDP('http://127.0.0.1:19444');
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('cortex://app/'));
await page.goto('cortex://app/index.html?terminal-inspect#/code-session?id=ses_01a0ffc381270000b44535a49679a18b&theme=light');
await page.getByRole('tab', {name:'Terminal',exact:true}).click();
const value = await page.locator('pre.term').evaluate(pre => {
  const entries=[];
  for(let el=pre;el;el=el.parentElement) entries.push({tag:el.tagName,cls:el.className,height:el.clientHeight,scroll:el.scrollHeight,top:el.scrollTop,overflow:getComputedStyle(el).overflow,rect:el.getBoundingClientRect().toJSON()});
  pre.scrollTop=pre.scrollHeight;
  const node=pre.firstChild,start=pre.textContent.lastIndexOf('… [24');
  const range=document.createRange();range.setStart(node,start);range.setEnd(node,pre.textContent.length);
  return {entries,after:{top:pre.scrollTop,annotation:range.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]}};
});
fs.writeFileSync('/tmp/opencode/terminal-scroll-inspection.json',JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(value));
await browser.close();
