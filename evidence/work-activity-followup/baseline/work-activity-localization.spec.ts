import { test, expect, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { Bot, Session, MessageWithParts } from "@cortex/schema";
import { launch, root } from "./fixtures";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

test("Recent Bot outcomes remain readable in eight locales and both themes", async () => {
  let requests = 0;
  const provider = http.createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    const n = ++requests;
    if (n === 2) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { message: "Private activity failure detail" } })); return; }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const send = (delta: object, finish_reason: string | null = null) => res.write(`data: ${JSON.stringify({ id: "activity", object: "chat.completion.chunk", created: 1, model: "reasoner", choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    send({ role: "assistant", content: "Private activity answer" });
    if (n !== 3) { send({}, "stop"); res.end("data: [DONE]\n\n"); }
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(provider.address() as { port: number }).port}/v1`;
  const { app, page, dataDir } = await launch({ hash: "#/activity?theme=light", locale: "en", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify({ fake: { ...catalog.fake, models: { reasoner: catalog.fake.models.reasoner } } }))}`,
    CORTEX_TEST_PROVIDER_BASEURL: `fake=${url}`,
  } });
  const errors: string[] = [], observations: unknown[] = [], titles = ["Report for the regional research and operations team", "Review of the updated account records", "A".repeat(72)];
  page.on("pageerror", (error) => errors.push(error.message));
  const call = (url: string, method = "GET", body?: unknown) => page.evaluate(async ({ url, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${url}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.json();
  }, { url, method, body });
  const readable = async (locale: string, theme: string, state: string, element: Locator) => {
    await expect(element).toBeVisible(); await element.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const measurement = await element.evaluate((element) => {
      const rect = element.getBoundingClientRect(), ink: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim() && !node.parentElement?.closest("svg")) {
        const range = document.createRange(); range.selectNodeContents(node); ink.push(...range.getClientRects());
      }
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
        if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, bounds.left + ancestor.clientLeft); right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth); }
        if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, bounds.top + ancestor.clientTop); bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight); }
      }
      return { text: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth,
        visibleInk: ink.length > 0 && ink.every((r) => r.left >= Math.max(left, rect.left) - .5 && r.right <= Math.min(right, rect.right) + .5 && r.top >= top - .5 && r.bottom <= bottom + .5) };
    });
    observations.push({ locale, theme, state, ...measurement });
    expect(measurement.visibleInk, `${locale} ${theme} ${state}: ${measurement.text}`).toBe(true);
    expect(measurement.contentWidth).toBeLessThanOrEqual(measurement.width + 1);
  };
  const catalogs = ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"].map((locale) => ({ locale,
    copy: JSON.parse(fs.readFileSync(path.join(root, `packages/i18n/locales/${locale}/work.json`), "utf8")) as Record<string, string> }));
  const open = async (locale: string, theme: string) => {
    await page.evaluate((locale) => localStorage.setItem("cortex.locale", locale), locale);
    await page.goto(`cortex://app/index.html#/activity?theme=${theme}`); await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  };
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const { locale, copy } of catalogs) for (const theme of ["light", "dark"]) {
      await open(locale, theme);
      for (const key of ["act.recentScope", "act.recentEmptyTitle", "act.recentEmptyText"]) await readable(locale, theme, key, page.locator("main").getByText(copy[key], { exact: true }));
    }
    await call("/api/providers/fake/key", "PUT", { key: "sk-test-activity" });
    const bot: Bot = await call("/api/bots", "POST", { name: "Research and reporting team for regional operations", model: { providerID: "fake", modelID: "reasoner" } });
    const removed: Bot = await call("/api/bots", "POST", { name: "Previous teammate", model: bot.model });
    for (let index = 0; index < titles.length; index++) {
      const session: Session = await call(`/api/bots/${index ? removed.id : bot.id}/sessions`, "POST", {});
      await call(`/api/sessions/${session.id}`, "PATCH", { title: titles[index] });
      await call(`/api/sessions/${session.id}/prompt`, "POST", { parts: [{ type: "text", text: "Private activity input" }] });
      if (index === 2) {
        await expect.poll(() => requests).toBe(3);
        await call(`/api/sessions/${session.id}/abort`, "POST");
      }
      await expect.poll(async () => {
        const messages: MessageWithParts[] = await call(`/api/sessions/${session.id}/messages`);
        const info = messages.at(-1)?.info;
        return info?.role === "assistant" && Number.isFinite(info.time.completed) ? info.error?.code === "aborted" ? "interrupted" : info.error ? "failed" : "completed" : "pending";
      }).toBe(["completed", "failed", "interrupted"][index]);
    }
    // Leave a genuine historical owner reference, so missing metadata gets the same locale checks.
    await call(`/api/bots/${removed.id}`, "DELETE");
    for (const { locale, copy } of catalogs) for (const theme of ["light", "dark"]) {
      await open(locale, theme);
      await readable(locale, theme, "scope", page.locator("main").getByText(copy["act.recentScope"], { exact: true }));
      for (let index = 0; index < titles.length; index++) {
        const row = page.locator("main").getByRole("button").filter({ hasText: titles[index] });
        await expect(row).toHaveCount(1); await expect(row).toContainText(copy[`act.${["completed", "failed", "interrupted"][index]}`]);
        await expect(row).toContainText(index ? copy["act.missingBot"] : bot.name); await readable(locale, theme, `outcome-${index}`, row);
      }
      await expect(page.locator("main")).not.toContainText("Private activity");
      if (theme === "dark") {
        const file = test.info().outputPath(`activity-outcomes-${locale}.png`);
        await page.screenshot({ path: file }); await test.info().attach(`activity-outcomes-${locale}`, { path: file, contentType: "image/png" });
      }
    }
    expect(requests).toBe(3); expect(observations).toHaveLength(112); expect(errors).toEqual([]);
  } finally {
    await test.info().attach("activity-locale-geometry", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); provider.closeAllConnections(); await new Promise<void>((resolve) => provider.close(() => resolve())); }
  }
});
