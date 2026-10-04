import fs from 'node:fs';
import { createRequire } from 'node:module';
const root = process.cwd(), out = '/tmp/opencode/skipped-transition-fix';
const { _electron: electron } = createRequire(`${root}/package.json`)('playwright');
for (const skip of [true, false]) {
  const dataDir = fs.mkdtempSync(`${out}/callback-data-`);
  const app = await electron.launch({ args: [`${root}/packages/desktop/dist/main.cjs`, `--user-data-dir=${dataDir}/renderer`, '--no-sandbox'], env: { ...process.env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: '#/home?preview&theme=light', CORTEX_CATALOG_URL: 'data:application/json,{}' } });
  const page = await app.firstWindow(), errors = [];
  page.on('pageerror', (error) => errors.push({ name: error.name, message: error.message, stack: error.stack }));
  try {
    await page.waitForSelector('.home');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate((skip) => {
      const start = document.startViewTransition.bind(document), records = [], unhandled = [];
      window.__probe = { records, unhandled };
      addEventListener('unhandledrejection', (event) => {
        const record = records.find(({ transition }) => [transition.ready, transition.finished, transition.updateCallbackDone].includes(event.promise));
        unhandled.push({ source: record ? ['ready', 'finished', 'updateCallbackDone'].find((name) => record.transition[name] === event.promise) : 'derived', kind: record?.kind, name: event.reason?.name, message: event.reason?.message });
      });
      document.startViewTransition = (update) => {
        const kind = document.documentElement.dataset.vt === 'theme' ? 'theme' : 'route';
        const transition = start(async () => {
          await (typeof update === 'function' ? update() : update?.update?.());
          throw new Error(`${kind} callback failure`);
        });
        records.push({ kind, transition });
        if (skip) transition.skipTransition();
        return transition;
      };
    }, skip);
    await page.locator('.titlebar').getByRole('tab', { name: 'Work', exact: true }).click();
    await page.waitForSelector('.travail-filters');
    const dark = page.getByRole('radio', { name: 'Dark', exact: true });
    await dark.focus();
    await dark.press('Space');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && !document.documentElement.dataset.vt);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    const result = await page.evaluate(() => window.__probe.unhandled);
    fs.writeFileSync(`${out}/baseline-callback-${skip ? 'skip' : 'no-skip'}.json`, JSON.stringify({ result, errors }, null, 2));
    console.log({ skip, result, errors });
  } finally { await app.close(); }
}
