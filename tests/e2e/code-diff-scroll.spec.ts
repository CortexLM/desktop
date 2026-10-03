import { test, expect } from "@playwright/test";
import type { Session } from "@cortex/schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./fixtures";
import { fakeOpenAI, toolCall } from "../../packages/core/test/helpers";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

test("Unequal Code diff bodies wheel-scroll to real write tails while headers stay visible", async () => {
  const content = Array.from({ length: 160 }, (_, i) => `line ${i}`).join("\n") + "\nDIFF END";
  const files = [{ path: "diff-short.txt", content: "DIFF END" }, { path: "diff-first.txt", content }, { path: "diff-second.txt", content }];
  const fake = await fakeOpenAI([
    ...files.map((file, i) => ({ deltas: [toolCall(`write-${i}`, "write", file)], finish: "tool_calls" as const })),
    { deltas: [{ content: "All files written." }], finish: "stop" },
  ]);
  const { app, page, dataDir } = await launch({ hash: "#/code?theme=light", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
    CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
  } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const session: Session = await page.evaluate(async (directory) => {
      const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
      const response = await bridge("cortex://local/api/sessions", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "code", directory, model: { providerID: "fake", modelID: "reasoner" } }) });
      if (!response.ok) throw new Error(`Create session: ${response.status}`);
      return response.json();
    }, dataDir);
    const base = `${page.url().split("#")[0]}#/code-session?id=${session.id}`;
    await page.goto(`${base}&theme=light`);
    await page.getByTestId("code-composer-input").fill("Create the three files.");
    await page.getByTestId("code-composer-input").press("Enter");
    const diffs = page.locator(".split-r > .diff");
    for (let i = 0; i < files.length; i++) {
      await page.getByTestId("permission-allow-once").click();
      await expect(diffs).toHaveCount(i + 1);
    }
    await expect(page.getByText("All files written.", { exact: true })).toBeVisible();
    for (const file of files) expect(readFileSync(join(dataDir, file.path), "utf8")).toBe(file.content);

    for (const width of [960, 1440]) {
      await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, w === 960 ? 640 : 900), width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      for (const theme of ["light", "dark"]) {
        await page.goto(`${base}&theme=${theme}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(diffs).toHaveCount(files.length);
        await page.evaluate(() => document.fonts.ready);
        for (let i = 0; i < files.length; i++) {
          const diff = diffs.nth(i), pre = diff.locator("pre"), tail = pre.locator("div").last();
          const header = await diff.locator(".code-head").evaluate((el) => {
            const header = el.getBoundingClientRect(), card = el.parentElement!.getBoundingClientRect();
            return { header: header.toJSON(), card: card.toJSON(),
              withinCard: header.top >= card.top && header.bottom <= card.bottom,
              hitTest: el.contains(document.elementFromPoint(header.left + 20, header.y + header.height / 2)),
            };
          });
          await test.info().attach(`diff-header-${width}-${theme}-${i}`, { body: JSON.stringify(header, null, 2), contentType: "application/json" });
          expect(header, files[i].path).toMatchObject({ withinCard: true, hitTest: true });
          await pre.evaluate((el) => { el.scrollTop = 0; });
          if (files[i].content.includes("\n")) {
            const box = (await pre.boundingBox())!;
            await page.mouse.move(box.x + 30, box.y + 12);
            await page.mouse.wheel(0, 10000);
            await expect.poll(() => pre.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
          }
          await expect(tail).toHaveText("+DIFF END");
          await expect(tail).toBeInViewport({ ratio: 1 });
          await expect(diff.locator(".code-head")).toBeInViewport({ ratio: 1 });
          await expect.poll(() => tail.evaluate((el) => {
            const tail = el.getBoundingClientRect(), pane = el.parentElement!.getBoundingClientRect();
            return tail.top >= pane.top && tail.bottom <= pane.bottom
              && el.contains(document.elementFromPoint(tail.left + 30, tail.y + tail.height / 2));
          })).toBe(true);
        }
        const name = `code-diff-scroll-${width}-${theme}`, shot = test.info().outputPath(`${name}.png`);
        await page.screenshot({ path: shot, animations: "disabled" });
        await test.info().attach(name, { path: shot, contentType: "image/png" });
      }
    }
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); }
});
