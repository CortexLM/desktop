# Global Search Bot review

**PASS — scoped source review. No concrete blocker found.**
Reviewed uncommitted `packages/app/src/screens/system/search.tsx` and `tests/e2e/search-bots.spec.ts`.
Observed HEAD `f790056`; Search baseline bytes match briefing HEAD `93c1e78`.

- `search.tsx:21–35`: live results derive from actual session/Bot hooks. Bot `name` and `persona`
  are guaranteed strings by schema/core creation; case/accent normalization searches both.
- `search.tsx:32–34`: Bot records carry their exact ID to `#/bot?id=…`.
  `bots/bot.tsx:29–34` resolves explicit IDs without falling back to the first Bot.
- `search.tsx:39–42,74–82`: keyboard activation and visible rows share the same grouped order;
  active-descendant IDs use that order. Existing session routing and command palette remain intact.
- `search.tsx:26–27,42,49,56–61,88`: initial hook loading hides results; either source failure
  produces localized error/Retry, suppresses selectable results and active-descendant references.
  Retry invokes both real list reloads; `useQuery` sequence guards discard superseded responses.
  Retry retains the error view while awaiting responses; it does not newly enter loading.
- `search.tsx:24,29–37`: fixture query/hits/recent items remain preview-gated; live recently-opened
  rows stay session-only. Empty/error paths introduce no fixture rows or raw engine errors.
- Existing `system.css:42–68` provides wrapping filters, shrinkable input/result text and ellipsis;
  added Bot results reuse those controls. No CSS/import/redesign delta.

## Test-source assessment
- Both-theme 960×640 cases cover real persisted Bot name/persona search, accent/case matching,
  category grouping/filtering, keyboard identity, nondefault exact-ID navigation, reload and deletion.
- Empty-install assertions exclude seeded result rows. The separate refusal case redirects GETs
  to nonexistent real records; both Bot/session failures still traverse IPC and the engine.
  It checks neutral error, no selectable results/raw record name, and recovery after Retry.
- `/tmp/opencode/search-bots-before.log:7–24` records the expected baseline failure: two Bot
  results required, zero received. This is negative evidence, not a passing final run.
- Final build/E2E pending coordinator integration. Tests do not explicitly hold initial loading,
  exercise preview-to-live switching or assert exhaustive small-window geometry/hit targets;
  this review establishes no runtime/visual acceptance for those states.

Source SHA-256: `331ed3f50186a7c09b4dabf7a0257af039b01d8aa342c74ccce81d0f8b7979ba`.
Test SHA-256: `cd6341b92982452ca59a58f7f93422fac326e4b73475e5087a464750b352dbaa`.
Only this report written. No delegation, build/tests, source/docs/evidence edits, CI/owner queries or Mac actions.
