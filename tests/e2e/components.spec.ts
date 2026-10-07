import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

for (const theme of ["light", "dark"]) test(`Components catalog: families, variants and three-preview ceiling (${theme})`, async () => {
  test.setTimeout(180_000);
  const { app, page } = await launch({ hash: `#/components?theme=${theme}&shot`, env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".cmp-block")).toHaveCount(94);
    await expect(page.locator(".cmp-sec")).toHaveCount(12);
    await expect(page.locator(".cmp-family")).toHaveCount(31);
    await expect(page.locator(".cmp-icons figure")).toHaveCount(85);
    await expect(page.locator("[data-accessory]")).toHaveCount(19);
    await expect(page.locator(".cmp-motion-table tbody tr")).toHaveCount(30);
    await expect(page.locator('[data-family="voice"] select')).toHaveValue("listening");
    await expect(page.locator('[data-family="tools"] select')).toHaveValue("tool");
    await expect(page.locator('[data-family="secrets"] select')).toHaveValue("edit");
    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".cmp")!;
      const record = () => { root.dataset.maxFrames = String(Math.max(Number(root.dataset.maxFrames ?? 0), root.querySelectorAll("iframe").length)); };
      new MutationObserver(record).observe(root, { subtree: true, childList: true });
      record();
    });
    const families = await page.locator(".cmp-family").evaluateAll((elements) => elements.map((element) => ({
      id: element.getAttribute("data-family")!,
      variants: [...element.querySelectorAll("option")].map((option) => option.value),
    })));
    for (const family of families) {
      const card = page.locator(`[data-family="${family.id}"]`);
      for (const variant of family.variants) await test.step(`${family.id}/${variant}`, async () => {
        await card.locator(".cmp-live").scrollIntoViewIfNeeded();
        await card.locator("select").selectOption(variant);
        const preview = card.locator("iframe");
        await expect(preview).toHaveAttribute("data-loaded", "");
        await expect(preview).toHaveAttribute("inert", "");
        await expect(preview).toHaveAttribute("aria-hidden", "true");
        await expect(preview).toHaveAttribute("tabindex", "-1");
        const src = await preview.getAttribute("src");
        const params = new URLSearchParams(src!.split("?")[1]);
        expect(params.get("v")).toBe(variant);
        expect(params.get("theme")).toBe(theme);
        expect(params.has("shot")).toBe(true);
        await expect(preview.contentFrame().locator("html")).toHaveAttribute("data-theme", theme);
        // Real fixture content must mount; an inert blank iframe is not a valid preview.
        await expect.poll(() => preview.contentFrame().locator(".content").innerText()).not.toBe("");
        await expect(card.locator("a.cmp-source")).not.toHaveAttribute("target", "_blank");
        expect(await page.locator(".cmp iframe").count()).toBeLessThanOrEqual(3);
      });
    }
    expect(Number(await page.locator(".cmp").getAttribute("data-max-frames"))).toBeLessThanOrEqual(3);
    const pdf = page.locator('[data-family="pdf"]');
    await pdf.locator("select").selectOption("reading");
    await pdf.locator("a.cmp-source").click();
    await expect(page).toHaveURL(/#\/file-pdf\?.*v=reading/);
    await expect(page.locator(".fichiers-root")).toBeVisible();
    expect(app.windows()).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

for (const theme of ["light", "dark"]) test(`Components catalog: keyboard, clipboard and local demos at minimum window (${theme})`, async () => {
  const { app, page } = await launch({ hash: `#/components?theme=${theme}`, env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await expect(page.locator(".cmp-family")).toHaveCount(0);
    await page.getByRole("button", { name: "Open demo catalog", exact: true }).click();
    await expect(page.locator(".cmp-family")).toHaveCount(31);
    const toc = page.locator(".cmp-toc");
    await toc.getByRole("button", { name: "Chat", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#cmp-h-chat")).toBeFocused();
    const message = page.locator(".chat-ucol");
    // Native clipboard writes require the active document, even with Playwright clicks.
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.focus(); window.webContents.focus();
    });
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    await message.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.locator(".toast").filter({ hasText: "Copied to clipboard" })).toBeVisible();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe(await message.locator(".msg-user").innerText());
    await message.getByRole("button", { name: "Edit", exact: true }).click();
    await message.getByRole("textbox").fill("Catalog-only edit");
    await message.getByRole("button", { name: "Save message", exact: true }).click();
    await expect(message.locator(".msg-user")).toHaveText("Catalog-only edit");
    await page.getByTestId("catalog-replay-stream").click();
    await expect(page.locator(".cmp .chat-stop")).toHaveCount(0);
    await expect(page.locator("#cmp-chat")).toContainText("assembly, lighting and insurance.");
    await toc.getByRole("button", { name: "Forms", exact: true }).click();
    const parent = page.getByRole("checkbox", { name: "All notifications", exact: true });
    await expect(parent).toHaveAttribute("aria-checked", "mixed");
    await parent.focus();
    await page.keyboard.press("Space");
    await expect(parent).toBeChecked();
    await toc.getByRole("button", { name: "System", exact: true }).click();
    await page.getByRole("textbox", { name: "6-digit code", exact: true }).fill("482915");
    await page.getByRole("button", { name: "Verify code", exact: true }).click();
    await expect(page.locator("#cmp-system")).toContainText("Code verified (demo).");
    await page.getByRole("button", { name: "Open catalog palette", exact: true }).click();
    await page.getByRole("combobox", { name: "Section to open", exact: true }).fill("Code");
    await page.keyboard.press("Enter");
    await expect(page.locator("#cmp-h-code")).toBeFocused();
    await page.getByRole("button", { name: "Apply suggestion", exact: true }).click();
    await expect(page.locator(".cmp .code-dl[data-k=del]")).toHaveCount(0);
    await toc.getByRole("button", { name: "Overlays", exact: true }).click();
    const rename = page.getByRole("button", { name: "Rename example", exact: true });
    await rename.click();
    await page.getByRole("textbox", { name: "Project name", exact: true }).fill("Catalog project");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(rename).toBeFocused();
    await expect(page.locator("#cmp-overlays")).toContainText("Catalog project");
    await page.getByRole("button", { name: "Toast with Undo", exact: true }).click();
    await expect(page.locator("#cmp-overlays")).toContainText("Project pinned.");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator("#cmp-overlays")).toContainText("Project not pinned.");
    await toc.getByRole("button", { name: "Motion", exact: true }).click();
    await page.getByRole("textbox", { name: "Filter motions", exact: true }).fill("Theme");
    await expect(page.locator(".cmp-motion-table tbody tr")).toHaveCount(5);
    expect(await page.locator(".cmp").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await app.close(); }
});
