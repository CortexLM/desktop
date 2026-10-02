import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

test("anchors, native menus and history preserve routes, variants and chat identities", async () => {
  const initialHash = "#/image-gen?preview&v=refused&theme=light";
  const { app, page } = await launch({ hash: initialHash, env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const menu = (label: string) => app.evaluate(({ Menu, BrowserWindow }, label) => {
    const item = Menu.getApplicationMenu()?.items.flatMap((item) => item.submenu?.items ?? []).find((item) => item.label === label);
    if (!item?.enabled) throw new Error(`Missing or disabled menu item: ${label}`);
    item.click(item, BrowserWindow.getAllWindows()[0], { triggeredByAccelerator: false });
  }, label);
  try {
    const rules = page.getByRole("link", { name: "Learn more about the creation rules" });
    const back = page.getByRole("button", { name: "Back", exact: true });
    const forward = page.getByRole("button", { name: "Forward", exact: true });
    await expect(rules).toBeVisible();
    await expect(back).toBeDisabled();
    await expect(forward).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
    const dark = page.getByRole("radio", { name: "Dark", exact: true });
    // Keyboard focus keeps the expanding rail control open across parallel native windows.
    await dark.focus();
    await dark.press("Space");
    await expect(dark).toHaveAttribute("aria-checked", "true");

    await rules.click();
    await expect(page).toHaveURL(/#\/about$/);
    await expect(page.locator("main .content-top")).toContainText("About");
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await back.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#/image-gen?preview=&v=refused&theme=dark");
    await expect(rules).toBeVisible();
    await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "hidden");
    await menu("Forward");
    await expect(page.locator("main .content-top")).toContainText("About");

    const native = await app.evaluate(({ Menu }) => {
      const items = Menu.getApplicationMenu()!.items;
      return {
        blocked: items.find((item) => item.label === "Go")!.submenu!.items.filter((item) => ["Space", "Scheduled", "Plugins and Skills"].includes(item.label)).map((item) => ({ label: item.label, enabled: item.enabled })),
        fullscreen: items.find((item) => item.label === "View")!.submenu!.items.filter((item) => item.role === "togglefullscreen").length,
      };
    });
    expect(native.blocked).toEqual([
      { label: "Space", enabled: false }, { label: "Scheduled", enabled: false }, { label: "Plugins and Skills", enabled: false },
    ]);
    // AppKit owns the macOS entry; its injected menu requires an OS-level capture.
    expect(native.fullscreen).toBe(process.platform === "darwin" ? 0 : 1);

    const sessions = await page.evaluate(async () => {
      const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
      return Promise.all(["Navigation first chat", "Navigation second chat"].map(async (title) => {
        const response = await bridge("cortex://local/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "chat", title, model: { providerID: "test", modelID: "test" } }) });
        if (!response.ok) throw new Error(`Session creation failed: ${response.status}`);
        return response.json() as Promise<{ id: string; title: string }>;
      }));
    });
    expect(sessions[0].id).not.toBe(sessions[1].id);
    await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
    for (const session of sessions) {
      await page.getByRole("button", { name: session.title, exact: true }).click();
      await expect(page.locator("main .content-top .title")).toHaveText(session.title);
      await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/chat?id=${session.id}`);
    }
    await back.click();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[0].title);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/chat?id=${sessions[0].id}`);
    await menu("Forward");
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[1].title);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/chat?id=${sessions[1].id}`);
    await expect(forward).toBeDisabled();
    await page.goBack();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[0].title);
    await page.goForward();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[1].title);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("settings-nav-connection").click();
    await expect(page.locator(".pg-panel .page-title")).toHaveText("Connection");
    await page.getByRole("button", { name: sessions[0].title, exact: true }).click();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[0].title);
    await back.click();
    await expect(page).toHaveURL(/#\/settings\?v=connection$/);
    await expect(page.locator(".pg-panel .page-title")).toHaveText("Connection");

    await menu("Design Gallery");
    await expect(page.locator(".gal")).toBeVisible();
    await expect(page.frameLocator(".gal iframe").first().locator(".desk")).toBeVisible();
    await expect(page.locator(".gal")).toHaveJSProperty("scrollTop", 0);
    expect(page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes("&shot")).length).toBeLessThan(12);
    await expect(page.locator('.gal-head a[href="#/home"]')).toBeInViewport({ ratio: 1 });
    const canvasPreview = page.locator('[data-gallery-item="canvas~selection-dark"]');
    await canvasPreview.scrollIntoViewIfNeeded();
    await expect(canvasPreview.frameLocator("iframe").locator(".chat-selbar input")).toBeVisible();
    expect(page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes("&shot")).length).toBeLessThan(12);
    await page.locator(".gal-head").scrollIntoViewIfNeeded();
    await expect.poll(() => canvasPreview.locator("iframe").evaluate((frame: HTMLIFrameElement) => frame.contentDocument?.URL)).toBe("about:blank");
    await expect(page.locator(".gal")).toHaveJSProperty("scrollTop", 0);
    await menu("Back");
    await expect(page.locator(".pg-panel .page-title")).toHaveText("Connection");
    await expect(forward).toBeEnabled();
    await page.getByRole("button", { name: sessions[1].title, exact: true }).click();
    await expect(page.locator("main .content-top .title")).toHaveText(sessions[1].title);
    await expect(forward).toBeDisabled();
    await menu("Design Gallery");
    await expect(page.locator(".gal")).toBeVisible();
    await expect(page.frameLocator(".gal iframe").first().locator(".desk")).toBeVisible();
    await expect(page.locator(".gal")).toHaveJSProperty("scrollTop", 0);
    expect(page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes("&shot")).length).toBeLessThan(12);
    await expect(page.locator('.gal-head a[href="#/home"]')).toBeInViewport({ ratio: 1 });
    await page.locator('.gal-head a[href="#/home"]').click({ timeout: 5_000 });
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator(".desk")).toBeVisible();
  } finally {
    await app.close();
  }
});
