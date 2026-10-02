// Semantic end states from frozen states.mjs (7b388e2d9674), not frame-accurate motion measurements.
import { test, expect, type Page } from "@playwright/test";
import { launch } from "./fixtures";

const MASCOT_STATES = [
  ["idle", "Idle"], ["listening", "Listening"], ["thinking", "Thinking"],
  ["working", "Working"], ["talking", "Talking"], ["waiting", "Waiting for you"],
  ["blocked", "Blocked"], ["done", "Done"], ["asleep", "Paused"],
] as const;

async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const width of [960, 1440]) for (const theme of ["light", "dark"]) {
  test(`frozen interaction end states — ${width} ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/settings?shot&theme=${theme}`, locale: "en", env: { CORTEX_CATALOG_URL: "data:application/json,{}", CORTEX_TEST_PROVIDER_BASEURL: "" } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, width === 960 ? 640 : 900), width);
      await page.reload();
      const base = page.url().split("#")[0];
      const show = async (route: string, variant = "") => {
        await page.goto(`${base}#/${route}?shot&theme=${theme}${variant ? `&v=${variant}` : ""}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("main")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
      };

      await test.step("settings switch changes only its own state", async () => {
        await show("settings");
        const switches = page.locator(".pg-panel").getByRole("switch");
        await expect(switches).toHaveCount(3);
        const initial = await switches.evaluateAll((els) => els.map((el) => el.getAttribute("aria-checked")));
        expect(initial[0]).toBe("true");
        await switches.first().click();
        await expect(switches.first()).toHaveAttribute("aria-checked", "false");
        expect(await switches.evaluateAll((els) => els.slice(1).map((el) => el.getAttribute("aria-checked")))).toEqual(initial.slice(1));
        await switches.first().press("Space");
        await expect(switches.first()).toHaveAttribute("aria-checked", "true");
        expect(await page.evaluate(() => localStorage.getItem("cortex.pref.general.launch"))).toBeNull();
      });

      await test.step("history delete and Undo preserve every row and its order", async () => {
        await show("history");
        const rows = page.locator(".pg-hrow");
        await expect(rows.first()).toBeVisible();
        const titles = await rows.locator(".ttl").allTextContents();
        expect(titles.length).toBeGreaterThan(1);
        await rows.first().hover();
        await rows.first().getByRole("button", { name: "More actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
        await expect(rows).toHaveCount(titles.length - 1);
        await expect(rows.locator(".ttl")).toHaveText(titles.slice(1));
        const toast = page.locator(".toast").filter({ hasText: "Conversation deleted" });
        await expect(toast).toContainText(titles[0]);
        await toast.getByRole("button", { name: "Undo", exact: true }).click();
        await expect(rows).toHaveCount(titles.length);
        await expect(rows.locator(".ttl")).toHaveText(titles);
      });

      await test.step("completed reasoning expands independently and preserves transcript", async () => {
        // Registry maps the frozen reflexion variant to thinking.
        await show("chat-states", "thinking");
        const blocks = page.getByTestId("reasoning-block");
        await expect(blocks).toHaveCount(2);
        const trigger = blocks.first().locator(".chat-reason-t");
        const panel = blocks.first().locator(".chat-reason-p");
        const users = await page.locator(".msg-user").allTextContents();
        const answer = await page.locator(".msg-bot-row").first().locator(".msg-bot > p").allTextContents();
        expect(users).toHaveLength(2);
        expect(answer).toHaveLength(1);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(blocks.last().locator(".chat-reason-t")).toHaveAttribute("aria-expanded", "true");
        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await expect(panel).toBeVisible();
        await expect(panel.locator("li")).toHaveText([
          "Add the stand, shipping of the pieces and accommodation",
          "Apply the 8% discount negotiated with Studio Nord",
        ]);
        await expect(page.locator(".msg-user")).toHaveText(users);
        await expect(page.locator(".msg-bot-row").first().locator(".msg-bot > p")).toHaveText(answer);
        await trigger.click();
        await expect(panel).toBeHidden();
        await expect(blocks.last().locator(".chat-reason-t")).toHaveAttribute("aria-expanded", "true");
        await trigger.click();
        await expect(panel.locator("li")).toHaveCount(2);
        if (width === 960) await capture(page, `reasoning-expanded-${width}-${theme}`);
      });

      await test.step("file drop reaches Ready and a second drop preserves the first file", async () => {
        // Registry maps vide to empty.
        await show("upload", "empty");
        const zone = page.getByTestId("upload-dropzone");
        const rows = page.locator(".fichiers-urow");
        await expect(rows).toHaveCount(0);
        const drop = async (name: string) => {
          const data = await page.evaluateHandle((name) => {
            const transfer = new DataTransfer();
            transfer.items.add(new File(["%PDF-1.7\nCortex interaction example"], name, { type: "application/pdf" }));
            return transfer;
          }, name);
          try {
            await zone.dispatchEvent("dragenter", { dataTransfer: data });
            await expect(zone).toHaveAttribute("data-over", "true");
            await expect(zone).toContainText("Drop to upload");
            await zone.dispatchEvent("dragover", { dataTransfer: data });
            await zone.dispatchEvent("drop", { dataTransfer: data });
          } finally { await data.dispose(); }
          await expect(zone).not.toHaveAttribute("data-over");
          await expect(rows.filter({ hasText: name }).locator(".badge.ok")).toHaveText("Ready");
        };
        await drop("report.pdf");
        await expect(rows).toHaveCount(1);
        await drop("notes.pdf");
        await expect(rows).toHaveCount(2);
        await expect(rows.locator(".ttl")).toHaveText(["report.pdf", "notes.pdf"]);
        await expect(rows.locator(".badge.ok")).toHaveCount(2);
        if (width === 960) await capture(page, `upload-drop-ready-${width}-${theme}`);
        await rows.last().getByRole("button", { name: "Remove notes.pdf", exact: true }).click();
        await expect(rows).toHaveCount(1);
        await expect(rows.first().locator(".ttl")).toHaveText("report.pdf");
        await expect(rows.first().locator(".badge.ok")).toHaveText("Ready");
      });

      // Four 200px board columns use the frozen 1440px reference size; the other paths cover 960px too.
      if (width === 1440) await test.step("Kanban pointer drop moves exactly one task to Done", async () => {
        // Registry maps tableau to board.
        await show("work-home", "board");
        const board = page.locator(".travail-board");
        const todo = board.locator('[data-col="todo"]');
        const done = board.locator('[data-col="done"]');
        const card = todo.locator(".travail-kcard").first();
        const title = card.locator(".travail-kcard-t");
        await expect(title).toBeVisible();
        const text = await title.innerText();
        const all = await board.locator(".travail-kcard-t").allTextContents();
        const todoCount = await todo.locator(".travail-kcard").count();
        const doneCount = await done.locator(".travail-kcard").count();
        await expect(done).toBeInViewport({ ratio: 1 });
        await title.hover();
        const destination = await done.boundingBox();
        expect(destination).not.toBeNull();
        await page.mouse.down();
        try {
          await page.mouse.move(destination!.x + destination!.width / 2, destination!.y + destination!.height - 24, { steps: 12 });
          await expect(card).toHaveAttribute("data-drag", "true");
          await expect(done).toHaveAttribute("data-over", "true");
        } finally { await page.mouse.up(); }
        await expect(todo.locator(".travail-kcard")).toHaveCount(todoCount - 1);
        await expect(done.locator(".travail-kcard")).toHaveCount(doneCount + 1);
        await expect(done.locator(".travail-kcard-t").filter({ hasText: text })).toHaveCount(1);
        expect((await board.locator(".travail-kcard-t").allTextContents()).sort()).toEqual([...all].sort());
        await expect(board.locator("[data-drag], [data-over]")).toHaveCount(0);
        await expect(page).toHaveURL(/#\/work-home\?/);
        await capture(page, `kanban-dropped-${width}-${theme}`);
      });

      await test.step("approval Undo restores the original pending card", async () => {
        // Registry maps liste to list.
        await show("approvals", "list");
        const cards = page.locator(".travail-appr");
        await expect(cards.first()).toBeVisible();
        const count = await cards.count();
        expect(count).toBeGreaterThan(1);
        const titles = await cards.locator(".ttl").allTextContents();
        const lede = await page.locator(".travail-lede").innerText();
        const first = cards.first();
        await first.getByTestId("approval-allow").click();
        await expect(first).toHaveAttribute("data-out", "ok");
        await expect(page.locator(".travail-appr:not([data-out])")).toHaveCount(count - 1);
        const toast = page.locator(".toast").filter({ hasText: "Approved" });
        await expect(toast).toBeVisible();
        await toast.getByRole("button", { name: "Undo", exact: true }).click();
        await expect(page.locator(".travail-appr[data-out]")).toHaveCount(0);
        await expect(cards.locator(".ttl")).toHaveText(titles);
        await expect(page.locator(".travail-lede")).toHaveText(lede);
        await expect(first.getByTestId("approval-allow")).toBeEnabled();
        await first.getByTestId("approval-allow").click({ trial: true });
        await expect(first.getByRole("checkbox", { name: "Always allow", exact: true })).toHaveAttribute("aria-checked", "false");
      });

      await test.step("image comparison retains 25% after pointer release", async () => {
        // Registry maps comparaison to compare.
        await show("file-image", "compare");
        const compare = page.locator(".medias-cmp");
        const handle = compare.getByRole("slider", { name: "Comparison position", exact: true });
        const layers = compare.locator(".medias-after, .medias-before");
        await expect(layers).toHaveCount(2);
        const images = await layers.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundImage));
        expect(images.every((src) => src.includes("ceramique.png"))).toBe(true);
        const tags = await compare.locator(".medias-tag").allTextContents();
        await expect(handle).toHaveAttribute("aria-valuenow", "50");
        await handle.hover();
        const box = await compare.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.down();
        try {
          await page.mouse.move(box!.x + box!.width / 4, box!.y + box!.height / 2, { steps: 10 });
          await expect(compare).toHaveAttribute("data-drag", "true");
        } finally { await page.mouse.up(); }
        await expect(handle).toHaveAttribute("aria-valuenow", "25");
        await expect(compare).not.toHaveAttribute("data-drag");
        await page.mouse.move(4, 4);
        await expect(handle).toHaveAttribute("aria-valuenow", "25");
        expect(await compare.evaluate((el) => parseFloat(getComputedStyle(el.querySelector(".medias-handle")!).left) / el.getBoundingClientRect().width)).toBeCloseTo(0.25, 2);
        expect(await layers.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundImage))).toEqual(images);
        await expect(compare.locator(".medias-tag")).toHaveText(tags);
        if (width === 960) await capture(page, `image-compare-quarter-${width}-${theme}`);
        await handle.press("ArrowRight");
        await expect(handle).toHaveAttribute("aria-valuenow", "27");
        await page.getByRole("button", { name: "Recenter", exact: true }).click();
        await expect(handle).toHaveAttribute("aria-valuenow", "50");
      });

      await test.step("all nine Bot Studio states preserve the chosen appearance", async () => {
        await show("bot-studio");
        const states = page.getByRole("radiogroup", { name: "State preview", exact: true });
        await expect(states.getByRole("radio")).toHaveCount(9);
        const mascot = page.locator(".stage-canvas > .mascot");
        const shape = mascot.locator(".m-shape");
        const path = await shape.getAttribute("d");
        const color = await shape.getAttribute("fill");
        const name = await page.locator("#bname").inputValue();
        await expect(page.getByTestId("bot-studio-save")).toBeDisabled();
        for (const [state, label] of MASCOT_STATES) {
          await test.step(label, async () => {
            const radio = states.getByRole("radio").filter({ hasText: new RegExp(`^${label}$`) });
            await radio.scrollIntoViewIfNeeded();
            await radio.click();
            await expect(radio).toHaveAttribute("aria-checked", "true");
            await expect(states.locator('[aria-checked="true"]')).toHaveCount(1);
            await expect(mascot).toHaveAttribute("data-state", state);
            await expect(mascot).toHaveAttribute("aria-label", `${name}, ${label}`);
            await expect(page.locator(".stage-caption b")).toHaveText(label);
            await expect(page.locator(`.stage-sizes .mascot[data-state="${state}"]`)).toHaveCount(4);
            await expect(shape).toHaveAttribute("d", path!);
            await expect(shape).toHaveAttribute("fill", color!);
            await expect(page.getByTestId("bot-studio-save")).toBeDisabled();
          });
        }
        await mascot.scrollIntoViewIfNeeded();
        await expect(mascot).toBeInViewport({ ratio: 1 });
        if (width === 1440) await capture(page, `mascot-paused-${width}-${theme}`);
      });

      const sessions = await page.evaluate(async () => {
        const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local/api/sessions");
        if (!response.ok) throw new Error(`Session read failed: ${response.status}`);
        return response.json();
      });
      expect(sessions).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  });
}
