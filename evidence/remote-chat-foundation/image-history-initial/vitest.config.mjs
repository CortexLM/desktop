const repo = "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite";
export default {
  root: "/tmp/opencode/remote-history-capability-review",
  cacheDir: "/tmp/opencode/remote-history-capability-review/cache",
  resolve: { alias: { "@cortex/core": `${repo}/packages/core/src/index.ts`, "@cortex/schema": `${repo}/packages/schema/src/index.ts` } },
  test: { include: ["history-capability.test.ts"], environment: "node", testTimeout: 15000 },
};
