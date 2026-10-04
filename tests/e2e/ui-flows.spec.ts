// Real UI flows: readable provider/model settings, then a streamed exchange from the composer.
import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const KEY = "sk-ui-test-9876WXYZ";

async function saveKey(page: import("@playwright/test").Page, provider: string) {
  await page.getByTestId("provider-search").fill(provider);
  await page.locator(`[data-testid=provider-row][data-provider-id=${provider}]`).click();
  await page.getByTestId("provider-key-input").fill(KEY);
  await page.getByTestId("provider-key-save").click();
  await expect(page.getByText(`Saved · ${KEY.slice(-4)}`)).toBeVisible();
  await expect(page.getByTestId("provider-key-input")).toHaveValue("");
}

for (const theme of ["light", "dark"]) test(`provider key save, reload and removal stay readable — ${theme}`, async () => {
  const { app, page } = await launch({ hash: `#/settings?section=providers&theme=${theme}`, env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
  } });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await saveKey(page, "fake");
    expect(await page.content()).not.toContain(KEY);
    await page.reload();
    await page.getByTestId("provider-search").fill("fake");
    await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
    const input = page.getByTestId("provider-key-input"), save = page.getByTestId("provider-key-save");
    const form = page.locator("form").filter({ has: input });
    await expect(form.locator(".sub")).toHaveText(`Saved · ${KEY.slice(-4)}`);
    await expect(input).toHaveValue("");
    await expect(input).toHaveAttribute("placeholder", "Paste a key");
    await page.evaluate(() => document.fonts.ready);

    for (const width of [960, 1024, 1440]) await test.step(`${width}px`, async () => {
      await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, w === 1440 ? 900 : 640), width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      await expect(page.locator(".window")).toHaveAttribute("data-sidebar", "shown");
      await input.fill(KEY);
      await save.click();
      await expect(input).toHaveValue("");
      await expect(form.locator(".sub")).toHaveText(`Saved · ${KEY.slice(-4)}`);
      expect(await page.content()).not.toContain(KEY);
      await page.locator("main .content-top").hover();
      await expect(page.locator(".toast")).toHaveCount(0);
      await form.scrollIntoViewIfNeeded();
      await expect.poll(() => form.evaluate((el, width) => {
        const issues: string[] = [], row = el.getBoundingClientRect();
        for (const selector of [".ttl", ".sub"]) {
          const text = el.querySelector(selector)!, box = text.getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(text);
          const rects = Array.from(range.getClientRects());
          if (!rects.length || !rects.every((r) => r.width > 0 && r.height > 0
            && r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1
            && [r.left + 1, r.x + r.width / 2, r.right - 1].every((x) => text.contains(document.elementFromPoint(x, r.y + r.height / 2))))) {
            issues.push(`${text.textContent}: text is clipped or covered`);
          }
        }
        const boxes = [".grow", "[data-testid=provider-key-input]", "[data-testid=provider-key-save]"].map((selector) => el.querySelector(selector)!.getBoundingClientRect());
        for (const [i, r] of boxes.entries()) {
          if (r.width <= 0 || r.height <= 0 || r.left < row.left || r.right > row.right + 1 || r.top < row.top || r.bottom > row.bottom + 1
            || r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) issues.push(`Row item ${i} escapes its row or viewport`);
          if (boxes.slice(i + 1).some((b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top)) issues.push(`Row item ${i} overlaps another item`);
        }
        if (width === 1440 && boxes.some((r) => Math.abs(r.y + r.height / 2 - boxes[0].y - boxes[0].height / 2) > 1)) issues.push("Wide row is no longer inline");
        for (const area of [document.documentElement, document.body, el.closest(".page")!]) {
          if (area.scrollWidth > area.clientWidth + 1 || area.scrollLeft !== 0) issues.push("Horizontal page overflow");
        }
        return issues;
      }, width), { message: `${width}px ${theme}: key label, saved hint and controls remain readable` }).toEqual([]);
      const model = page.getByTestId("model-row").filter({ has: page.locator('[data-cap="reasoning"]') }).first();
      await model.scrollIntoViewIfNeeded();
      await expect.poll(() => model.evaluate((el) => {
        const issues: string[] = [], row = el.getBoundingClientRect();
        for (const text of el.querySelectorAll(".ttl, .sub, .badge")) {
          const box = text.getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(text);
          const rects = Array.from(range.getClientRects());
          if (!rects.length || !rects.every((r) => r.width > 0 && r.left >= box.left - 1 && r.right <= box.right + 1
            && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.left >= row.left && r.right <= row.right
            && text.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)))) issues.push(`${text.textContent}: model information is clipped or covered`);
        }
        return issues;
      }), { message: `${width}px ${theme}: model context, cost and capabilities remain readable` }).toEqual([]);
      const shot = test.info().outputPath(`provider-key-${width}-${theme}.png`);
      await page.screenshot({ path: shot, animations: "disabled" });
      await test.info().attach(`provider-key-${width}-${theme}`, { path: shot, contentType: "image/png" });
    });

    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(form.locator(".sub")).toHaveText("Stored on this device, never shown again");
    await page.reload();
    await page.getByTestId("provider-search").fill("fake");
    await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
    await expect(form.locator(".sub")).toHaveText("Stored on this device, never shown again");
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  } finally { await app.close(); }
});

test("streamed exchange with thinking and an image, driven from the composer", async () => {
  const fake = await startFakeProvider();
  const { app, page } = await launch({ hash: "#/settings?section=providers", env: { CORTEX_TEST_PROVIDER_BASEURL: `zai=${fake.url}` } });
  await saveKey(page, "zai");

  await page.getByRole("button", { name: "Home", exact: true }).first().click();
  const modelTrigger = page.getByTestId("model-trigger");
  await modelTrigger.click();
  await expect(modelTrigger).toHaveAttribute("aria-expanded", "true");
  await page.getByTestId("model-option").filter({ has: page.locator(".badge.run") }).filter({ has: page.locator(".badge.ok") }).first().click();
  await expect(modelTrigger).toHaveAttribute("aria-expanded", "false");
  await modelTrigger.click();
  // Opening is queued on an animation frame; the previous popup may still be exiting.
  await expect(modelTrigger).toHaveAttribute("aria-expanded", "true");
  const toggle = page.getByTestId("thinking-toggle").getByRole("switch");
  await toggle.setChecked(false);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.setChecked(true);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(modelTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("thinking-toggle")).toBeHidden();
  await expect(modelTrigger).toBeFocused();

  await page.getByTestId("attach-input").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".chat-att-img")).toBeVisible();
  await page.getByTestId("composer-input").fill("What is in this picture?");
  await page.getByTestId("composer-send").click();

  await expect(page.getByTestId("reasoning-block")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("assistant-text").first()).toContainText("I can see the attached image", { timeout: 20_000 });
  const sent = fake.requests[0];
  expect(sent.auth).toBe(`Bearer ${KEY}`);
  expect(JSON.stringify(sent.body.messages)).toContain("image_url");
  expect(await page.content()).not.toContain(KEY);
  await app.close(); await fake.close();
});

test("rejected sends keep the draft and attachments; retry resends the image", async () => {
  for (const theme of ["light", "dark"]) {
    const fake = await startFakeProvider({ rejectFirst: true });
    const models = structuredClone(catalog);
    models.fake.models["text-only"].limit.context = 100000;
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env: {
      CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(models))}`,
      CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
    } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.evaluate(async () => {
        const bridge = (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch;
        const r = await bridge("cortex://local/api/providers/fake/key", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "sk-test-draft" }) });
        if (!r.ok) throw new Error(`Key setup failed: ${r.status}`);
      });
      await page.reload();
      const select = async (name: string) => {
        await page.getByTestId("model-trigger").click();
        await page.getByTestId("model-option").filter({ hasText: name }).click();
        await expect(page.getByTestId("model-trigger")).toHaveAttribute("aria-expanded", "false");
      };
      await expect(page.getByTestId("model-trigger")).toHaveText(/Plain Text|Reasoner Large/);
      await select("Reasoner Large");
      const input = page.getByTestId("composer-input");
      const draft = "What is in this picture?";
      await input.fill(draft);
      await page.evaluate(() => {
        const read = FileReader.prototype.readAsDataURL;
        FileReader.prototype.readAsDataURL = function (blob) {
          FileReader.prototype.readAsDataURL = read;
          window.addEventListener("release-file", () => read.call(this, blob), { once: true });
        };
      });
      await page.getByTestId("attach-input").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
      await expect(page.getByTestId("composer-send")).toBeDisabled();
      await input.press("Enter");
      expect(fake.requests).toHaveLength(0);
      await page.evaluate(() => window.dispatchEvent(new Event("release-file")));
      await expect(page.locator(".chat-att-img")).toBeVisible();
      await select("Plain Text");
      await page.getByTestId("composer-send").click();
      await expect(page.getByText("This model can’t read images.", { exact: true }).first()).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      await expect(page.locator(".chat-att-img")).toBeVisible();
      expect(fake.requests).toHaveLength(0);
      const homeShot = test.info().outputPath(`draft-kept-${theme}.png`);
      await page.screenshot({ path: homeShot, animations: "disabled" });
      await test.info().attach(`draft-kept-${theme}`, { path: homeShot, contentType: "image/png" });

      await select("Reasoner Large");
      await page.getByTestId("composer-send").click();
      await expect(page).toHaveURL(/#\/chat\?.*\bid=ses_/);
      const error = page.locator(".chat-err");
      await expect(error).toContainText("The model didn’t answer.");
      await expect(page.locator(".chat-thumb")).toBeVisible();
      await expect(page.getByTestId("composer-send")).toBeVisible();
      await input.fill("Different follow-up");
      await page.getByTestId("composer-send").click();
      await expect(page.getByTestId("assistant-text").last()).toContainText("Hello from the streaming test provider", { timeout: 20_000 });
      await expect(page.getByTestId("composer-send")).toBeVisible();
      await error.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(page.getByTestId("assistant-text").last()).toContainText("I can see the attached image", { timeout: 20_000 });
      expect(fake.requests).toHaveLength(3);
      for (const request of [fake.requests[0], fake.requests[2]]) {
        const lastUser = (request.body.messages as { role: string; content: unknown }[]).filter((m) => m.role === "user").at(-1);
        expect(JSON.stringify(lastUser?.content)).toContain("image_url");
        expect(JSON.stringify(lastUser?.content)).toContain(draft);
      }
      await expect(page.getByTestId("composer-send")).toBeVisible();

      await select("Plain Text");
      await input.fill("Follow up on the earlier image");
      await page.getByTestId("composer-send").click();
      await expect(page.getByText("This model can’t read images.", { exact: true }).first()).toBeVisible();
      await expect(input).toHaveValue("Follow up on the earlier image");
      await expect(input).toBeEnabled();
      await expect(page.locator(".chat-att-img")).toHaveCount(0);
      expect(fake.requests).toHaveLength(3);
      const historyShot = test.info().outputPath(`history-image-refusal-${theme}.png`);
      await page.screenshot({ path: historyShot, animations: "disabled" });
      await test.info().attach(`history-image-refusal-${theme}`, { path: historyShot, contentType: "image/png" });
      await page.getByTestId("attach-input").setInputFiles({ name: "again.png", mimeType: "image/png", buffer: PNG });
      await expect(page.locator(".chat-att-img")).toBeVisible();
      await input.fill(draft);
      await page.getByTestId("composer-send").click();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      await expect(page.getByText("This model can’t read images.", { exact: true }).first()).toBeVisible();
      await expect(page.locator(".chat-att-img")).toBeVisible();
      expect(fake.requests).toHaveLength(3);
      // Recovery must work while the refusal remains visible, not after its timeout.
      const refusal = page.locator(".toast").filter({ hasText: "This model can’t read images." }).first();
      for (const control of [input, page.getByTestId("model-trigger"), page.getByTestId("composer-send"), page.locator(".chat-att-x")]) {
        await expect(control).toBeInViewport({ ratio: 1 });
        await control.click({ trial: true, timeout: 1500 });
      }
      const chatShot = test.info().outputPath(`chat-draft-kept-${theme}.png`);
      await page.screenshot({ path: chatShot, animations: "disabled" });
      await test.info().attach(`chat-draft-kept-${theme}`, { path: chatShot, contentType: "image/png" });
      await page.getByTestId("model-trigger").click({ timeout: 1500 });
      await page.getByTestId("model-option").filter({ hasText: "Reasoner Large" }).click({ timeout: 1500 });
      await expect(refusal).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(page.locator(".chat-att-img")).toBeVisible();
      await page.evaluate(() => {
        const read = FileReader.prototype.readAsDataURL;
        FileReader.prototype.readAsDataURL = function () {
          FileReader.prototype.readAsDataURL = read;
          queueMicrotask(() => this.dispatchEvent(new ProgressEvent("error")));
        };
      });
      await page.getByTestId("attach-input").setInputFiles({ name: "unreadable.png", mimeType: "image/png", buffer: PNG });
      await expect(page.getByText("Couldn’t read unreadable.png. Choose the file again.", { exact: true })).toBeVisible();
      await expect(page.locator(".chat-attach .ttl")).toHaveText("again.png");
      await expect(input).toHaveValue(draft);
      await expect(page.getByTestId("composer-send")).toBeEnabled();
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  }
});
