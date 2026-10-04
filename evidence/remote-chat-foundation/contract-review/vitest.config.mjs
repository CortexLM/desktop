const repo = "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite";
export default {
  root: "/tmp/opencode/remote-chat-contract-review",
  cacheDir: "/tmp/opencode/remote-chat-contract-review/cache",
  resolve: { alias: { "@cortex/core": `${repo}/packages/core/src/error.ts` } },
  test: { include: ["http-contract.test.ts"], environment: "node", testTimeout: 2000 },
};
