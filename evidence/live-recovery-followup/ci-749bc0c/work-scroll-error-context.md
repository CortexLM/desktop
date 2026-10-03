# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: work-scroll.spec.ts >> Work initial scroll settles after fonts without taking back user control — dark
- Location: tests/e2e/work-scroll.spec.ts:12:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Transition was skipped",
+ ]
```

# Test source

```ts
  39  |           }
  40  |         } });
  41  |       });
  42  |       const base = page.url().split("#")[0];
  43  |       const show = async (variant: string) => {
  44  |         await page.goto(`${page.url().split("#")[0]}#/work-task?shot&theme=${theme}&v=${variant}`);
  45  |         await expect(page.locator(".travail-task")).toBeVisible();
  46  |       };
  47  |       // Intercept real cortex:// font responses: no FontFaceSet mock or font/CSS replacement.
  48  |       await page.route("**/fonts/*.woff2", async (route) => {
  49  |         requests.push(route.request().url());
  50  |         await gate;
  51  |         await route.continue();
  52  |       });
  53  |       const cold = async (duringInitialScroll = false) => {
  54  |         requests = [];
  55  |         initialScroll = undefined;
  56  |         releaseOnInitialScroll = duringInitialScroll;
  57  |         gate = new Promise<void>((resolve) => { release = resolve; });
  58  |         await app.evaluate(({ session }) => session.defaultSession.clearCache());
  59  |         await page.goto(`${base}?work-scroll=${++load}#/work-task?shot&theme=${theme}&v=done`, { waitUntil: "domcontentloaded" });
  60  |         await expect(page.locator(".travail-recap")).toBeVisible();
  61  |         await expect.poll(() => requests.length).toBe(2);
  62  |         expect(requests.every((url) => url.startsWith("cortex://app/fonts/"))).toBe(true);
  63  |         await expect.poll(() => initialScroll).toBeDefined();
  64  |         await frames(page);
  65  |         if (!duringInitialScroll) expect((await metrics(page)).fonts).toBe("loading");
  66  |       };
  67  |       const ready = async () => {
  68  |         release();
  69  |         await page.evaluate(() => document.fonts.ready);
  70  |         await frames(page);
  71  |       };
  72  |       const record = async (name: string, before: Metrics) => {
  73  |         const after = await metrics(page);
  74  |         await test.info().attach(`${name}-${theme}`, { body: JSON.stringify({ requests, before, after }, null, 2), contentType: "application/json" });
  75  |         return after;
  76  |       };
  77  |
  78  |       await test.step("cold fonts finish at the actual bottom", async () => {
  79  |         await cold(true);
  80  |         const before = initialScroll!;
  81  |         expect(before.fonts).toBe("loading");
  82  |         expect(before.gap).toBe(0);
  83  |         await ready();
  84  |         const after = await record("cold-fonts", before);
  85  |         expect(after.fonts).toBe("loaded");
  86  |         expect(after.height).not.toBe(before.height);
  87  |         expect.soft(after.gap).toBe(0);
  88  |       });
  89  |
  90  |       await test.step("warm-font remount still opens at the bottom", async () => {
  91  |         await page.goto(`${page.url().split("#")[0]}#/work-home?shot&theme=${theme}`);
  92  |         await expect(page.locator(".travail-board")).toBeVisible();
  93  |         expect(await page.evaluate(() => document.fonts.status)).toBe("loaded");
  94  |         await show("done");
  95  |         await expect(page.locator(".travail-recap")).toBeVisible();
  96  |         await frames(page);
  97  |         const settled = await metrics(page);
  98  |         await record("warm-fonts", settled);
  99  |         expect(settled.gap).toBe(0);
  100 |       });
  101 |
  102 |       await test.step("wheel intent before font readiness keeps the user's reading position", async () => {
  103 |         await cold();
  104 |         const initial = await metrics(page);
  105 |         await page.locator(".travail-tl .thread").hover();
  106 |         await page.mouse.wheel(0, initial.top > 0 ? -180 : 180);
  107 |         await expect.poll(async () => Math.abs((await metrics(page)).top - initial.top)).toBeGreaterThan(100);
  108 |         const before = await metrics(page);
  109 |         await ready();
  110 |         const after = await record("user-wheel", before);
  111 |         expect(after.gap).toBeGreaterThan(100);
  112 |         // Real font reflow may anchor by a line; a forced bottom jump is much larger.
  113 |         expect(Math.abs(after.top - before.top)).toBeLessThan(40);
  114 |         await page.mouse.wheel(0, -100);
  115 |         await expect.poll(async () => (await metrics(page)).top).toBeLessThan(after.top - 50);
  116 |       });
  117 |
  118 |       await test.step("a new variant cancels the old pending bottom scroll", async () => {
  119 |         await cold();
  120 |         await page.locator(".variant-pick").click();
  121 |         await page.getByRole("menuitemradio", { name: "En cours", exact: true }).click();
  122 |         await expect(page.locator(".travail-recap")).toHaveCount(0);
  123 |         const before = await metrics(page);
  124 |         await ready();
  125 |         const after = await record("variant-change", before);
  126 |         expect(Math.abs(after.top - before.top)).toBeLessThan(40);
  127 |       });
  128 |
  129 |       await test.step("leaving the task cancels its pending scroll", async () => {
  130 |         await cold();
  131 |         await page.goto(`${page.url().split("#")[0]}#/work-home?shot&theme=${theme}`);
  132 |         await expect(page.locator(".travail-task")).toHaveCount(0);
  133 |         await ready();
  134 |         await expect(page.locator(".travail-board")).toBeVisible();
  135 |         await show("running");
  136 |         await frames(page);
  137 |         expect((await metrics(page)).top).toBe(0);
  138 |       });
> 139 |       expect(errors).toEqual([]);
      |                      ^ Error: expect(received).toEqual(expected) // deep equality
  140 |     } finally {
  141 |       release();
  142 |       await page.unrouteAll({ behavior: "wait" });
  143 |       await app.close();
  144 |     }
  145 |   });
  146 | }
  147 |
```
