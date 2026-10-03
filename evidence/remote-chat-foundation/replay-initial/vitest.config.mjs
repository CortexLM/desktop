const root = "/tmp/opencode/remote-chat-replay-review";
const repo = "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite";
export default {
  root,
  cacheDir: `${root}/cache`,
  resolve: { alias: {
    "@cortex/core": `${root}/core-exports.ts`,
    "@cortex/schema": `${root}/source/packages/schema/src/index.ts`,
    "@cortex/sdk": `${root}/vendor/sdk/package/dist/index.js`,
    "@cortex/api-types": `${root}/vendor/api-types/package/dist/index.js`,
    zod: `${repo}/node_modules/zod/index.js`,
  } },
  test: { include: ["probes.test.ts"], environment: "node", testTimeout: 5000, maxWorkers: 1 },
};
