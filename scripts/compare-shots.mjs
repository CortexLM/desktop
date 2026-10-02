/* global window, document, localStorage, URLSearchParams */
// Side-by-side comparison with the design screenshots (/root/cortex-ui/shots).
// Renders every registered screen state with the French locale (the design's copy) in preview mode at 1440×900 @2x,
// pixel-diffs it against the design shot, and writes evidence/compare/{index.html,report.json,<id>-<theme>.{app,diff}.png}.
// Usage: node scripts/compare-shots.mjs [--base http://localhost:5299/] [--shots /root/cortex-ui/shots] [--only id,id] [--merge]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const BASE = arg("--base", "http://localhost:5299/").replace(/\/?$/, "/");
const SHOTS = arg("--shots", "/root/cortex-ui/shots");
const OUT = path.resolve("evidence/compare");
const only = arg("--only", "")?.split(",").filter(Boolean);
const merge = process.argv.includes("--merge"); // keep earlier report rows for routes not re-run
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem("cortex.locale", "fr"));
const page = await ctx.newPage();
await page.goto(BASE + "#/gallery");
await page.waitForFunction(() => Array.isArray(window.__screens));
const items = await page.$$eval("[data-gallery-item]", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
const extras = [
  ...["dark", "light"].flatMap((theme) => [
    { route: "home", v: "", theme, shot: "home+menu", action: "mode" },
    { route: "history", v: "", theme, shot: "history-menu", action: "history" },
  ]),
  { route: "file-image", v: "view", theme: "light", shot: "file-image+ask", action: "ask" },
];
const jobs = items.map((href) => {
  const [route, q] = href.slice(2).split("?"); const p = new URLSearchParams(q);
  return { route, v: p.get("v") ?? "", theme: p.get("theme") };
}).concat(extras).filter((j) => !only?.length || only.includes(j.route));
const meta = await page.evaluate(() => (window).__screens ?? null);
const designOf = (j) => {
  if (j.shot) return `${j.shot}-${j.theme}.png`;
  const d = meta?.find((s) => s.id === j.route); const base = d?.design ?? j.route;
  const dv = d?.variants?.find((x) => x[0] === j.v)?.[2];
  if (dv?.startsWith(base)) return `${dv}-${j.theme}.png`; // design route of its own, e.g. settings-apparence
  return `${base}${(dv ?? j.v) ? "~" + (dv ?? j.v) : ""}-${j.theme}.png`;
};
const report = [];
for (const j of jobs) {
  const name = `${j.shot ?? `${j.route}${j.v ? "~" + j.v : ""}`}-${j.theme}`;
  await page.goto(`${BASE}?r=${Math.random()}#/${j.route}?theme=${j.theme}&shot${j.v ? "&v=" + j.v : ""}`);
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme && document.body.innerText.trim().length > 0, j.theme, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 });
  if (j.action === "mode") await page.locator(".mode-trigger").click();
  if (j.action === "history") { await page.locator(".pg-hrow").nth(1).hover(); await page.locator(".pg-more").nth(1).click(); }
  if (j.action === "ask") {
    await page.locator(".medias-top button[aria-pressed]").click();
    await page.locator(".medias-ask-sugg button").first().click();
    await page.locator(".medias-ask-thread .msg-bot:not(.thinking)").waitFor();
  }
  await page.waitForTimeout(1100);
  const appPng = path.join(OUT, `${name}.app.png`);
  await page.screenshot({ path: appPng });
  const ref = path.join(SHOTS, designOf(j));
  if (!fs.existsSync(ref)) { report.push({ name, ref: path.basename(ref), status: "no-design-shot" }); continue; }
  fs.copyFileSync(ref, path.join(OUT, `${name}.design.png`));
  const a = PNG.sync.read(fs.readFileSync(appPng)); const b = PNG.sync.read(fs.readFileSync(ref));
  if (a.width !== b.width || a.height !== b.height) { report.push({ name, status: "size-mismatch" }); continue; }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.15 });
  fs.writeFileSync(path.join(OUT, `${name}.diff.png`), PNG.sync.write(diff));
  report.push({ name, ref: path.basename(ref), diffPct: +(100 * n / (a.width * a.height)).toFixed(2) });
  console.log(name, report.at(-1).diffPct ?? report.at(-1).status);
}
await browser.close();
if (merge && fs.existsSync(path.join(OUT, "report.json"))) {
  const prev = JSON.parse(fs.readFileSync(path.join(OUT, "report.json"), "utf8")).filter((r) => !report.some((x) => x.name === r.name));
  report.unshift(...prev);
}
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const rows = report.map((r) => `<tr><td>${r.name}</td><td>${r.diffPct ?? r.status}</td><td><img src="${r.name}.app.png"></td><td>${r.ref ? `<img src="${r.name}.design.png">` : ""}</td><td>${r.diffPct !== undefined ? `<img src="${r.name}.diff.png">` : ""}</td></tr>`).join("\n");
fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html><meta charset=utf-8><style>img{width:420px}td{vertical-align:top;font:12px system-ui}</style><table><tr><th>state</th><th>diff %</th><th>app</th><th>design</th><th>diff</th></tr>${rows}</table>`);
console.log(`compared ${report.length}; mean diff ${(report.filter((r) => r.diffPct !== undefined).reduce((s, r) => s + r.diffPct, 0) / Math.max(1, report.filter((r) => r.diffPct !== undefined).length)).toFixed(2)}%`);
