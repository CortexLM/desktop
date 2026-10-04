# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: keyboard.spec.ts >> frozen shell motion settles, latest tab wins and hidden menus close
- Location: tests/e2e/keyboard.spec.ts:130:1

# Error details

```
TimeoutError: page.screenshot: Timeout 30000ms exceeded.
Call log:
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded

```

# Test source

```ts
  87  |       await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  88  |       for (const hidden of [".rail button", ".sidebar .mode-trigger", ".nav-btns button", ".titlebar .seg-tab", ".side.end .hide-focus"]) {
  89  |         const control = page.locator(hidden).first();
  90  |         await control.evaluate((el: HTMLElement) => el.focus());
  91  |         await expect(control).not.toBeFocused();
  92  |       }
  93  |       const exit = page.getByRole("button", { name: "Exit focus mode", exact: true });
  94  |       await expect(exit).toBeFocused();
  95  |       await page.keyboard.press("Tab");
  96  |       expect(await page.evaluate(() => !!document.activeElement?.closest("main"))).toBe(true);
  97  |       const shot = test.info().outputPath(`keyboard-${theme}.png`);
  98  |       await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  99  |       await page.screenshot({ path: shot, animations: "disabled" });
  100 |       await test.info().attach(`keyboard-${theme}`, { path: shot, contentType: "image/png" });
  101 |       await exit.click();
  102 | 
  103 |       await page.goto(`cortex://app/index.html#/home?theme=${theme}`);
  104 |       const id = await page.evaluate(async () => {
  105 |         const fetch = (window as unknown as { __bridgeFetch: typeof globalThis.fetch }).__bridgeFetch;
  106 |         const r = await fetch("cortex://local/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Keyboard undo", model: { providerID: "test", modelID: "test" } }) });
  107 |         if (!r.ok) throw new Error(`Session setup failed: ${r.status}`);
  108 |         const { id } = await r.json();
  109 |         return id as string;
  110 |       });
  111 |       await page.goto(`cortex://app/index.html#/chat?theme=${theme}&id=${id}`);
  112 |       await page.locator(".content-top > .ibtn").first().click();
  113 |       await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  114 |       const undo = page.getByRole("button", { name: "Undo", exact: true });
  115 |       await expect(undo).toBeVisible();
  116 |       await undo.focus();
  117 |       const undoShot = test.info().outputPath(`undo-${theme}.png`);
  118 |       await page.screenshot({ path: undoShot, animations: "disabled" });
  119 |       await test.info().attach(`undo-${theme}`, { path: undoShot, contentType: "image/png" });
  120 |       await undo.press("Enter");
  121 |       await expect(page.locator("main .content-top .title")).toHaveText("Keyboard undo");
  122 |       await expect(page.locator(".toast")).toHaveCount(0);
  123 |       const status = await page.evaluate(async (id) => (await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local/api/sessions/${id}`)).status, id);
  124 |       expect(status).toBe(200);
  125 |       expect(errors).toEqual([]);
  126 |     } finally { await app.close(); }
  127 |   }
  128 | });
  129 | 
  130 | test("frozen shell motion settles, latest tab wins and hidden menus close", async () => {
  131 |   const { app, page } = await launch({ hash: "#/home?preview&theme=light", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  132 |   try {
  133 |     await expect(page.locator(".home")).toBeVisible();
  134 |     const work = page.locator(".titlebar").getByRole("tab", { name: "Work", exact: true });
  135 |     const chat = page.locator(".titlebar").getByRole("tab", { name: "Chat", exact: true });
  136 |     await work.click();
  137 |     await expect(work).toHaveAttribute("aria-selected", "true");
  138 |     expect(new URL(page.url()).hash).toContain("#/home?");
  139 |     await chat.click();
  140 |     await work.click();
  141 |     await expect(page).toHaveURL(/#\/work-home\?/);
  142 |     await expect(page.locator(".travail-filters")).toBeVisible();
  143 |     await expect(work).toHaveAttribute("aria-selected", "true");
  144 |     await expect(work).toBeFocused();
  145 |     await expect.poll(() => page.locator(".titlebar .seg").evaluate((el) => {
  146 |       const selected = el.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
  147 |       const indicator = el.querySelector(".seg-ind")!.getBoundingClientRect();
  148 |       return Math.max(Math.abs(selected.x - indicator.x), Math.abs(selected.width - indicator.width));
  149 |     })).toBeLessThan(1);
  150 |     await expect.poll(() => page.locator(".titlebar .seg-ind").evaluate((el) => el.getAnimations().length)).toBe(0);
  151 |     await work.press("ArrowLeft");
  152 |     await expect(chat).toBeFocused();
  153 |     await page.keyboard.press("Enter");
  154 |     await expect(page).toHaveURL(/#\/home\?/);
  155 |     // History changes before the view-transition callback commits the route.
  156 |     await expect(page.locator(".home")).toBeVisible();
  157 |     await expect(chat).toHaveAttribute("aria-selected", "true");
  158 |     await expect(chat).toBeFocused();
  159 |     await chat.press("ArrowRight");
  160 |     await expect(work).toBeFocused();
  161 |     await page.keyboard.press("Enter");
  162 |     await expect(page).toHaveURL(/#\/work-home\?/);
  163 |     await expect(page.locator(".travail-filters")).toBeVisible();
  164 |     await expect(work).toHaveAttribute("aria-selected", "true");
  165 |     await expect(work).toBeFocused();
  166 | 
  167 |     const themes = page.getByRole("radiogroup", { name: "Theme", exact: true });
  168 |     // Parallel native windows can take pointer hover; keyboard focus keeps the same expansion open.
  169 |     await themes.getByRole("radio", { name: "Light", exact: true }).focus();
  170 |     await themes.hover();
  171 |     await expect.poll(() => themes.evaluate((el) => el.getBoundingClientRect().height)).toBe(112);
  172 |     await themes.getByRole("radio", { name: "Dark", exact: true }).click();
  173 |     await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  174 |     await expect(themes.locator(".theme-track button").last()).toHaveAttribute("aria-checked", "true");
  175 |     await expect.poll(() => themes.locator(".theme-track").evaluate((el) => el.getAnimations().length)).toBe(0);
  176 |     await themes.getByRole("radio", { name: "System", exact: true }).click();
  177 |     await page.emulateMedia({ colorScheme: "light" });
  178 |     await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  179 |     await expect(themes.locator(".system-sun")).toBeVisible();
  180 |     await expect(themes.locator(".system-moon")).toBeHidden();
  181 |     await page.emulateMedia({ colorScheme: "dark" });
  182 |     await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  183 |     await expect(themes.locator(".system-moon")).toBeVisible();
  184 |     await expect(themes.locator(".system-sun")).toBeHidden();
  185 | 
  186 |     const shot = test.info().outputPath("frozen-theme-dark.png");
> 187 |     await page.screenshot({ path: shot, animations: "disabled" });
      |                ^ TimeoutError: page.screenshot: Timeout 30000ms exceeded.
  188 |     await test.info().attach("frozen-theme-dark", { path: shot, contentType: "image/png" });
  189 | 
  190 |     await page.locator(".mode-trigger").click();
  191 |     await expect(page.getByRole("menuitemradio", { name: /Cortex Code/ })).toBeVisible();
  192 |     await page.keyboard.press(process.platform === "darwin" ? "Meta+Backslash" : "Control+Backslash");
  193 |     await expect(page.locator(".window")).toHaveAttribute("data-focus", "true");
  194 |     await expect(page.getByRole("menuitemradio", { name: /Cortex Code/ })).toHaveCount(0);
  195 |     await expect(page.getByRole("button", { name: "Exit focus mode", exact: true })).toBeFocused();
  196 |     await expect(page.locator(".variant-pick")).toHaveCount(0);
  197 |     expect(await page.locator(".content-top .btn").last().evaluate((el) => {
  198 |       const button = el.getBoundingClientRect(), exit = document.querySelector(".focus-btn")!.getBoundingClientRect();
  199 |       return button.right <= exit.left;
  200 |     })).toBe(true);
  201 |     if (process.platform === "darwin") expect((await page.locator(".content-top .title").boundingBox())!.x).toBeGreaterThanOrEqual(96);
  202 |     expect(await page.locator(".titlebar").evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-app-region"))).toBe("no-drag");
  203 |     const focusShot = test.info().outputPath("frozen-focus-dark.png");
  204 |     await page.screenshot({ path: focusShot, animations: "disabled" });
  205 |     await test.info().attach("frozen-focus-dark", { path: focusShot, contentType: "image/png" });
  206 |     await page.getByRole("button", { name: "3 to approve", exact: true }).click();
  207 |     await expect(page).toHaveURL(/#\/approvals\?/);
  208 |     await page.getByRole("button", { name: "Exit focus mode", exact: true }).click();
  209 |     await page.reload();
  210 |     await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  211 |     await expect(page.getByRole("radio", { name: "System", exact: true })).toHaveAttribute("aria-checked", "true");
  212 | 
  213 |     await page.getByRole("button", { name: "Documents", exact: true }).click();
  214 |     await expect(page).toHaveURL(/#\/file-pdf\?/);
  215 |     await page.getByRole("button", { name: "New project", exact: true }).click();
  216 |     await expect(page).toHaveURL(/#\/projects\?.*v=create/);
  217 |     await expect(page.getByRole("dialog")).toBeVisible();
  218 |     await page.keyboard.press("Escape");
  219 |     await page.locator(".mode-trigger").click();
  220 |     await page.getByRole("menuitemradio", { name: /Cortex Code/ }).click();
  221 |     await page.getByRole("button", { name: "Connect a repository", exact: true }).click();
  222 |     await expect(page).toHaveURL(/#\/code-settings\?/);
  223 |     await page.locator(".sidebar").getByRole("button", { name: "cortex-web", exact: true }).click();
  224 |     await expect(page).toHaveURL(/#\/code-tasks\?/);
  225 |   } finally { await app.close(); }
  226 | });
  227 | 
```