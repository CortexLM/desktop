import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Default to one macOS GUI test at a time to limit foreground-app contention.
  workers: Number(process.env.E2E_WORKERS ?? (process.platform === "darwin" ? 1 : 4)),
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "test-results/e2e.json" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  outputDir: "test-results/artifacts",
});
