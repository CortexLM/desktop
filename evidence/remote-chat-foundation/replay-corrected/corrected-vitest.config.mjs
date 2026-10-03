import original from "./vitest.config.mjs";

export default {
  ...original,
  cacheDir: "/tmp/opencode/remote-chat-replay-review/corrected-cache",
  test: { ...original.test, include: ["corrected-probes.test.ts"] },
};
