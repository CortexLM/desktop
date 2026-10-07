import fs from "node:fs";
import path from "node:path";
import { test, expect, launch, root } from "./fixtures";

type Screen = { id: string; variants?: [string, string, string?][] };
const NS = fs.readdirSync(path.join(root, "packages/i18n/locales/en")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const RAW_KEY = new RegExp(`\\b(${NS.join("|")})\\.[a-z][\\w-]*(\\.[\\w-]+)*\\b`, "g");

// Every registered state renders in both themes; copy includes accessibility and tooltip attributes.
test("every design screen and state renders", async () => {
  test.setTimeout(30 * 60_000);
  const { app, page } = await launch({ hash: "#/gallery" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  await page.waitForFunction(() => "__screens" in window);
  const screens = (await page.evaluate(() => (window as unknown as { __screens: Screen[] }).__screens)) as Screen[];
  const failures: string[] = [];
  let count = 0;
  for (const s of screens) {
    for (const v of s.variants?.length ? s.variants.map((x) => x[0]) : [""]) {
      for (const theme of ["dark", "light"]) {
        const hash = `#/${s.id}?theme=${theme}&shot${v ? `&v=${v}` : ""}`;
        await page.goto(`cortex://app/index.html${hash}`);
        const ok = await page.waitForFunction((th) => document.documentElement.dataset.theme === th && document.body.innerText.trim().length > 0, theme, { timeout: 10_000 }).then(() => true, () => false);
        if (!ok) { failures.push(`${hash}: theme or content missing`); continue; }
        await page.waitForTimeout(150);
        const text = await page.evaluate(() => [document.body.innerText, ...Array.from(document.querySelectorAll("[aria-label], [aria-description], [title], [placeholder], [alt]"))
          .flatMap((el) => ["aria-label", "aria-description", "title", "placeholder", "alt"].map((attr) => el.getAttribute(attr) ?? ""))].join("\n"));
        // Components documents these source files; neither filenames nor hostnames are translation keys.
        const raw = [...new Set(text.match(RAW_KEY) ?? [])].filter((k) => !/\.(org|com|dev|io|net)$/.test(k)
          && !(s.id === "components" && ["shell.tsx", "code.tsx", "work.css", "mascot.css", "chat.css", "system.css", "extras.tsx"].includes(k)));
        if (!text.trim()) failures.push(`${hash}: blank`);
        if (raw.length) failures.push(`${hash}: raw keys ${raw.slice(0, 5).join(", ")}`);
        count++;
      }
    }
  }
  await app.close();
  console.log(`rendered ${count} screen states`);
  expect(count).toBeGreaterThan(300);
  expect([...failures, ...errors]).toEqual([]);
});
