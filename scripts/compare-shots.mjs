/* global window, document, localStorage, location */
// Frozen-reference comparison; explicit paths keep historical evidence intact.
// node scripts/compare-shots.mjs --shots <freeze>/shots --out <new-directory> [--base http://localhost:5299/] [--only id,id] [--merge]
// Optional: --clock <YYYY-MM-DDTHH:mm:ss[.sss]Z> [--timezone UTC] fixes browser Date only, not timers.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const RENDER = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "fr-FR", catalogLocale: "fr", pixelmatchThreshold: 0.15 };
const SOURCE_PATHS = ["packages/app/src", "packages/app/public", "packages/app/index.html", "packages/app/vite.config.ts", "packages/app/package.json", "packages/i18n/src", "packages/i18n/locales", "packages/client/src", "packages/schema/src", "package.json", "bun.lock", "tsconfig.json"];
const digest = (data) => createHash("sha256").update(data).digest("hex");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const fileInfo = (file) => { const data = fs.readFileSync(file); return { sha256: digest(data), bytes: data.length }; };
const safeFile = (root, name) => {
  const file = path.resolve(root, name);
  assert(file.startsWith(root + path.sep), `Path escapes its directory: ${name}`);
  return file;
};

// Same sorted relative-path:SHA-256 algorithm as the frozen shoot.mjs.
export function fingerprint(root, inputs = ["src"]) {
  const files = inputs.flatMap((input) => fs.statSync(path.join(root, input)).isDirectory()
    ? fs.readdirSync(path.join(root, input), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    : [input]).sort();
  return { sourceFingerprint: digest(files.map((file) => `${file}:${fileInfo(path.join(root, file)).sha256}`).join("\n")), sourceFileCount: files.length };
}

export function readReference(shots) {
  shots = fs.realpathSync(shots);
  const root = path.dirname(shots), freezeBytes = fs.readFileSync(path.join(root, "freeze.json")), freeze = JSON.parse(freezeBytes);
  const source = fingerprint(root);
  assert.equal(source.sourceFingerprint, freeze.sourceFingerprint, "Frozen source fingerprint mismatch");
  assert.equal(source.sourceFileCount, freeze.sourceFileCount, "Frozen source file count mismatch");
  const manifestBytes = fs.readFileSync(path.join(shots, "manifest.json")), registryBytes = fs.readFileSync(path.join(shots, "registry.json"));
  // Finalized freezes also pin their coverage/motion metadata; pending freezes still use per-image verification.
  const captureHashes = freeze.captures?.status === "passed" ? {
    manifestSha256: digest(manifestBytes),
    coverageSha256: fileInfo(path.join(root, "review/cmp/coverage.json")).sha256,
    motionIndexSha256: fileInfo(path.join(root, "public/states/index.json")).sha256,
  } : {};
  for (const [key, hash] of Object.entries(captureHashes)) assert.equal(hash, freeze.captures[key], `Finalized capture hash mismatch: ${key}`);
  const manifest = JSON.parse(manifestBytes), registry = JSON.parse(registryBytes);
  assert(manifest.images && !Array.isArray(manifest.images) && typeof manifest.images === "object", "Invalid reference manifest");
  assert(Array.isArray(registry.routes), "Invalid frozen registry");
  const keys = new Set();
  for (const [file, record] of Object.entries(manifest.images)) {
    assert.match(file, /^[a-z0-9~+-]+-(dark|light)\.png$/, `Invalid reference filename: ${file}`);
    assert.match(record.route, /^[a-z0-9-]+$/);
    assert.match(record.variant, /^[a-z0-9-]*$/);
    assert(["light", "dark"].includes(record.theme) && (record.interaction === null || typeof record.interaction === "string"), `Invalid reference state: ${file}`);
    assert.equal(record.sourceFingerprint, source.sourceFingerprint, `Reference source mismatch: ${file}`);
    assert.deepEqual(record.viewport, RENDER.viewport, `Reference viewport mismatch: ${file}`);
    assert.equal(record.deviceScaleFactor, RENDER.deviceScaleFactor, `Reference scale mismatch: ${file}`);
    assert(Number.isFinite(Date.parse(record.capturedAt)), `Missing reference capture time: ${file}`);
    assert.deepEqual(record.consoleErrors, [], `Reference console errors: ${file}`);
    assert.equal(fileInfo(safeFile(shots, file)).sha256, record.sha256, `Reference image hash mismatch: ${file}`);
    const key = JSON.stringify([record.route, record.variant, record.theme, record.interaction]);
    assert(!keys.has(key), `Duplicate reference state: ${file}`); keys.add(key);
  }
  for (const file of fs.readdirSync(shots).filter((file) => file.endsWith(".png"))) assert(Object.hasOwn(manifest.images, file), `Reference image has no manifest record: ${file}`);
  return { root, shots, images: manifest.images, provenance: {
    root, shots, ...source, freezeSha256: digest(freezeBytes), manifestSha256: digest(manifestBytes), registrySha256: digest(registryBytes), ...captureHashes,
  } };
}

export function referenceFor(job, screens, reference) {
  const screen = screens.find((screen) => screen.id === job.route);
  assert(screen, `Unknown application route: ${job.route}`);
  const base = screen.design ?? job.route, variant = screen.variants?.find(([id]) => id === job.v)?.[2] ?? job.v;
  // An explicit design route (notably general -> settings) has no variant suffix.
  const route = variant && (variant === base || variant.startsWith(base + "-")) ? variant : base;
  const state = { route, variant: route === variant ? "" : variant, theme: job.theme, interaction: job.action === "mode" ? "menu" : job.action === "history" ? "history-menu" : job.action === "ask" ? "ask" : null };
  const matches = Object.entries(reference.images).filter(([, record]) => Object.entries(state).every(([key, value]) => record[key] === value));
  assert(matches.length <= 1, `Ambiguous reference: ${JSON.stringify(state)}`);
  if (matches.length) return { ...matches[0][1], file: matches[0][0] };
  // ponytail: only extra Settings sections and the five optional clicks may lack frozen shots.
  // Add another explicit gap here only with a reviewed registry mapping.
  const extraSettings = job.route === "settings" && ["appearance", "providers", "connection", "bot", "notifications", "privacy", "shortcuts", "account"].includes(job.v);
  assert(job.action || extraSettings, `Missing frozen manifest record: ${JSON.stringify(state)}`);
  return { ...state, status: "no-design-shot", reason: "No matching frozen manifest record" };
}

// ponytail: frozen manifests omit browser timezone; use explicit overrides until capture metadata records it.
export function captureClock(timestamp, timezone) {
  assert(timestamp !== undefined || timezone === undefined, "--timezone requires --clock");
  if (timestamp === undefined) return null;
  const date = new Date(timestamp);
  assert(typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp) && Number.isFinite(date.getTime())
    && date.toISOString() === (timestamp.length === 20 ? timestamp.replace("Z", ".000Z") : timestamp), "--clock must be a valid UTC ISO timestamp: YYYY-MM-DDTHH:mm:ss[.sss]Z");
  return { mode: "fixed", source: "cli", time: date.toISOString(), timezone: new Intl.DateTimeFormat("en", { timeZone: timezone ?? "UTC" }).resolvedOptions().timeZone, timers: "real" };
}

export function readPrevious(out, reference, application, comparatorSha256, clock = null) {
  const provenance = json(path.join(out, "provenance.json")), report = json(path.join(out, "report.json"));
  assert.equal(provenance.version, 1, "Unsupported comparison provenance; choose a new --out");
  assert.deepEqual(provenance.reference, reference.provenance, "Cannot merge different frozen references; choose a new --out");
  assert.equal(provenance.application.sourceFingerprint, application.sourceFingerprint, "Cannot merge different application sources; choose a new --out");
  assert.deepEqual(provenance.clock ?? null, clock, "Cannot merge different clock policies; choose a new --out");
  assert.equal(provenance.comparatorSha256, comparatorSha256, "Cannot merge different comparator versions; choose a new --out");
  assert.deepEqual(provenance.render, RENDER, "Cannot merge different render settings");
  assert.equal(provenance.reportSha256, fileInfo(path.join(out, "report.json")).sha256, "Previous report hash mismatch");
  for (const run of provenance.runs) assert.deepEqual(run.clock ?? null, clock, `Previous run clock mismatch: ${run.id}`);
  for (const row of report) {
    assert(provenance.runs.some((run) => run.id === row.run), `Missing row provenance: ${row.name}`);
    assert.deepEqual(row.clock ?? null, clock, `Previous row clock mismatch: ${row.name}`);
    for (const file of Object.values(row.files)) assert.equal(fileInfo(safeFile(out, file.file)).sha256, file.sha256, `Previous image hash mismatch: ${file.file}`);
  }
  return { report, runs: provenance.runs };
}

export function trackAssets(page) {
  const pending = new Set(), assets = new Map(), errors = [];
  // Track from request start: draining response-only promises misses assets still awaiting headers.
  page.on("request", (request) => {
    if (request.frame() !== page.mainFrame() || !["document", "script", "stylesheet", "image", "font"].includes(request.resourceType())) return;
    const read = request.response().then(async (response) => {
      assert(response, `Asset request failed: ${request.failure()?.errorText}`);
      if (response.status() >= 300 && response.status() < 400 && request.redirectedTo()) return;
      assert(response.ok(), `Asset HTTP ${response.status()}`);
      const body = await response.body(), url = new URL(response.url()); url.searchParams.delete("capture");
      const key = url.href, sha256 = digest(body);
      assert(!assets.has(key) || assets.get(key).sha256 === sha256, `Served asset changed during capture: ${key}`);
      assets.set(key, { url: key, sha256, bytes: body.length });
    }).catch((error) => errors.push({ url: request.url(), message: String(error) })).finally(() => pending.delete(read));
    pending.add(read);
  });
  return { assets, async drain() {
    while (pending.size) await Promise.all(pending);
    assert.deepEqual(errors, [], "Asset provenance errors");
  } };
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: { shots: { type: "string" }, out: { type: "string" }, base: { type: "string", default: "http://localhost:5299/" }, only: { type: "string" }, merge: { type: "boolean" }, clock: { type: "string" }, timezone: { type: "string" } } });
  assert(values.shots && values.out, "Required: --shots <freeze>/shots --out <new-directory>");
  const clock = captureClock(values.clock, values.timezone);
  const reference = readReference(values.shots), out = path.resolve(values.out), base = new URL(values.base);
  assert(["http:", "https:"].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash, "--base must be an HTTP(S) URL without credentials, query or fragment");
  assert(out !== reference.root && !out.startsWith(reference.root + path.sep), "Output must be outside the frozen reference");
  const application = { revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim(), ...fingerprint(REPO, SOURCE_PATHS), sourcePaths: SOURCE_PATHS };
  const comparatorSha256 = fileInfo(fileURLToPath(import.meta.url)).sha256;
  const previous = values.merge ? readPrevious(out, reference, application, comparatorSha256, clock) : { report: [], runs: [] };
  if (!values.merge) assert(!fs.existsSync(out) || fs.readdirSync(out).length === 0, "--out is not empty; choose a new directory or a provenance-compatible --merge");
  const only = values.only?.split(",").filter(Boolean);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  let stage;
  try {
    const ctx = await browser.newContext({ viewport: RENDER.viewport, deviceScaleFactor: RENDER.deviceScaleFactor, locale: RENDER.locale, timezoneId: clock?.timezone });
    // Routing disables HTTP cache: Chromium's cached font responses can lack a CDP body despite HTTP 200.
    await ctx.route("**/*", (route) => route.continue());
    await ctx.addInitScript((locale) => localStorage.setItem("cortex.locale", locale), RENDER.catalogLocale);
    const page = await ctx.newPage(), errors = [], ignoredPreviewApiErrors = [];
    const { assets, drain } = trackAssets(page);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const url = message.location().url;
      // Preview hooks may query an absent dev engine; retain these transport failures separately.
      if (url && new URL(url, base).pathname.startsWith("/api/") && message.text().startsWith("Failed to load resource:")) ignoredPreviewApiErrors.push({ url, message: message.text() });
      else errors.push({ message: message.text(), location: message.location() });
    });
    if (clock) await page.clock.setFixedTime(new Date(clock.time));
    assert((await page.goto(new URL("#/gallery", base).href))?.ok(), "Application server did not return HTTP 200");
    await page.waitForFunction(() => Array.isArray(window.__screens));
    const screens = await page.evaluate(() => window.__screens);
    assert.equal(new Set(screens.map((screen) => screen.id)).size, screens.length, "Duplicate application routes");
    for (const screen of screens) {
      assert.match(screen.id, /^[a-z0-9-]+$/);
      assert.equal(new Set((screen.variants ?? []).map(([variant]) => variant)).size, screen.variants?.length ?? 0, `Duplicate application states: ${screen.id}`);
      for (const [variant] of screen.variants ?? []) assert.match(variant, /^[a-z0-9-]+$/);
    }
    assert(!only || only.every((id) => screens.some((screen) => screen.id === id)), "Unknown --only route");
    const registered = screens.flatMap((screen) => (screen.variants?.length ? screen.variants.map(([v]) => v) : [""]).flatMap((v) => ["dark", "light"].map((theme) => ({ route: screen.id, v, theme }))));
    const extras = ["dark", "light"].flatMap((theme) => [{ route: "home", v: "", theme, shot: "home+menu", action: "mode" }, { route: "history", v: "", theme, shot: "history-menu", action: "history" }]).concat({ route: "file-image", v: "view", theme: "light", shot: "file-image+ask", action: "ask" });
    const jobs = [...registered, ...extras].filter((job) => !only?.length || only.includes(job.route)).map((job) => ({ ...job, reference: referenceFor(job, screens, reference) }));
    assert(jobs.length, "No comparison jobs");
    await page.evaluate(() => document.fonts.ready);
    await drain();
    assert.deepEqual(errors, [], "Application console errors");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    stage = fs.mkdtempSync(path.join(path.dirname(out), ".cortex-compare-"));
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${path.basename(stage).slice(-6)}`, rows = [];
    const save = (file, data) => { fs.writeFileSync(path.join(stage, file), data); return { file: `captures/${id}/${file}`, sha256: digest(data), bytes: data.length }; };
    for (const job of jobs) {
      const name = `${job.shot ?? `${job.route}${job.v ? "~" + job.v : ""}`}-${job.theme}`;
      const url = new URL(base); url.searchParams.set("capture", `${id}-${name}`); url.hash = `/${job.route}?theme=${job.theme}&shot${job.v ? "&v=" + job.v : ""}`;
      await drain();
      if (clock) await page.clock.setFixedTime(new Date(clock.time));
      assert((await page.goto(url.href))?.ok(), `Application request failed: ${name}`);
      await page.waitForFunction(({ theme, hash }) => location.hash === hash && document.documentElement.dataset.theme === theme && !!document.querySelector("main.content")?.textContent.trim(), { theme: job.theme, hash: url.hash }, { timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every((image) => image.complete), null, { timeout: 15_000 });
      if (job.action === "mode") await page.locator(".mode-trigger").click();
      if (job.action === "history") { await page.locator(".pg-hrow").nth(1).hover(); await page.locator(".pg-more").nth(1).click(); }
      if (job.action === "ask") {
        await page.locator(".medias-top button[aria-pressed]").click(); await page.locator(".medias-ask-sugg button").first().click();
        await page.locator(".medias-ask-thread .msg-bot:not(.thinking)").waitFor();
      }
      await page.waitForTimeout(1100);
      await drain();
      assert.deepEqual(errors, [], `Application console errors: ${name}`);
      const image = await page.screenshot(), row = { name, run: id, capturedAt: new Date().toISOString(), clock, reference: job.reference, files: { app: save(`${name}.app.png`, image) } };
      if (job.reference.status) Object.assign(row, { status: job.reference.status });
      else {
        const original = fs.readFileSync(path.join(reference.shots, job.reference.file));
        assert.equal(digest(original), job.reference.sha256, `Reference image changed: ${name}`);
        row.ref = job.reference.file; row.files.design = save(`${name}.design.png`, original);
        const a = PNG.sync.read(image), b = PNG.sync.read(original);
        assert(a.width === b.width && a.height === b.height, `Image dimensions differ: ${name}`);
        const diff = new PNG({ width: a.width, height: a.height });
        row.diffPct = +(100 * pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: RENDER.pixelmatchThreshold }) / (a.width * a.height)).toFixed(2);
        row.files.diff = save(`${name}.diff.png`, PNG.sync.write(diff));
      }
      rows.push(row); console.log(name, row.diffPct ?? row.status);
    }
    await drain();
    assert.deepEqual(errors, [], "Application console errors");
    assert.deepEqual(readReference(reference.shots).provenance, reference.provenance, "Frozen reference changed during capture");
    assert.equal(fingerprint(REPO, SOURCE_PATHS).sourceFingerprint, application.sourceFingerprint, "Application sources changed during capture");
    const buildFiles = [...assets.values()].sort((a, b) => a.url.localeCompare(b.url));
    const run = { id, capturedAt: new Date().toISOString(), clock, applicationRevision: application.revision, baseUrl: base.href, jobCount: rows.length, only: only ?? null,
      build: { sha256: digest(buildFiles.map((file) => `${file.url}:${file.sha256}`).join("\n")), files: buildFiles, httpCache: "disabled via context.route" }, ignoredPreviewApiErrors };
    const next = new Map(rows.map((row) => [row.name, row]));
    const report = [...previous.report.map((row) => next.get(row.name) ?? row), ...rows.filter((row) => !previous.report.some((old) => old.name === row.name))];
    const text = JSON.stringify(report, null, 2) + "\n";
    const provenance = { version: 1, capturedAt: run.capturedAt, clock, reference: reference.provenance, application, comparatorSha256, render: RENDER,
      counts: { registered: registered.length, optionalInteractions: extras.length, capturedThisRun: rows.length, retainedRows: report.length, compared: report.filter((row) => row.diffPct !== undefined).length, noDesignShot: report.filter((row) => row.status === "no-design-shot").length },
      runs: [...previous.runs, run], reportSha256: digest(text), limits: ["Browser preview fixtures, not native or live-engine acceptance.", "Settled frames, not motion or exhaustive interaction coverage.", clock ? "Browser Date/timezone are caller-selected overrides; reference capturedAt does not attest the original browser timezone or Date at mount. Timers remain real." : "Browser Date/timezone are ambient; captures are not wall-clock deterministic.", "Reference fingerprint covers src only, excluding public assets, configuration and dependencies.", "Working-tree source hash and served main-frame asset hashes are separate provenance; no build-to-source attestation.", "Missing reference states are explicit gaps, never comparisons; frozen coverage metadata does not establish application motion coverage or design approval."] };
    fs.mkdirSync(path.join(out, "captures"), { recursive: true }); fs.renameSync(stage, path.join(out, "captures", id)); stage = undefined;
    fs.writeFileSync(path.join(out, "report.json"), text);
    fs.writeFileSync(path.join(out, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
    const html = report.map((row) => `<tr><td>${row.name}</td><td>${row.diffPct ?? row.status}</td>${["app", "design", "diff"].map((kind) => `<td>${row.files[kind] ? `<img loading="lazy" alt="${kind}: ${row.name}" src="${row.files[kind].file}">` : ""}</td>`).join("")}</tr>`).join("\n");
    fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset=utf-8><style>img{width:420px}td{vertical-align:top;font:12px system-ui}</style><p><a href="provenance.json">Capture provenance and limits</a></p><table><tr><th>state</th><th>diff %</th><th>app</th><th>design</th><th>diff</th></tr>${html}</table>`);
    console.log(`Captured ${rows.length}; compared ${provenance.counts.compared}; missing reference ${provenance.counts.noDesignShot}`);
  } finally {
    await browser.close();
    if (stage) fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
