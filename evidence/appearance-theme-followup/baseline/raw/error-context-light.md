# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: appearance-theme.spec.ts >> Appearance theme keyboard and rail synchronization — 960 light
- Location: tests/e2e/appearance-theme.spec.ts:10:49

# Error details

```
Error: Appearance has exactly one Tab stop at its selected radio

expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Array [
-   -1,
    0,
-   -1,
+   0,
+   0,
  ]
```

```
Error: ArrowRight: adjacent radio is selected and focused

ArrowRight: adjacent radio is selected and focused

expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Object {
-   "checked": "true",
-   "focused": true,
+   "checked": "false",
+   "focused": false,
  }

Call Log:
- Timeout 1000ms exceeded while waiting on the predicate
```

```
Error: ArrowRight: selection is applied and saved

ArrowRight: selection is applied and saved

expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Object {
-   "stored": "dark",
-   "theme": "dark",
+   "stored": "light",
+   "theme": "light",
  }

Call Log:
- Timeout 1000ms exceeded while waiting on the predicate
```

```
Error: ArrowLeft: adjacent radio is selected and focused

ArrowLeft: adjacent radio is selected and focused

expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Object {
-   "checked": "true",
-   "focused": true,
+   "checked": "false",
+   "focused": false,
  }

Call Log:
- Timeout 1000ms exceeded while waiting on the predicate
```

```
Error: ArrowLeft: selection is applied and saved

ArrowLeft: selection is applied and saved

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
-   "stored": "system",
+   "stored": "light",
    "theme": "light",
  }

Call Log:
- Timeout 1000ms exceeded while waiting on the predicate
```

```
Error: Tab exits Appearance's theme group to Language

expect(locator).toBeFocused() failed

Locator:  getByRole('main').getByRole('button', { name: 'English', exact: true })
Expected: focused
Received: inactive
Timeout:  1000ms

Call log:
  - Tab exits Appearance's theme group to Language getByRole('main').getByRole('button', { name: 'English', exact: true }) with timeout 1000ms
  - waiting for getByRole('main').getByRole('button', { name: 'English', exact: true })
    11 × locator resolved to <button tabindex="0" type="button" id="base-ui-_r_16_" aria-haspopup="menu" class="btn secondary" aria-expanded="false">…</button>
       - unexpected value "inactive"

```

```yaml
- button "English"
```

```
Error: Appearance follows the rail's explicit preference

expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'Dark', exact: true })
Expected: "true"
Received: "false"
Timeout:  1000ms

Call log:
  - Appearance follows the rail's explicit preference getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'Dark', exact: true }) with timeout 1000ms
  - waiting for getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'Dark', exact: true })
    11 × locator resolved to <button role="radio" class="pg-theme" aria-checked="false">…</button>
       - unexpected value "false"

```

```yaml
- radio "Dark"
```

```
Error: Appearance keeps System selected under light OS appearance

expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'System', exact: true })
Expected: "true"
Received: "false"
Timeout:  1000ms

Call log:
  - Appearance keeps System selected under light OS appearance getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'System', exact: true }) with timeout 1000ms
  - waiting for getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'System', exact: true })
    11 × locator resolved to <button role="radio" class="pg-theme" aria-checked="false">…</button>
       - unexpected value "false"

```

```yaml
- radio "System"
```

```
Error: Appearance keeps System selected under dark OS appearance

expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'System', exact: true })
Expected: "true"
Received: "false"
Timeout:  1000ms

Call log:
  - Appearance keeps System selected under dark OS appearance getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'System', exact: true }) with timeout 1000ms
  - waiting for getByRole('main').getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name: 'System', exact: true })
    11 × locator resolved to <button role="radio" class="pg-theme" aria-checked="false">…</button>
       - unexpected value "false"

```

```yaml
- radio "System"
```

# Test source

```ts
  1  | import { test, expect, type Page } from "@playwright/test";
  2  | import { launch } from "./fixtures";
  3  |
  4  | test.use({ screenshot: "off", trace: "off" });
  5  |
  6  | const names = { system: "System", light: "Light", dark: "Dark" } as const;
  7  | const applied = (page: Page) => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem("cortex.theme") }));
  8  | const soft = expect.configure({ soft: true, timeout: 1_000 });
  9  |
  10 | for (const theme of ["light", "dark"] as const) test(`Appearance theme keyboard and rail synchronization — 960 ${theme}`, async () => {
  11 |   test.setTimeout(35_000);
  12 |   const { app, page } = await launch({ hash: `#/settings?section=appearance&theme=${theme}`, locale: "en", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  13 |   const errors: string[] = [], stages: unknown[] = [];
  14 |   page.on("pageerror", (error) => errors.push(error.message));
  15 |   const main = page.getByRole("main").getByRole("radiogroup", { name: "Theme", exact: true });
  16 |   const rail = page.locator(".theme");
  17 |   const radio = (value: keyof typeof names) => main.getByRole("radio", { name: names[value], exact: true });
  18 |   const record = async (stage: string) => stages.push({ stage, ...await applied(page), url: page.url(),
  19 |     appearance: await main.getByRole("radio").evaluateAll((elements) => elements.map((el) => ({ name: el.textContent?.trim(), checked: el.getAttribute("aria-checked"), tabIndex: (el as HTMLElement).tabIndex, focused: el === document.activeElement }))),
  20 |     rail: await rail.getByRole("radio").evaluateAll((elements) => elements.map((el) => ({ name: el.getAttribute("aria-label"), checked: el.getAttribute("aria-checked") }))),
  21 |   });
  22 |   try {
  23 |     await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
  24 |     await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  25 |     await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([960, 640]);
  26 |     await expect(main).toBeVisible();
  27 |     await expect(main.getByRole("radio")).toHaveCount(3);
  28 |     await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  29 |     await record("fresh hash before pointer selection");
  30 |
  31 |     await test.step("pointer selection establishes the requested preference", async () => {
  32 |       await radio(theme).click();
  33 |       await expect(radio(theme)).toHaveAttribute("aria-checked", "true");
  34 |       await expect.poll(() => applied(page)).toEqual({ theme, stored: theme });
  35 |       await record("main pointer selection");
  36 |     });
  37 |     expect.soft(await main.getByRole("radio").evaluateAll((elements) => elements.map((el) => (el as HTMLElement).tabIndex)), "Appearance has exactly one Tab stop at its selected radio").toEqual(theme === "light" ? [-1, 0, -1] : [-1, -1, 0]);
  38 |
  39 |     for (const [key, next] of [["ArrowRight", theme === "light" ? "dark" : "system"], ["ArrowLeft", theme === "light" ? "system" : "light"]] as const) {
  40 |       await test.step(`${key} selects and focuses the adjacent theme`, async () => {
  41 |         // Independent directions start from an actual accepted pointer selection.
  42 |         await radio(theme).click();
  43 |         await expect.poll(() => applied(page)).toEqual({ theme, stored: theme });
  44 |         await radio(theme).focus();
  45 |         await page.keyboard.press(key);
  46 |         await soft.poll(() => radio(next).evaluate((el) => ({ checked: el.getAttribute("aria-checked"), focused: el === document.activeElement })), { message: `${key}: adjacent radio is selected and focused` }).toEqual({ checked: "true", focused: true });
  47 |         await soft.poll(() => applied(page), { message: `${key}: selection is applied and saved` }).toEqual({ theme: next === "system" ? theme : next, stored: next });
  48 |         await record(key);
  49 |       });
  50 |     }
  51 |
  52 |     await radio(theme).click();
  53 |     await radio(theme).focus();
  54 |     await page.keyboard.press("Tab");
  55 |     await expect.soft(page.getByRole("main").getByRole("button", { name: "English", exact: true }), "Tab exits Appearance's theme group to Language").toBeFocused({ timeout: 1_000 });
  56 |     await record("Tab after selected radio");
  57 |
  58 |     const opposite = theme === "light" ? "dark" : "light";
  59 |     await test.step("rail selection updates the mounted Appearance group", async () => {
  60 |       const target = rail.getByRole("radio", { name: names[opposite], exact: true });
  61 |       await target.focus();
  62 |       await target.press("Space");
  63 |       await expect(target).toHaveAttribute("aria-checked", "true");
  64 |       await expect.poll(() => applied(page)).toEqual({ theme: opposite, stored: opposite });
  65 |       await expect.soft(radio(opposite), "Appearance follows the rail's explicit preference").toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
  66 |       await record("rail opposite selection");
  67 |       await page.evaluate(() => document.fonts.ready);
  68 |       const path = test.info().outputPath(`appearance-theme-${opposite}.png`);
  69 |       await page.screenshot({ path, animations: "disabled" });
  70 |       await test.info().attach(`appearance-theme-${opposite}`, { path, contentType: "image/png" });
  71 |     });
  72 |
  73 |     const system = rail.getByRole("radio", { name: "System", exact: true });
  74 |     await system.focus();
  75 |     await system.press("Space");
  76 |     for (const scheme of ["light", "dark"] as const) {
  77 |       await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  78 |       await expect(system).toHaveAttribute("aria-checked", "true");
  79 |       await expect.poll(() => applied(page)).toEqual({ theme: scheme, stored: "system" });
> 80 |       await expect.soft(radio("system"), `Appearance keeps System selected under ${scheme} OS appearance`).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
     |                                                                                                            ^ Error: Appearance keeps System selected under dark OS appearance
  81 |       await record(`System under ${scheme} OS appearance`);
  82 |     }
  83 |     await page.reload();
  84 |     await expect(radio("system")).toHaveAttribute("aria-checked", "true");
  85 |     await expect(system).toHaveAttribute("aria-checked", "true");
  86 |     await expect.poll(() => applied(page)).toEqual({ theme: "dark", stored: "system" });
  87 |     await record("reload with saved System preference");
  88 |     expect(errors).toEqual([]);
  89 |   } finally {
  90 |     await test.info().attach(`appearance-theme-observations-${theme}`, { body: JSON.stringify({ theme, stages, errors }, null, 2), contentType: "application/json" });
  91 |     await app.close();
  92 |   }
  93 | });
  94 |
```