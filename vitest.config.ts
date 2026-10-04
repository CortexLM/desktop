import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts", "tests/unit/**/*.test.ts", "packages/app/src/**/*.test.{ts,tsx}"], environment: "node", testTimeout: 20000 },
});
