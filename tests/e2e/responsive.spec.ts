import { test, expect, type Locator } from "@playwright/test";
import { launch } from "./fixtures";

async function reachable(control: Locator) {
  await expect(control).toBeInViewport({ ratio: 1 });
  await control.click({ trial: true });
}

test("review, diff, canvas and computer controls remain reachable in small desktop windows", async () => {
  const { app, page } = await launch();
  const base = page.url().split("#")[0];
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    for (const width of [960, 1024]) {
      await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 640), width);
      for (const theme of ["light", "dark"]) {
        const show = async (screen: string, variant: string) => {
          await page.goto(`${base}#/${screen}?theme=${theme}&shot&v=${variant}`);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.evaluate(() => document.fonts.ready);
        };

        await test.step(`${width} ${theme}: review suggestion`, async () => {
          await show("code-review", "review");
          const apply = page.getByRole("button", { name: "Apply suggestion", exact: true });
          const distance = await apply.evaluate((el) => {
            const button = el.getBoundingClientRect(), pane = el.closest(".code-main")!.getBoundingClientRect();
            return button.y + button.height / 2 - pane.y - pane.height / 2;
          });
          await page.locator(".code-main").hover();
          await page.mouse.wheel(0, Math.max(0, distance));
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
