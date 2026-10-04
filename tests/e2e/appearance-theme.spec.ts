import { test, expect, type Page } from "@playwright/test";
import { launch } from "./fixtures";

test.use({ screenshot: "off", trace: "off" });

const names = { system: "System", light: "Light", dark: "Dark" } as const;
const applied = (page: Page) => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem("cortex.theme") }));
const soft = expect.configure({ soft: true, timeout: 1_000 });

for (const theme of ["light", "dark"] as const) test(`Appearance theme keyboard and rail synchronization — 960 ${theme}`, async () => {
  test.setTimeout(35_000);
  const { app, page } = await launch({ hash: `#/settings?section=appearance&theme=${theme}`, locale: "en", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const errors: string[] = [], stages: unknown[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const main = page.getByRole("main").getByRole("radiogroup", { name: "Theme", exact: true });
  const rail = page.locator(".theme");
  const radio = (value: keyof typeof names) => main.getByRole("radio", { name: names[value], exact: true });
  const record = async (stage: string) => stages.push({ stage, ...await applied(page), url: page.url(),
    appearance: await main.getByRole("radio").evaluateAll((elements) => elements.map((el) => ({ name: el.textContent?.trim(), checked: el.getAttribute("aria-checked"), tabIndex: (el as HTMLElement).tabIndex, focused: el === document.activeElement }))),
    rail: await rail.getByRole("radio").evaluateAll((elements) => elements.map((el) => ({ name: el.getAttribute("aria-label"), checked: el.getAttribute("aria-checked") }))),
  });
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
    await expect(main).toBeVisible();
    await expect(main.getByRole("radio")).toHaveCount(3);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await record("fresh hash before pointer selection");

    await test.step("pointer selection establishes the requested preference", async () => {
      await radio(theme).click();
      await expect(radio(theme)).toHaveAttribute("aria-checked", "true");
      await expect.poll(() => applied(page)).toEqual({ theme, stored: theme });
      await record("main pointer selection");
    });
    expect.soft(await main.getByRole("radio").evaluateAll((elements) => elements.map((el) => (el as HTMLElement).tabIndex)), "Appearance has exactly one Tab stop at its selected radio").toEqual(theme === "light" ? [-1, 0, -1] : [-1, -1, 0]);

    for (const [key, next] of [["ArrowRight", theme === "light" ? "dark" : "system"], ["ArrowLeft", theme === "light" ? "system" : "light"]] as const) {
      await test.step(`${key} selects and focuses the adjacent theme`, async () => {
        // Independent directions start from an actual accepted pointer selection.
        await radio(theme).click();
        await expect.poll(() => applied(page)).toEqual({ theme, stored: theme });
        await radio(theme).focus();
        await page.keyboard.press(key);
        await soft.poll(() => radio(next).evaluate((el) => ({ checked: el.getAttribute("aria-checked"), focused: el === document.activeElement })), { message: `${key}: adjacent radio is selected and focused` }).toEqual({ checked: "true", focused: true });
        await soft.poll(() => applied(page), { message: `${key}: selection is applied and saved` }).toEqual({ theme: next === "system" ? theme : next, stored: next });
        await record(key);
      });
    }

    await radio(theme).click();
    await radio(theme).focus();
    await page.keyboard.press("Tab");
    await expect.soft(page.getByRole("main").getByRole("button", { name: "English", exact: true }), "Tab exits Appearance's theme group to Language").toBeFocused({ timeout: 1_000 });
    await record("Tab after selected radio");

    const opposite = theme === "light" ? "dark" : "light";
    await test.step("rail selection updates the mounted Appearance group", async () => {
      const target = rail.getByRole("radio", { name: names[opposite], exact: true });
      await target.focus();
      await target.press("Space");
      await expect(target).toHaveAttribute("aria-checked", "true");
      await expect.poll(() => applied(page)).toEqual({ theme: opposite, stored: opposite });
      await expect.soft(radio(opposite), "Appearance follows the rail's explicit preference").toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
      await record("rail opposite selection");
      await page.evaluate(() => document.fonts.ready);
      const path = test.info().outputPath(`appearance-theme-${opposite}.png`);
      await page.screenshot({ path, animations: "disabled" });
      await test.info().attach(`appearance-theme-${opposite}`, { path, contentType: "image/png" });
    });

    const system = rail.getByRole("radio", { name: "System", exact: true });
    await system.focus();
    await system.press("Space");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await expect(system).toHaveAttribute("aria-checked", "true");
      await expect.poll(() => applied(page)).toEqual({ theme: scheme, stored: "system" });
      await expect.soft(radio("system"), `Appearance keeps System selected under ${scheme} OS appearance`).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
      await record(`System under ${scheme} OS appearance`);
    }
    await page.reload();
    await expect(radio("system")).toHaveAttribute("aria-checked", "true");
    await expect(system).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => applied(page)).toEqual({ theme: "dark", stored: "system" });
    await record("reload with saved System preference");
    expect(errors).toEqual([]);
  } finally {
    await test.info().attach(`appearance-theme-observations-${theme}`, { body: JSON.stringify({ theme, stages, errors }, null, 2), contentType: "application/json" });
    await app.close();
  }
});
