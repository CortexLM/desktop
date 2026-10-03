# Recorded native invocation

Source: original `manifest.json` fields `invocation`, `startedAt`, `finishedAt`, `durationMs`.
Driver executable/version: `/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node`, **v22.23.3**.
Working directory: `/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite`.

Exact executable plus recorded argv, shell-quoted for readability:

```sh
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/terminal-state-native.mjs \
  /tmp/opencode/terminal-state-native-2956564 \
  /tmp/opencode/desktop-terminal-state-2956564 \
  de7b30a5eedc416a1e1b35756e268fc7028f70908564e15b3ef4df9ec9c94d6e \
  2956564fbe31f882014d74ff3a7f920e839fd634 \
  /tmp/opencode/mac-2956564/members.json
```

Recorded duration: **101193 ms / 101.193 seconds**, `2026-10-03T10:02:16.705Z` through `2026-10-03T10:03:57.898Z`.
The `run.log` retains the original success line. Shell pipeline/redirection syntax is not recorded in argv; the unchanged preparation runbook describes the coordinator command separately.
Actual canonical Mac root: `/private/tmp/opencode/desktop-terminal-state-2956564`. Both installed-identity receipts, backend and saved Code session directories agree.
