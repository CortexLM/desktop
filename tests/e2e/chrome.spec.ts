import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

test("static protocol refuses encoded sibling traversal", async () => {
  const { app } = await launch();
  try {
    const statuses = await app.evaluate(async ({ net }) => {
      const urls = ["cortex://app/index.html", "cortex://app/..%2fdist-private%2fsecret.txt", "cortex://app/..%2f..%2fpackage.json"];
      return Promise.all(urls.map(async (url) => (await net.fetch(url)).status));
    });
    expect(statuses).toEqual([200, 403, 403]);
  } finally { await app.close(); }
});

for (const [locale, file, edit, newChat] of [
  ["en", "File", "Edit", "New Chat"],
  ["fr", "Fichier", "Édition", "Nouveau chat"],
]) {
  test(`native window chrome and ${locale} menu`, async () => {
    const { app, page } = await launch({ env: { CORTEX_LOCALE: locale } });
    try {
      await page.addInitScript(() => {
        const violations: string[] = [];
        Object.assign(window, { __cspViolations: violations });
        addEventListener("securitypolicyviolation", (event) => violations.push(`${event.effectiveDirective}: ${event.blockedURI}`));
      });
      await page.reload();
      await expect(page.locator(".home .composer")).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)).toEqual([]);
      const chrome = await app.evaluate(({ BrowserWindow, Menu }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return {
          title: win.getTitle(),
          bounds: win.getBounds(),
          minimum: win.getMinimumSize(),
          traffic: process.platform === "darwin" ? win.getWindowButtonPosition() : null,
          menu: Menu.getApplicationMenu()?.items.map((item) => ({ label: item.label, children: item.submenu?.items.map((child) => child.label) })),
        };
      });
      expect(chrome.title).toBe("Cortex");
      expect(chrome.minimum).toEqual([960, 640]);
      expect(chrome.bounds.width).toBeGreaterThanOrEqual(960);
      expect(chrome.bounds.height).toBeGreaterThanOrEqual(640);
      if (process.platform === "darwin") expect(chrome.traffic).toEqual({ x: 20, y: 15 });
      expect(chrome.menu?.map((item) => item.label)).toEqual(expect.arrayContaining([file, edit]));
      expect(chrome.menu?.find((item) => item.label === file)?.children).toContain(newChat);
    } finally {
      await app.close();
    }
  });
}

test("reduced-motion startup inherits themed text immediately", async () => {
  const { app, page } = await launch({ hash: "#/home?theme=dark", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["dark", "light"]) {
      await page.goto(`cortex://app/index.html#/home?theme=${theme}`);
      await page.reload();
      await expect(page.locator(".home h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await page.locator(".home h1").evaluate((el) => getComputedStyle(el).color === getComputedStyle(document.body).color)).toBe(true);
      expect(await page.locator(".home .composer").evaluate((el) => ({ transition: getComputedStyle(el).transitionDuration, animation: getComputedStyle(el).animationName }))).toEqual({ transition: "0s", animation: "none" });
    }
  } finally { await app.close(); }
});
