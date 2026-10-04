import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root = process.cwd(), require = createRequire(path.join(root, 'package.json'));
const { _electron: electron } = require('@playwright/test');
const output = '/tmp/opencode/terminal-viewport';
const content = Array.from({ length: 160 }, (_, i) => `line ${i}`).join('\n') + '\nDIFF END';
let request = 0;
const server = http.createServer(async (req, res) => {
  for await (const _ of req) {}
  const delta = request++ === 0 ? { tool_calls: [{ index: 0, id: 'write', type: 'function', function: { name: 'write', arguments: JSON.stringify({ path: 'diff-output.txt', content }) } }] } : { content: 'Terminé.' };
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(`data: ${JSON.stringify({ id: 'diff', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: request === 1 ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const dataDir = fs.mkdtempSync(path.join(output, 'diff-engine-'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'packages/core/test/fixtures/catalog.json'), 'utf8'));
const app = await electron.launch({ args: [path.join(root, 'packages/desktop/dist/main.cjs'), `--user-data-dir=${path.join(dataDir, 'renderer')}`, '--no-sandbox'], env: {
  ...process.env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: '#/code?theme=light', CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`, CORTEX_TEST_PROVIDER_BASEURL: `fake=http://127.0.0.1:${server.address().port}/v1`,
} });
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => '__bridgeFetch' in window);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  const session = await page.evaluate(async directory => (await window.__bridgeFetch('cortex://local/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'code', directory, model: { providerID: 'fake', modelID: 'reasoner' } }) })).json(), dataDir);
  await page.goto(`${page.url().split('#')[0]}#/code-session?id=${session.id}&theme=light`);
  await page.getByTestId('code-composer-input').fill('Write the diff fixture.');
  await page.getByTestId('code-composer-input').press('Enter');
  await page.getByTestId('permission-allow-once').click();
  await page.locator('.diff pre div').filter({ hasText: 'DIFF END' }).waitFor();
  const results = [];
  for (const mode of ['before', 'min-height']) {
    if (mode === 'min-height') await page.addStyleTag({ content: '.split-r { min-height: 0; }' });
    await page.mouse.move(800, 300);
    await page.mouse.wheel(0, 10000);
    await page.waitForTimeout(250);
    const panes = await page.locator('.diff').evaluate(el => {
      const pre = el.querySelector('pre'), right = el.closest('.split-r');
      const tail = pre.lastElementChild, box = tail.getBoundingClientRect();
      return { panes: [right, el, pre].map(node => ({ class: node.className, tag: node.tagName, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop, overflow: getComputedStyle(node).overflowY })), tail: box.toJSON(), tailVisible: tail.contains(document.elementFromPoint(box.left + 20, box.top + box.height / 2)), viewportHeight: innerHeight };
    });
    results.push({ mode, ...panes });
    await page.screenshot({ path: path.join(output, `diff-${mode}.png`), animations: 'disabled' });
  }
  fs.writeFileSync(path.join(output, 'diff-wheel-probe.json'), JSON.stringify({ scope: 'Real engine write tool and mouse wheel; old build with diagnostic in-memory CSS only; no source/build acceptance', exactFile: fs.readFileSync(path.join(dataDir, 'diff-output.txt'), 'utf8') === content, results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await app.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
