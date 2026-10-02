// Real UI flows: provider key entry in Settings, then a streamed chat exchange from the composer.
import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";

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

test("a provider key saved in Settings shows only its last four characters", async () => {
  const { app, page } = await launch({ hash: "#/settings?section=providers" });
  await saveKey(page, "zai");
  expect(await page.content()).not.toContain(KEY);
  await app.close();
});

test("streamed exchange with thinking and an image, driven from the composer", async () => {
  const fake = await startFakeProvider();
  const { app, page } = await launch({ hash: "#/settings?section=providers", env: { CORTEX_TEST_PROVIDER_BASEURL: `zai=${fake.url}` } });
  await saveKey(page, "zai");

  await page.getByRole("button", { name: "Home", exact: true }).first().click();
  await page.getByTestId("model-trigger").click();
  await page.getByTestId("model-option").filter({ has: page.locator(".badge.run") }).filter({ has: page.locator(".badge.ok") }).first().click();
  await page.getByTestId("model-trigger").click();
  const toggle = page.getByTestId("thinking-toggle").getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("thinking-toggle")).toBeHidden();

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
