export default {
  root: "/tmp/opencode/live-state-review",
  cacheDir: "/tmp/opencode/live-state-review/vitest-cache",
  test: {
    include: ["bot-owner.test.ts"], environment: "node", testTimeout: 30000,
    pool: "forks", maxWorkers: 1, fileParallelism: false,
    reporters: ["verbose", "json"], outputFile: { json: "/tmp/opencode/live-state-review/bot-owner-results.json" },
  },
};
