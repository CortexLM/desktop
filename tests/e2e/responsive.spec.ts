import { test, expect, type Locator } from "@playwright/test";
import { launch } from "./fixtures";

async function reachable(control: Locator) {
  await expect(control).toBeInViewport({ ratio: 1 });
  await control.click({ trial: true });
}

for (const width of [960, 1024, 1440]) for (const theme of ["light", "dark"]) {
  test(`Work board columns and cards remain reachable — ${width} ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/work-home?theme=${theme}&shot&v=board`, locale: "en", env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, width === 1440 ? 900 : 640), width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "shown");
      const pane = page.locator(".page"), board = pane.locator(".travail-board"), columns = board.locator(".travail-col");
      await expect(columns).toHaveCount(4);
      await expect(board.locator(".travail-kcard")).toHaveCount(9);
      await page.evaluate(() => document.fonts.ready);
      for (const area of [pane, board]) expect(await area.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => columns.evaluateAll((els) => {
        const positions = els.map((el) => el.getBoundingClientRect());
        return { columns: new Set(positions.map((p) => Math.round(p.x))).size, rows: new Set(positions.map((p) => Math.round(p.y))).size };
      })).toEqual({ columns: width === 1440 ? 4 : 2, rows: width === 1440 ? 1 : 2 });

      const scrollTo = async (target: Locator) => {
        const distance = await target.evaluate((el) => {
          const r = el.getBoundingClientRect(), p = el.closest(".page")!.getBoundingClientRect();
          return r.y + r.height / 2 - p.y - p.height / 2;
        });
        // Wheel only: automatic scrollIntoView could conceal horizontal clipping.
        await pane.hover();
        await page.mouse.wheel(0, distance);
        await expect(target).toBeInViewport({ ratio: 1 });
        expect(await pane.evaluate((el) => el.scrollLeft)).toBe(0);
      };
      for (const [label, title] of [
        ["To do", "Prepare the agenda for the 3 pm sync"],
        ["In progress", "Follow up on quotes with no reply for 7 days"],
        ["To approve", "Pay the Atelier Morel invoice of €1,240"],
        ["Done", "File September’s expense reports"],
      ]) {
        const column = board.getByRole("region", { name: label, exact: true });
        await scrollTo(column);
        await expect(column.locator(".travail-col-head")).toContainText(label);
        await expect(column.locator(".travail-kcard-t").first()).toHaveText(title);
        for (const card of await column.locator(".travail-kcard").all()) await reachable(card);
      }
      if (width < 1440) expect(await pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

      const open = board.locator('[data-col="doing"] .travail-kcard').first();
      await scrollTo(open);
      await open.click();
      await expect(page.locator(".content-top .title")).toHaveText("Follow up on unanswered quotes");
      const request = page.locator(".travail-tl .msg-user");
      await expect(request).toContainText("Follow up on every quote with no reply for more than 7 days.");
      await expect(request).toBeInViewport({ ratio: 1 });
      await page.getByRole("button", { name: "Back to the board", exact: true }).click();
      await page.locator(".travail-filters").getByRole("button", { name: /Nova/ }).click();
      const drops = board.locator(".travail-col-empty");
      await expect(drops).toHaveCount(3);
      for (const drop of await drops.all()) {
        await scrollTo(drop);
        await expect(drop).toHaveText("Drop a task here");
        await reachable(drop);
      }
      for (const area of [pane, board]) expect(await area.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    } finally {
      await app.close();
    }
  });
}

test("preview navigation loads fixtures and catches startup URL changes", async () => {
  const { app, page } = await launch({ env: { CORTEX_CATALOG_URL: "data:application/json,{}" } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".desk")).toBeVisible();
    // currententrychange must gate fixtures even without a later hashchange event.
    await page.evaluate(() => history.pushState(null, "", "#/code-review?theme=light&shot&v=review"));
    await expect(page.getByRole("button", { name: "Apply suggestion", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/index\.html$/);
    await page.addInitScript(() => {
      const navigation = (window as unknown as { navigation: EventTarget }).navigation;
      const add = navigation.addEventListener;
      navigation.addEventListener = function (type, listener, options) {
        if (type === "currententrychange") {
          navigation.addEventListener = add;
          // Navigate between App's first render and its subscription, without a timing delay.
          location.hash = "#/code-review?theme=light&shot&v=review";
        }
        add.call(this, type, listener, options);
      };
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "Apply suggestion", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("review, diff, canvas and computer controls remain reachable in small desktop windows", async () => {
  const { app, page } = await launch();
  const base = page.url().split("#")[0];
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    for (const width of [960, 1024]) {
      await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 640), width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      for (const theme of ["light", "dark"]) {
        const show = async (screen: string, variant: string) => {
          const previous = await page.locator("main.content").elementHandle();
          await page.goto(`${base}#/${screen}?theme=${theme}&shot&v=${variant}`);
          // Hash navigation finishes before React replaces the previous screen tree.
          if (previous) { await page.waitForFunction((el) => !el.isConnected, previous); await previous.dispose(); }
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.evaluate(() => document.fonts.ready);
        };

        await test.step(`${width} ${theme}: review suggestion`, async () => {
          await show("code-review", "review");
          const apply = page.getByRole("button", { name: "Apply suggestion", exact: true });
          let distance: number | null = null;
          // Review can replace its inline Comment between locator resolution and evaluation.
          await expect.poll(async () => distance = await apply.evaluate((el) => {
            const parent = el.closest(".code-main");
            if (!el.isConnected || !parent) return null;
            const button = el.getBoundingClientRect(), pane = parent.getBoundingClientRect();
            return button.y + button.height / 2 - pane.y - pane.height / 2;
          })).not.toBeNull();
          await page.locator(".code-main").hover();
          await page.mouse.wheel(0, Math.max(0, distance!));
          await reachable(apply);
          await apply.click();
          await expect(page.locator(".code-cmt-done")).toContainText("Suggestion applied");
        });

        await test.step(`${width} ${theme}: complete split source`, async () => {
          await show("code-diff", "split");
          const diff = page.locator(".code-split");
          for (const side of [1, 2]) {
            const lines = diff.locator(`.code-half:nth-child(${side}) .code-src`);
            const longest = await lines.evaluateAll((els) => els.reduce((best, el, i) => el.textContent!.length > els[best].textContent!.length ? i : best, 0));
            const source = lines.nth(longest);
            const end = () => source.evaluate((el) => {
              const text = el.firstChild!, range = document.createRange();
              range.setStart(text, text.textContent!.length - 1); range.setEnd(text, text.textContent!.length);
              const r = range.getBoundingClientRect(), pane = el.closest(".code-split")!.getBoundingClientRect();
              return { distance: r.x + r.width / 2 - pane.x - pane.width / 2,
                visible: r.left >= pane.left && r.right <= pane.right && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
            });
            await diff.hover();
            await page.mouse.wheel((await end()).distance, 0);
            await expect.poll(async () => (await end()).visible).toBe(true);
          }
        });

        await test.step(`${width} ${theme}: canvas selection and compare`, async () => {
          await show("canvas", "selection");
          const distance = await page.locator(".chat-selbar").evaluate((el) => {
            const bar = el.getBoundingClientRect(), pane = el.closest(".chat-doc")!.getBoundingClientRect();
            return bar.y + bar.height / 2 - pane.y - pane.height / 2;
          });
          await page.locator(".chat-doc").hover();
          await page.mouse.wheel(0, Math.max(0, distance));
          const input = page.locator(".chat-selbar input");
          await reachable(input);
          await input.fill("Shorten this passage");
          const apply = page.locator(".chat-selbar").getByRole("button", { name: "Apply", exact: true });
          await reachable(apply);
          await apply.click();
          await expect(page.locator(".chat-selbar")).toBeHidden();
          await show("canvas", "compare");
          await reachable(page.getByRole("button", { name: "Restore version 2", exact: true }));
          const keep = page.getByRole("button", { name: "Keep version 3", exact: true });
          await reachable(keep);
          await keep.click();
          await expect(page.locator(".chat-cmp-f")).toBeHidden();
        });

        await test.step(`${width} ${theme}: computer actions`, async () => {
          await show("work-task", "computer");
          const pane = page.locator(".travail-pane");
          await reachable(pane.getByRole("button", { name: "Pinned", exact: true }));
          const close = pane.getByRole("button", { name: "Hide the computer", exact: true });
          await reachable(close);
          const take = pane.getByRole("button", { name: "Take over", exact: true });
          await reachable(take);
          await take.click();
          await expect(page.getByRole("dialog", { name: "Taking over the Bot’s computer" })).toBeVisible();
          await page.getByRole("button", { name: "Hand back" }).click();
          await close.click();
          await expect(pane).toHaveAttribute("aria-hidden", "true");
        });
      }
    }
  } finally {
    await app.close();
  }
});
