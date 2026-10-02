import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

test("hidden navigation cannot receive focus; theme radios and Undo work from the keyboard", async () => {
  for (const theme of ["light", "dark"]) {
    const { app, page } = await launch({ hash: `#/home?preview&theme=${theme}`, env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(".desk")).toBeVisible();
      await page.evaluate(() => {
        document.startViewTransition = () => { throw new Error("Reduced motion must not start a view transition"); };
      });
      const radios = page.getByRole("radiogroup", { name: "Theme", exact: true });
      await expect(radios.locator('[tabindex="0"]')).toHaveCount(1);
      await radios.getByRole("radio", { name: theme === "light" ? "Light" : "Dark", exact: true }).focus();
      await page.keyboard.press("Home");
      await expect(radios.getByRole("radio", { name: "Dark", exact: true })).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(radios.getByRole("radio", { name: "System", exact: true })).toBeFocused();
      await expect(radios.getByRole("radio", { name: "System", exact: true })).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("End");
      await expect(radios.getByRole("radio", { name: "Light", exact: true })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(radios.getByRole("radio", { name: "System", exact: true })).toBeFocused();
      await page.keyboard.press(theme === "light" ? "End" : "Home");
      await expect(radios.locator('[tabindex="0"]')).toHaveCount(1);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();

      const project = page.getByRole("button", { name: "Spring launch", exact: true });
      await project.click();
      const folded = page.locator(".fold .row").first();
      await folded.evaluate((el: HTMLElement) => el.focus());
      await expect(folded).not.toBeFocused();
      await project.click();
      await folded.focus();
      await expect(folded).toBeFocused();

      await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
      const mode = page.locator(".mode-trigger");
      await mode.evaluate((el: HTMLElement) => el.focus());
      await expect(mode).not.toBeFocused();
      await page.getByRole("button", { name: "Show sidebar", exact: true }).click();

      const draft = page.locator(".home .composer input");
      await draft.fill("Keyboard draft");
      await draft.press(process.platform === "darwin" ? "Meta+b" : "Control+b");
      await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
      await expect(draft).toHaveValue("Keyboard draft");
      await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
      await draft.fill("");

      const setting = page.getByRole("radio", { name: theme === "light" ? "Dark" : "Light", exact: true });
      await draft.fill("Theme change keeps this draft");
      await setting.focus();
      await setting.press("Space");
      await expect(draft).toHaveValue("Theme change keeps this draft");
      await expect(page).toHaveURL(new RegExp(`theme=${theme === "light" ? "dark" : "light"}`));
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "dark" : "light");
      // Hold the inherited-color transition that previously swallowed Space under parallel load.
      const track = radios.locator(".theme-track");
      expect(await track.evaluate((el: HTMLElement) => {
        el.style.setProperty("transition", "color 60s linear", "important");
        el.style.color = "var(--t2)";
        return el.getAnimations().some((a) => a instanceof CSSTransition && a.transitionProperty === "color");
      })).toBe(true);
      const restored = radios.getByRole("radio", { name: theme === "light" ? "Light" : "Dark", exact: true });
      await restored.press("Space");
      await expect(page).toHaveURL(new RegExp(`theme=${theme}`));
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(restored).toBeFocused();
      await expect(restored).toHaveAttribute("aria-checked", "true");
      await track.evaluate((el: HTMLElement) => { el.style.removeProperty("transition"); el.style.removeProperty("color"); });
      await draft.fill("");
      await mode.focus();
      await expect(mode).toBeFocused();
      await mode.click();
      await expect(page.getByRole("menuitemradio", { name: /Cortex Code/ })).toBeVisible();
      await page.keyboard.press(process.platform === "darwin" ? "Meta+b" : "Control+b");
      await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
      await expect(page.getByRole("menuitemradio", { name: /Cortex Code/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Show sidebar", exact: true }).click();

      await page.getByRole("button", { name: "Focus mode", exact: true }).click();
      for (const hidden of [".rail button", ".sidebar .mode-trigger", ".nav-btns button", ".titlebar .seg-tab", ".side.end .hide-focus"]) {
        const control = page.locator(hidden).first();
        await control.evaluate((el: HTMLElement) => el.focus());
        await expect(control).not.toBeFocused();
      }
      const exit = page.getByRole("button", { name: "Exit focus mode", exact: true });
      await expect(exit).toBeFocused();
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("main"))).toBe(true);
      const shot = test.info().outputPath(`keyboard-${theme}.png`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.screenshot({ path: shot, animations: "disabled" });
      await test.info().attach(`keyboard-${theme}`, { path: shot, contentType: "image/png" });
      await exit.click();

      await page.goto(`cortex://app/index.html#/home?theme=${theme}`);
      const id = await page.evaluate(async () => {
        const fetch = (window as unknown as { __bridgeFetch: typeof globalThis.fetch }).__bridgeFetch;
        const r = await fetch("cortex://local/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Keyboard undo", model: { providerID: "test", modelID: "test" } }) });
        if (!r.ok) throw new Error(`Session setup failed: ${r.status}`);
        const { id } = await r.json();
        return id as string;
      });
      await page.goto(`cortex://app/index.html#/chat?theme=${theme}&id=${id}`);
      await page.locator(".content-top > .ibtn").first().click();
      await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
      const undo = page.getByRole("button", { name: "Undo", exact: true });
      await expect(undo).toBeVisible();
      await undo.focus();
      const undoShot = test.info().outputPath(`undo-${theme}.png`);
      await page.screenshot({ path: undoShot, animations: "disabled" });
      await test.info().attach(`undo-${theme}`, { path: undoShot, contentType: "image/png" });
      await undo.press("Enter");
      await expect(page.locator("main .content-top .title")).toHaveText("Keyboard undo");
      await expect(page.locator(".toast")).toHaveCount(0);
      const status = await page.evaluate(async (id) => (await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local/api/sessions/${id}`)).status, id);
      expect(status).toBe(200);
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  }
});

test("frozen shell motion settles, latest tab wins and hidden menus close", async () => {
  const { app, page } = await launch({ hash: "#/home?preview&theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await expect(page.locator(".home")).toBeVisible();
    const work = page.locator(".titlebar").getByRole("tab", { name: "Work", exact: true });
    const chat = page.locator(".titlebar").getByRole("tab", { name: "Chat", exact: true });
    await work.click();
    await expect(work).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).hash).toContain("#/home?");
    await chat.click();
    await work.click();
    await expect(page).toHaveURL(/#\/work-home\?/);
    await expect(page.locator(".travail-filters")).toBeVisible();
    await expect(work).toHaveAttribute("aria-selected", "true");
    await expect(work).toBeFocused();
    await expect.poll(() => page.locator(".titlebar .seg").evaluate((el) => {
      const selected = el.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
      const indicator = el.querySelector(".seg-ind")!.getBoundingClientRect();
      return Math.max(Math.abs(selected.x - indicator.x), Math.abs(selected.width - indicator.width));
    })).toBeLessThan(1);
    await expect.poll(() => page.locator(".titlebar .seg-ind").evaluate((el) => el.getAnimations().length)).toBe(0);
    await work.press("ArrowLeft");
    await expect(chat).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/home\?/);
    // History changes before the view-transition callback commits the route.
    await expect(page.locator(".home")).toBeVisible();
    await expect(chat).toHaveAttribute("aria-selected", "true");
    await expect(chat).toBeFocused();
    await chat.press("ArrowRight");
    await expect(work).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/work-home\?/);
    await expect(page.locator(".travail-filters")).toBeVisible();
    await expect(work).toHaveAttribute("aria-selected", "true");
    await expect(work).toBeFocused();

    const themes = page.getByRole("radiogroup", { name: "Theme", exact: true });
    // Parallel native windows can take pointer hover; keyboard focus keeps the same expansion open.
    await themes.getByRole("radio", { name: "Light", exact: true }).focus();
    await themes.hover();
    await expect.poll(() => themes.evaluate((el) => el.getBoundingClientRect().height)).toBe(112);
    await themes.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themes.locator(".theme-track button").last()).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => themes.locator(".theme-track").evaluate((el) => el.getAnimations().length)).toBe(0);
    await themes.getByRole("radio", { name: "System", exact: true }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(themes.locator(".system-sun")).toBeVisible();
    await expect(themes.locator(".system-moon")).toBeHidden();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themes.locator(".system-moon")).toBeVisible();
    await expect(themes.locator(".system-sun")).toBeHidden();

    const shot = test.info().outputPath("frozen-theme-dark.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    await test.info().attach("frozen-theme-dark", { path: shot, contentType: "image/png" });

    await page.locator(".mode-trigger").click();
    await expect(page.getByRole("menuitemradio", { name: /Cortex Code/ })).toBeVisible();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Backslash" : "Control+Backslash");
    await expect(page.locator(".window")).toHaveAttribute("data-focus", "true");
    await expect(page.getByRole("menuitemradio", { name: /Cortex Code/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Exit focus mode", exact: true })).toBeFocused();
    await expect(page.locator(".variant-pick")).toHaveCount(0);
    expect(await page.locator(".content-top .btn").last().evaluate((el) => {
      const button = el.getBoundingClientRect(), exit = document.querySelector(".focus-btn")!.getBoundingClientRect();
      return button.right <= exit.left;
    })).toBe(true);
    if (process.platform === "darwin") expect((await page.locator(".content-top .title").boundingBox())!.x).toBeGreaterThanOrEqual(96);
    expect(await page.locator(".titlebar").evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-app-region"))).toBe("no-drag");
    const focusShot = test.info().outputPath("frozen-focus-dark.png");
    await page.screenshot({ path: focusShot, animations: "disabled" });
    await test.info().attach("frozen-focus-dark", { path: focusShot, contentType: "image/png" });
    await page.getByRole("button", { name: "3 to approve", exact: true }).click();
    await expect(page).toHaveURL(/#\/approvals\?/);
    await page.getByRole("button", { name: "Exit focus mode", exact: true }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: "System", exact: true })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(/#\/file-pdf\?/);
    await page.getByRole("button", { name: "New project", exact: true }).click();
    await expect(page).toHaveURL(/#\/projects\?.*v=create/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator(".mode-trigger").click();
    await page.getByRole("menuitemradio", { name: /Cortex Code/ }).click();
    await page.getByRole("button", { name: "Connect a repository", exact: true }).click();
    await expect(page).toHaveURL(/#\/code-settings\?/);
    await page.locator(".sidebar").getByRole("button", { name: "cortex-web", exact: true }).click();
    await expect(page).toHaveURL(/#\/code-tasks\?/);
  } finally { await app.close(); }
});
