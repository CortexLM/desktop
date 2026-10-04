import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type { Bot } from "@cortex/schema";
import { launch, root } from "./fixtures";

test("Saved Bot memory copy remains readable in eight locales and both themes", async () => {
  const { app, page, dataDir } = await launch({ hash: "#/memory?theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const errors: string[] = [], observations: unknown[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const call = (url: string, method = "GET", body?: unknown) => page.evaluate(async ({ url, method, body }) => {
    const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${url}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
    return response.json();
  }, { url, method, body });
  const readable = async (locale: string, theme: string, state: string, selector: string) => {
    const elements = page.locator(selector);
    await expect(elements.first()).toBeVisible();
    await elements.last().scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).every((animation) => animation.playState === "finished"));
    const rows = await elements.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect(), ink: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim() && !node.parentElement?.closest("svg")) {
        const range = document.createRange(); range.selectNodeContents(node); ink.push(...Array.from(range.getClientRects()));
      }
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
        if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, bounds.left + ancestor.clientLeft); right = Math.min(right, bounds.left + ancestor.clientLeft + ancestor.clientWidth); }
        if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, bounds.top + ancestor.clientTop); bottom = Math.min(bottom, bounds.top + ancestor.clientTop + ancestor.clientHeight); }
      }
      return { text: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth,
        visibleInk: ink.length > 0 && ink.every((r) => r.left >= Math.max(left, rect.left) - 0.5 && r.right <= Math.min(right, rect.right) + 0.5 && r.top >= top - 0.5 && r.bottom <= bottom + 0.5) };
    }));
    observations.push({ locale, theme, state, rows });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) { expect(row.visibleInk, `${locale} ${theme} ${state}: ${row.text}`).toBe(true); expect(row.contentWidth).toBeLessThanOrEqual(row.width + 1); }
  };
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const bot: Bot = await call("/api/bots", "POST", { name: "Notebook", model: { providerID: "unused", modelID: "unused" } });
    for (const locale of ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"]) for (const theme of ["light", "dark"]) {
      const catalog = (namespace: string) => JSON.parse(fs.readFileSync(path.join(root, `packages/i18n/locales/${locale}/${namespace}.json`), "utf8")) as Record<string, string>;
      const system = catalog("system"), bots = catalog("bots");
      await call("/api/settings", "PUT", { memoryEnabled: true });
      await page.evaluate((locale) => localStorage.setItem("cortex.locale", locale), locale);
      await page.goto(`cortex://app/index.html#/memory?theme=${theme}`);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const toggle = page.getByRole("switch", { name: system["memory.toggle"], exact: true });
      await expect(toggle).toBeChecked();
      await expect(page.locator(".systeme-memoff b")).toHaveText(system["memory.liveOnTitle"]);
      await expect(page.locator(".systeme-memoff .systeme-grow > span")).toHaveText(system["memory.liveOnText"]);
      await expect(page.getByText(system["memory.liveEmptyText"], { exact: true })).toBeVisible();
      await readable(locale, theme, "enabled", ".systeme-memoff .systeme-grow, .systeme-narrow .empty p");
      await toggle.focus(); await page.keyboard.press("Space"); await expect(toggle).not.toBeChecked();
      await expect(page.locator(".systeme-memoff .systeme-grow > span")).toHaveText(system["memory.liveOffText"]);
      await expect(page.locator(".systeme-narrow .banner .grow")).toHaveText(system["memory.livePausedText"]);
      await readable(locale, theme, "paused", ".systeme-memoff .systeme-grow, .systeme-narrow .banner, .systeme-narrow .empty p");
      expect(await call("/api/settings")).toEqual({ memoryEnabled: false });
      if (theme === "dark") {
        const file = test.info().outputPath(`memory-paused-${locale}.png`);
        await page.screenshot({ path: file }); await test.info().attach(`memory-paused-${locale}`, { path: file, contentType: "image/png" });
      }
      await page.goto(`cortex://app/index.html#/settings?section=privacy&theme=${theme}`);
      await expect(page.locator('[role="switch"][aria-label="' + system["settings.t.privacy.memory"] + '"]')).not.toBeChecked();
      const description = page.getByText(system["settings.t.privacy.memoryLiveDesc"], { exact: true }); await expect(description).toBeVisible();
      await readable(locale, theme, "privacy", ".pg-panel .li:has([aria-label='" + system["settings.t.privacy.memory"] + "']) .grow");
      await page.goto(`cortex://app/index.html#/bot-settings?id=${bot.id}&v=memory&theme=${theme}`);
      await expect(page.getByText(bots["set.memEmptyLiveText"].replace("{name}", bot.name), { exact: true })).toBeVisible();
      await readable(locale, theme, "bot-empty", ".pg-panel .empty p");
    }
    expect(observations).toHaveLength(64); expect(errors).toEqual([]);
  } finally {
    await test.info().attach("memory-locale-geometry", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    try { await app.close(); } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
  }
});
