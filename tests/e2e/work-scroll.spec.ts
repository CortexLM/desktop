import { test, expect, type Page } from "@playwright/test";
import { launch } from "./fixtures";

const metrics = (page: Page) => page.locator(".travail-tl .thread").evaluate((el) => ({
  top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight,
  gap: el.scrollHeight - el.clientHeight - el.scrollTop, fonts: document.fonts.status,
}));
const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
type Metrics = Awaited<ReturnType<typeof metrics>>;

for (const theme of ["light", "dark"]) {
  test(`Work initial scroll settles after fonts without taking back user control — ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/work-home?shot&theme=${theme}`, locale: "fr", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
    let release = () => {}, gate = Promise.resolve(), requests: string[] = [], load = 0;
    let releaseOnInitialScroll = false, initialScroll: Metrics | undefined;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      // Native window matches the 1360×840 app frame in the 1440×900 frozen gallery.
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1360, 840));
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1360, height: 840, deviceScaleFactor: 2, mobile: false });
      await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([1360, 840]);
      await page.evaluate(() => document.fonts.ready);
      await page.exposeFunction("recordWorkInitialScroll", (value: Metrics) => {
        initialScroll ??= value;
        if (releaseOnInitialScroll) release();
      });
      await page.addInitScript(() => {
        const native = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop")!;
        Object.defineProperty(Element.prototype, "scrollTop", { ...native, set(value: number) {
          native.set!.call(this, value);
          if (this.matches(".travail-tl .thread")) {
            // Observe native scrolling unchanged; release fonts during its first layout frame.
            void (window as unknown as { recordWorkInitialScroll: (value: Metrics) => Promise<void> }).recordWorkInitialScroll({
              top: this.scrollTop, height: this.scrollHeight, viewport: this.clientHeight,
              gap: this.scrollHeight - this.clientHeight - this.scrollTop, fonts: document.fonts.status,
            });
          }
        } });
      });
      const base = page.url().split("#")[0];
      const show = async (variant: string) => {
        await page.goto(`${page.url().split("#")[0]}#/work-task?shot&theme=${theme}&v=${variant}`);
        await expect(page.locator(".travail-task")).toBeVisible();
      };
      // Intercept real cortex:// font responses: no FontFaceSet mock or font/CSS replacement.
      await page.route("**/fonts/*.woff2", async (route) => {
        requests.push(route.request().url());
        await gate;
        await route.continue();
      });
      const cold = async (duringInitialScroll = false) => {
        requests = [];
        initialScroll = undefined;
        releaseOnInitialScroll = duringInitialScroll;
        gate = new Promise<void>((resolve) => { release = resolve; });
        await app.evaluate(({ session }) => session.defaultSession.clearCache());
        await page.goto(`${base}?work-scroll=${++load}#/work-task?shot&theme=${theme}&v=done`, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".travail-recap")).toBeVisible();
        await expect.poll(() => requests.length).toBe(2);
        expect(requests.every((url) => url.startsWith("cortex://app/fonts/"))).toBe(true);
        await expect.poll(() => initialScroll).toBeDefined();
        await frames(page);
        if (!duringInitialScroll) expect((await metrics(page)).fonts).toBe("loading");
      };
      const ready = async () => {
        release();
        await page.evaluate(() => document.fonts.ready);
        await frames(page);
      };
      const record = async (name: string, before: Metrics) => {
        const after = await metrics(page);
        await test.info().attach(`${name}-${theme}`, { body: JSON.stringify({ requests, before, after }, null, 2), contentType: "application/json" });
        return after;
      };

      await test.step("cold fonts finish at the actual bottom", async () => {
        await cold(true);
        const before = initialScroll!;
        expect(before.fonts).toBe("loading");
        expect(before.gap).toBe(0);
        await ready();
        const after = await record("cold-fonts", before);
        expect(after.fonts).toBe("loaded");
        expect(after.height).not.toBe(before.height);
        expect.soft(after.gap).toBe(0);
      });

      await test.step("warm-font remount still opens at the bottom", async () => {
        await page.goto(`${page.url().split("#")[0]}#/work-home?shot&theme=${theme}`);
        await expect(page.locator(".travail-board")).toBeVisible();
        expect(await page.evaluate(() => document.fonts.status)).toBe("loaded");
        await show("done");
        await expect(page.locator(".travail-recap")).toBeVisible();
        await frames(page);
        const settled = await metrics(page);
        await record("warm-fonts", settled);
        expect(settled.gap).toBe(0);
      });

      await test.step("wheel intent before font readiness keeps the user's reading position", async () => {
        await cold();
        const initial = await metrics(page);
        await page.locator(".travail-tl .thread").hover();
        await page.mouse.wheel(0, initial.top > 0 ? -180 : 180);
        await expect.poll(async () => Math.abs((await metrics(page)).top - initial.top)).toBeGreaterThan(100);
        const before = await metrics(page);
        await ready();
        const after = await record("user-wheel", before);
        expect(after.gap).toBeGreaterThan(100);
        // Real font reflow may anchor by a line; a forced bottom jump is much larger.
        expect(Math.abs(after.top - before.top)).toBeLessThan(40);
        await page.mouse.wheel(0, -100);
        await expect.poll(async () => (await metrics(page)).top).toBeLessThan(after.top - 50);
      });

      await test.step("a new variant cancels the old pending bottom scroll", async () => {
        await cold();
        await page.locator(".variant-pick").click();
        await page.getByRole("menuitemradio", { name: "En cours", exact: true }).click();
        await expect(page.locator(".travail-recap")).toHaveCount(0);
        const before = await metrics(page);
        await ready();
        const after = await record("variant-change", before);
        expect(Math.abs(after.top - before.top)).toBeLessThan(40);
      });

      await test.step("leaving the task cancels its pending scroll", async () => {
        await cold();
        await page.goto(`${page.url().split("#")[0]}#/work-home?shot&theme=${theme}`);
        await expect(page.locator(".travail-task")).toHaveCount(0);
        await ready();
        await expect(page.locator(".travail-board")).toBeVisible();
        await show("running");
        await frames(page);
        expect((await metrics(page)).top).toBe(0);
      });
      expect(errors).toEqual([]);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
      await app.close();
    }
  });
}
