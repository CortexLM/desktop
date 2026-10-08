import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

for (const width of [960, 1440]) for (const theme of ["light", "dark"]) test(`kit motion and focus - ${width} ${theme}`, async () => {
  const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const observations: unknown[] = [];
  const capture = async (name: string) => {
    await page.evaluate(() => document.fonts.ready);
    const path = test.info().outputPath(`${name}-${width}-${theme}.png`);
    await page.screenshot({ path });
    await test.info().attach(name, { path, contentType: "image/png" });
  };
  try {
    await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, width === 960 ? 640 : 900), width);
    await expect(page.locator(".home")).toBeVisible();
    const tokens = await page.evaluate(() => ["fast", "base", "enter", "exit"].map((name) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${name}`).trim();
      return parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
    }));
    expect(tokens).toEqual([120, 220, 320, 180]);
    observations.push({ scenario: "DSK-14-tokens", tokens });
    const focusControls = async () => {
      await page.keyboard.press("Tab");
      const controls = page.locator(".ibtn, .rail-btn, .theme button, .mode-trigger, .row, .seg-tab, .progress-card, .composer textarea, .composer .model, .send, .pg-nav-i, .pg-theme, .switch");
      for (let index = 0; index < await controls.count(); index++) {
        const control = controls.nth(index);
        if (!await control.isVisible() || !await control.isEnabled()) continue;
        await control.focus();
        const focus = await control.evaluate((element) => {
          const style = getComputedStyle(element);
          return { name: element.getAttribute("aria-label") ?? element.getAttribute("class"), visible: element.matches(":focus-visible"), width: style.outlineWidth, offset: style.outlineOffset, style: style.outlineStyle };
        });
        expect(focus.visible, focus.name ?? "control").toBe(true);
        expect([focus.width, focus.offset, focus.style], focus.name ?? "control").toEqual(["2px", "2px", "solid"]);
        observations.push({ scenario: "DSK-14-focus", focus });
      }
    };
    await focusControls();
    const rail = page.locator(".rail-btn").first();
    await rail.focus();
    await capture("home-focus");
    await rail.hover();
    await page.mouse.down();
    try {
      const pressed = await rail.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
        return { active: element.matches(":active"), transform: getComputedStyle(element).transform, opacity: getComputedStyle(element).opacity };
      });
      expect(pressed).toEqual({ active: true, transform: "matrix(0.97, 0, 0, 0.97, 0, 0)", opacity: "0.9" });
      observations.push({ scenario: "DSK-14-press", pressed });
      await capture("rail-pressed");
    } finally { await page.mouse.up(); }
    const appearance = async () => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByTestId("settings-nav-appearance").click();
      await expect(page.locator(".switch").first()).toBeVisible();
    };
    await appearance();
    await focusControls();
    const toggle = page.locator('.switch[aria-label="Reduce motion"]');
    await page.evaluate(() => {
      (window as unknown as { motionChanged: Promise<void> }).motionChanged = new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          if (!document.documentElement.hasAttribute("data-reduce-motion")) return;
          clearTimeout(deadline); observer.disconnect(); resolve();
        });
        const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Reduced-motion attribute was not applied")); }, 5000);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
      });
    });
    await toggle.click();
    await page.evaluate(() => (window as unknown as { motionChanged: Promise<void> }).motionChanged);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("cortex.pref.appearance.reduceMotion"))).toBe("true");
    await capture("settings-reduced-motion");
    await rail.click();
    await expect(page.locator(".home")).toBeVisible();
    const reduced = await page.locator(".home h1, .home .composer, .progress-card circle.val, .sb-scroll").evaluateAll((elements) => elements.map((element) => ({ name: element.getAttribute("class"), animation: getComputedStyle(element).animationName })));
    expect(reduced).toHaveLength(4);
    expect(reduced.every((value) => value.animation === "none")).toBe(true);
    observations.push({ scenario: "DSK-15-reduced", reduced });
    await capture("home-reduced-motion");
    await page.reload();
    await expect(page.locator(".home")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-reduce-motion"))).toBe(true);
    await appearance();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-reduce-motion"))).toBe(false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await rail.click();
    await expect(page.locator(".home")).toBeVisible();
    expect(await page.locator(".home h1").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    observations.push({ scenario: "DSK-15-OS-preference", animation: "none" });
  } finally {
    await test.info().attach("kit-motion-observations", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    await app.close();
  }
});
