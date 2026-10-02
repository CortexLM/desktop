import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('./', import.meta.url);
const labels = ['app-dark-natural', 'frozen-dark-natural', 'app-light-natural', 'frozen-light-natural', 'app-dark-anchor-off', 'frozen-dark-anchor-off'];
const runs = labels.map(label => JSON.parse(readFileSync(new URL(`${label}.json`, root))));
const shape = s => ({ scrollTop: s.scrollTop, scrollHeight: s.scrollHeight, clientHeight: s.clientHeight, thread: s.thread.bounds, inner: s.inner.bounds, user: s.user.bounds,
  headings: s.headings.map(h => ({ text: h.text, bounds: h.bounds })), paragraphs: s.paragraphs.map(p => ({ text: p.text, bounds: p.bounds })) });
const records = runs.map(run => {
  const cutoff = run.runtime.events.find(e => e.kind === 'before-normalize').t;
  const writes = run.runtime.events.filter(e => e.kind === 'scrollTop-set' && e.t < cutoff);
  assert.equal(writes.length, run.job.side === 'app' ? 1 : 2);
  assert(writes.every(e => e.value === 260 && e.scrollTop === 260 && e.user.offsetHeight === 58 && e.fonts.faces[0].status === 'loading'));
  const done = run.runtime.events.find(e => e.kind === 'fonts-loadingdone');
  assert.equal(done.user.offsetHeight, 38);
  assert.equal(done.scrollTop, run.job.anchorOff ? 260 : 240);
  assert.equal(run.settled.before.scrollTop, run.job.anchorOff ? 260 : 240);
  assert.equal(run.normalized.before.scrollTop, 260);
  assert.equal(run.settled.before.user.style.translate, '0px');
  assert.equal(run.settled.before.headings[2].bounds.y, run.job.anchorOff ? 109 : 129);
  assert.equal(run.runtime.start.localStorageLength, 0);
  assert.equal(run.runtime.start.historyState, null);
  assert.equal(run.runtime.start.navigationType, 'navigate');
  assert(!run.runtime.events.some(e => ['popstate', 'hashchange', 'scrollTo', 'scrollIntoView'].includes(e.kind)));
  assert(!run.runtime.events.some(e => e.kind === 'pageshow' && e.persisted));
  assert(!run.network.some(e => e.kind === 'cache' || e.kind === 'response' && (e.fromDiskCache || e.fromServiceWorker)));
  assert.deepEqual(run.errors, []);
  assert.equal(run.assets.find(a => a.url.endsWith('Geist-Variable.woff2')).sha256, 'a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8');
  return { label: run.job.label, assignedAtMs: writes.map(e => e.t), fontResponseEndMs: run.runtime.resources[0].responseEnd, fontLoadingDoneMs: done.t, fontLoadingDoneScrollTop: done.scrollTop,
    settledScrollTop: run.settled.before.scrollTop, settledCriteriaY: run.settled.before.headings[2].bounds.y, normalizedCriteriaY: run.normalized.before.headings[2].bounds.y,
    initialPlatformFonts: run.initial.platformFonts, settledPlatformFonts: run.settled.platformFonts };
});
for (const run of runs) assert.deepEqual(shape(run.normalized.before), shape(runs[0].normalized.before));
for (const run of runs.filter(r => !r.job.anchorOff)) assert.deepEqual(shape(run.settled.before), shape(runs[0].settled.before));
const appAssets = runs.filter(r => r.job.side === 'app').map(r => r.assets.filter(a => a.url.includes('/assets/')).sort((a, b) => a.url.localeCompare(b.url)));
for (const assets of appAssets) assert.deepEqual(assets, appAssets[0]);
console.log(JSON.stringify({ checks: 'passed', records, appAssets: appAssets[0] }, null, 2));
