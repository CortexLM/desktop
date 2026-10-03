# Terminal-state integration — independent source approval

**Approved: actual production diff exactly matches the reviewed minimal plan; no blocker found.**
Application base `760c4a046ce454bc8b0ab2fd85c941fec321c3ea`; documentary HEAD `72d2926b284760d96462cc931777761eedf9e3c1`.
Source/test SHA-256 pins stayed identical from `2026-10-03T09:34:41Z` through `09:37:30Z`.
- `git diff <application> -- packages` contains exactly the two intended app files; no untracked package files. Exact reconstruction from baseline confirms only the two Chat line replacements, Code constant and badge replacement.
- Chat `live-chat.tsx:45`: `code === "not_found"` selects direct literal `t("shell.notFound.title")` / `t("shell.notFound.body")` calls; other errors retain existing `chat.err.${k}` mappings.
- Chat `:297`: preserves `"network"` fallback and passes `"not_found"` intact. Load-error supplies no `onRetry`; existing provider/Retry branches and historical-message callers are byte-unchanged. New chat, draft handling and route behavior are unchanged.
- Direct literal calls remain visible to `audit-i18n.mjs:101–104`; all reused keys exist in eight locales. Catalog files equal retained hashes and Git; no new English keys. Retained `i18n.log` reports 0 problems; this reviewer did not execute it.
- Code `code.tsx:227–229,252`: existing latest-assistant lookup remains intact; `failed = status === "error" || (!!lastError && lastError.code !== "aborted")` drives both badge class and copy, with `busy` first.
- `failed` is a pure derivation before the existing missing-session return: no new hooks, state or unsafe session dereference. Existing banner remains `lastError && !busy` (`:260`).
- Unchanged core persists completed assistant errors before publishing error/idle; unchanged hook hydrates full `info`. New successful assistant has no error, so latest-assistant selection clears derived `lastError` and the banner without erasing failed history. Stop/aborted behavior remains separate.
- Current documentation changes versus documentary HEAD are scoped additions in `AGENTS.md`, `docs/engine.md`, `docs/testing.md`, matching this copy/status correction.

| Final file | SHA-256 |
| --- | --- |
| `packages/app/src/screens/chat/live-chat.tsx` | `c70919bb1dd6167f1bd32c4618a11e59aa79df7a7c5484a9adbf7810b79e0a6e` |
| `packages/app/src/screens/code/code.tsx` | `51c76d03b98da536bc84d8e010a22115ca1df1d215df2723fab9224d0a1db225` |
| `tests/e2e/chat-missing.spec.ts` | `a9bdc8e86f3ede94f0b54dc6a5d8b45142a62b98ad9fd0af2515c96bddb3d994` |
| `tests/e2e/code-models.spec.ts` | `ff1bc7e7e6d08f59d713f0c7fccfb79fa35c02b682a870b804988145ae107ff5` |

Both current test files equal their original negative-run snapshots byte-for-byte: retained `chat-baseline/source/chat-missing.spec.ts` and `/tmp/opencode/code-failure-regression/negative/source/tests/e2e/code-models.spec.ts`.
Read existing `/tmp/opencode/terminal-state-integrated/targeted.json` and `.log`: four passes, zero unexpected/skipped/flaky, **12.298064s**, start `2026-10-03T09:32:43.991Z`. That run preceded the equivalent direct-literal refactor, as recorded in `integrated/source-final.json`; it does not certify the final Chat hash above.
**Approval is final-source-only.** No current full-suite, CI, image or native-runtime acceptance claimed. Only offline source/Git/catalog/retained-report inspection; no app/build/test execution, repository edits, commit or delegation. Sole output: this file.
