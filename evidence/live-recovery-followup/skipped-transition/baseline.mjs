import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const root = process.cwd();
const out = '/tmp/opencode/skipped-transition-fix';
const { _electron: electron } = createRequire(`${root}/package.json`)('playwright');
const dataDir = fs.mkdtempSync(`${out}/baseline-data-`);
const app = await electron.launch({
  args: [`${root}/packages/desktop/dist/main.cjs`, `--user-data-dir=${dataDir}/renderer`, '--no-sandbox'],
  env: { ...process.env, CORTEX_DATA_DIR: dataDir, CORTEX_START_HASH: '#/home?preview&theme=light', CORTEX_CATALOG_URL: 'data:application/json,{}' },
});
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (error) => errors.push({ name: error.name, message: error.message, stack: error.stack }));
await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
try {
  await page.waitForSelector('.home');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const nativeStart = document.startViewTransition.bind(document);
    const records = [], unhandled = [];
    window.__transitionProbe = { records, unhandled };
    addEventListener('unhandledrejection', (event) => {
      const record = records.find(({ transition }) => [transition.ready, transition.finished, transition.updateCallbackDone].includes(event.promise));
      unhandled.push({
        source: record ? ['ready', 'finished', 'updateCallbackDone'].find((name) => record.transition[name] === event.promise) : 'other',
        kind: record?.kind, name: event.reason?.name, message: event.reason?.message, stack: event.reason?.stack,
      });
    });
    document.startViewTransition = (update) => {
      const record = { kind: document.documentElement.dataset.vt === 'theme' ? 'theme' : 'route', callbacks: 0, handled: false, rejected: null, caller: new Error().stack };
      const transition = nativeStart(() => {
        record.callbacks++;
        return typeof update === 'function' ? update() : update?.update?.();
      });
      record.transition = transition;
      records.push(record);
      const then = transition.ready.then.bind(transition.ready);
      transition.ready.then = (resolve, reject) => {
        record.handled ||= typeof reject === 'function';
        return then(resolve, reject && ((error) => {
          record.rejected = { name: error.name, message: error.message };
          return reject(error);
        }));
      };
      transition.skipTransition();
      return transition;
    };
  });
  await page.locator('.titlebar').getByRole('tab', { name: 'Work', exact: true }).click();
  await page.waitForSelector('.travail-filters');
  const dark = page.getByRole('radio', { name: 'Dark', exact: true });
  await dark.focus();
  await dark.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && !document.documentElement.dataset.vt);
  await page.waitForFunction(() => window.__transitionProbe.unhandled.length === 2);
  const result = await page.evaluate(async () => {
    const probe = window.__transitionProbe;
    await Promise.all(probe.records.flatMap(({ transition }) => [transition.finished, transition.updateCallbackDone]));
    return {
      motion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      route: location.hash, theme: document.documentElement.dataset.theme,
      records: probe.records.map(({ transition, ...record }) => ({ ...record, native: transition instanceof ViewTransition })),
      unhandled: probe.unhandled,
    };
  });
  fs.writeFileSync(`${out}/baseline-result.json`, JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  assert.equal(result.motion, false);
  assert.match(result.route, /#\/work-home\?/);
  assert.equal(result.theme, 'dark');
  assert.deepEqual(result.records.map(({ kind, callbacks, native }) => ({ kind, callbacks, native })), [
    { kind: 'route', callbacks: 1, native: true }, { kind: 'theme', callbacks: 1, native: true },
  ]);
  assert.deepEqual(errors, [], 'Skipped native transitions must not emit page errors');
} finally {
  await page.context().tracing.stop({ path: `${out}/baseline-trace.zip` });
  await app.close();
}
