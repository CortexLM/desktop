export default {
  root: "/tmp/opencode/remote-model-race-review",
  cacheDir: "/tmp/opencode/remote-model-race-review/cache",
  test: {
    include: ["probes.test.ts"], environment: "node", testTimeout: 5000,
    pool: "forks", maxWorkers: 1, fileParallelism: false,
    reporters: ["verbose", "json"], outputFile: { json: "/tmp/opencode/remote-model-race-review/tests.json" },
  },
};
