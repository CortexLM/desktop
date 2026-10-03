import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const repo = process.cwd(), out = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("playwright"), { PNG } = require("pngjs"), pixelmatch = require("pixelmatch").default;
const comparator = path.join(repo, "scripts/compare-shots.mjs");
const { readReference, trackAssets } = await import(pathToFileURL(comparator).href);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const info = (file) => { const bytes = fs.readFileSync(file); return { sha256: sha(bytes), bytes: bytes.length }; };
const workFile = "packages/app/src/screens/work/home.tsx", workSha = "f20599c58871783afba2024f88aa8902b2e9f355baeb6af35f2a473a70e056d6";
assert.equal(info(path.join(repo, workFile)).sha256, workSha, "Work source differs from accepted correction");
const reference = readReference("/root/cortex-ui-freezes/2026-10-02-7b388e2d9674/shots");
const originalRoot = "/tmp/opencode/current-full-compare-6d96535";
const original = JSON.parse(fs.readFileSync(path.join(originalRoot, "report.json")));
assert.equal(info(path.join(originalRoot, "report.json")).sha256, "75451933436da845d7b57b06be97e6341a5019f8ac63c34a9860fcb24376414c");
const clock = { mode: "fixed", source: "caller", time: "2026-10-02T12:09:00.000Z", timezone: "UTC", timers: "real" };
const render = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "fr-FR", catalogLocale: "fr", pixelmatchThreshold: 0.15 };
const save = (name, bytes) => { assert(!fs.existsSync(path.join(out, name)), `Existing output: ${name}`); fs.writeFileSync(path.join(out, name), bytes); return { file: name, sha256: sha(bytes), bytes: bytes.length }; };
const workSnapshot = save("work-home-source.tsx", fs.readFileSync(path.join(repo, workFile)));
const measure = (page) => page.evaluate(() => {
  const thread = document.querySelector(".travail-tl .thread");
  const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
  return { fonts: document.fonts.status, top: thread.scrollTop, height: thread.scrollHeight, viewport: thread.clientHeight,
    bottomGap: thread.scrollHeight - thread.clientHeight - thread.scrollTop,
    rectangles: Object.fromEntries([".thread", ".thread-inner", ".travail-steps", ".travail-recap", ".dock", ".composer"].map((s) => [s, rect(s)])) };
});
const region = [1110, 510, 2440, 1490];
const crop = (png) => {
  const [x0,y0,x1,y1] = region, buffer = Buffer.alloc((x1-x0)*(y1-y0)*4);
  for (let y=y0; y<y1; y++) png.data.copy(buffer, (y-y0)*(x1-x0)*4, (y*png.width+x0)*4, (y*png.width+x1)*4);
  return buffer;
};
const rows = [], ignoredPreviewApiErrors = [], errors = [];
let buildFiles;
const startedAt = new Date().toISOString(), browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: render.viewport, deviceScaleFactor: 2, locale: "fr-FR", timezoneId: "UTC" });
  await ctx.route("**/*", (route) => route.continue());
  await ctx.addInitScript(() => localStorage.setItem("cortex.locale", "fr"));
  const page = await ctx.newPage(), tracker = trackAssets(page);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (new URL(m.location().url || "/", "http://127.0.0.1:5309/").pathname.startsWith("/api/") && m.text().startsWith("Failed to load resource:")) ignoredPreviewApiErrors.push({ text: m.text(), url: m.location().url });
    else errors.push({ text: m.text(), location: m.location() });
  });
  for (const theme of ["dark", "light"]) {
    const name = `work-task~done-${theme}`, previous = original.find((r) => r.name === name), ref = reference.images[previous.ref];
    assert.equal(ref.sha256, previous.reference.sha256);
    const url = `http://127.0.0.1:5309/?capture=work-scroll-corrected-${theme}#/work-task?theme=${theme}&shot&v=done`;
    await page.clock.setFixedTime(new Date(clock.time));
    assert((await page.goto(url))?.ok());
    await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme && !!document.querySelector(".travail-recap"), theme);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((img) => img.complete));
    await page.waitForTimeout(1100);
    await tracker.drain(); assert.deepEqual(errors, []);
    const before = await measure(page); assert.equal(before.bottomGap, 0, `${theme}: unsettled bottom`);
    const app = await page.screenshot(), capturedAt = new Date().toISOString(), after = await measure(page);
    assert.equal(after.bottomGap, 0); assert.deepEqual(after, before);
    const design = fs.readFileSync(path.join(reference.shots, previous.ref)); assert.equal(sha(design), ref.sha256);
    const a = PNG.sync.read(app), d = PNG.sync.read(design); assert.equal(a.width, 2880); assert.equal(a.height, 1800); assert.equal(a.width, d.width); assert.equal(a.height, d.height);
    const diff = new PNG({ width: a.width, height: a.height });
    const differentPixels = pixelmatch(a.data, d.data, diff.data, a.width, a.height, { threshold: 0.15 });
    const ac = crop(a), dc = crop(d); let exact = 0;
    for (let i=0; i<ac.length; i+=4) if (!ac.subarray(i,i+4).equals(dc.subarray(i,i+4))) exact++;
    rows.push({ name, url, capturedAt, clock, reference: { ...ref, file: previous.ref }, geometry: after,
      differentPixels, diffPct: +(100*differentPixels/(a.width*a.height)).toFixed(2), rawDiffPct: 100*differentPixels/(a.width*a.height),
      unshiftedTranscriptRegion: { rectangle: region, pixels: (region[2]-region[0])*(region[3]-region[1]), exactDifferentPixels: exact, pixelmatchDifferentPixels: pixelmatch(ac,dc,null,region[2]-region[0],region[3]-region[1],{threshold:.15}) },
      original: { report: `${originalRoot}/report.json`, diffPct: previous.diffPct, files: previous.files },
      files: { app: save(`${name}.app.png`,app), design: save(`${name}.design.png`,design), diff: save(`${name}.diff.png`,PNG.sync.write(diff)) } });
  }
  await tracker.drain(); buildFiles = [...tracker.assets.values()].sort((a,b)=>a.url.localeCompare(b.url));
} finally { await browser.close(); }

for (const file of buildFiles) {
  const response = await fetch(file.url); assert(response.ok);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(sha(bytes),file.sha256,`Served asset drift: ${file.url}`); assert.equal(bytes.length,file.bytes);
}
assert.equal(info(path.join(repo,workFile)).sha256,workSha,"Work source changed during capture");
assert.deepEqual(readReference(reference.shots).provenance,reference.provenance);
const report = save("report.json",Buffer.from(JSON.stringify(rows,null,2)+"\n"));
const provenance = { method: "Scoped manual browser capture using unchanged comparator reference/asset helpers; no renderer build", startedAt, completedAt:new Date().toISOString(),
  counts:{captured:2,compared:2,referenceGaps:0,pngs:6}, clock, render, reference:reference.provenance,
  workSource:{file:workFile,sha256:workSha,snapshot:workSnapshot,checkedBeforeAfter:true},
  repositoryHeadAtReview:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
  sourceProvenance:"Only the accepted Work source was pinned and checked. Concurrent integrated sources were not fingerprinted; served assets do not attest a source-to-build mapping.",
  captureScriptSha256:info(fileURLToPath(import.meta.url)).sha256, comparatorHelperSha256:info(comparator).sha256,
  servedAssets:{sha256:sha(buildFiles.map(f=>`${f.url}:${f.sha256}`).join("\n")),files:buildFiles,recheckedAfterCapture:true,httpCache:"disabled via context.route"},
  report, errors, ignoredPreviewApiErrors,
  limits:["Two Work Done browser-preview frames only; no native/CI/live-engine or motion acceptance.","No independent source-review approval: numerical post-fix verification of this executor's correction.","Fixed caller Date/UTC does not attest original reference mount time/timezone; timers remain real.","Original raw report, images and scores remain untouched. No residual or acceptance threshold waived.","This initially integrated build predates ongoing memory-race/permission-status integration per coordinator; no whole-tree source/build attestation claimed."] };
save("provenance.json",Buffer.from(JSON.stringify(provenance,null,2)+"\n"));
console.log(JSON.stringify({counts:provenance.counts,workSourceSha256:workSha,servedAssetCount:buildFiles.length,servedAssetFingerprint:provenance.servedAssets.sha256,reportSha256:report.sha256,rows:rows.map(({name,differentPixels,diffPct,rawDiffPct,geometry,unshiftedTranscriptRegion})=>({name,differentPixels,diffPct,rawDiffPct,geometry,unshiftedTranscriptRegion}))},null,2));
