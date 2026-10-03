const repo = "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite";
export default {
  root: "/tmp/opencode/remote-core-projection-review",
  cacheDir: "/tmp/opencode/remote-core-projection-review/cache",
  resolve: { alias: { "@cortex/core": `${repo}/packages/core/src/index.ts`, "@cortex/schema": `${repo}/packages/schema/src/index.ts` } },
  test: { include: ["projection.test.ts"], environment: "node", testTimeout: 3000 },
};
