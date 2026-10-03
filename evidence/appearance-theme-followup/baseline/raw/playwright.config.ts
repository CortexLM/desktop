import base from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/playwright.config";

export default {
  ...base,
  testDir: "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/tests/e2e",
  testMatch: "appearance-theme.spec.ts",
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "/tmp/opencode/appearance-theme-baseline/results.json" }]],
  outputDir: "/tmp/opencode/appearance-theme-baseline/artifacts",
  use: { ...base.use, trace: "off", screenshot: "off" },
};
