import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { launch, root } from "./fixtures";

const ORIGIN = `chrome-extension://${"a".repeat(32)}`;
const shots = path.join(root, "evidence/browser-connector");

for (const theme of ["dark", "light"]) {
  test(`local browser page pairs and revokes (${theme})`, async () => {
    const { app, page } = await launch({ hash: `#/browser-authorization?theme=${theme}` });
    try {
      const status = page.getByTestId("browser-status");
      await expect(status).toHaveAttribute("data-mode", "off");
      await expect(page.getByText("No tab shared")).toHaveCount(0);
      await page.getByTestId("browser-pair").click();
      const code = (await page.getByTestId("browser-code").textContent())!.replace(/\W/g, "");
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      await expect(status).toHaveAttribute("data-mode", "waiting");
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `pairing-${theme}.png`) });

      // Drive the loopback endpoint exactly as the extension does.
      const port = await page.evaluate(async () => (await (window as unknown as { cortex: { browser: { status(): Promise<{ port: number }> } } }).cortex.browser.status()).port);
      const call = (p: string, token: string | undefined, body: unknown) => fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      const { token } = await (await call("/pair", undefined, { code })).json();
      await call("/share", token, { id: 7, title: "Quarterly report", url: "https://example.com/reports/q3" });
      await expect(status).toHaveAttribute("data-mode", "connected");
      await expect(page.getByTestId("browser-tabs")).toContainText("Quarterly report");
      await page.screenshot({ path: path.join(shots, `connected-${theme}.png`) });

      await page.getByTestId("browser-revoke").click();
      await expect(page.getByTestId("browser-tabs")).toHaveCount(0);
      await expect(page.getByText("No tab shared")).toBeVisible();
      await page.screenshot({ path: path.join(shots, `empty-${theme}.png`) });
    } finally { await app.close(); }
  });
}
