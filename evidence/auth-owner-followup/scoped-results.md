# Auth ownership scoped executor results

Invocation: `NODE_ENV=test bun run test -- packages/desktop/test/remote-session.test.ts packages/desktop/test/remote-chat.test.ts packages/core/test/connection.test.ts`

Observed terminal output:
```
 RUN  v5.0.3 /root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite
 Test Files  3 passed (3)
      Tests  38 passed (38)
   Start at  05:06:51
   Duration  11.53s (tests 92%, import 4%, transform 4%)
```

`bun run typecheck` exits 2: only `packages/core/test/remote-sessions.test.ts:48-49` omit required owner in host-state fixtures. Outside executor write scope; parent must supply remote owner. No errors in scoped files or renderer at that invocation. `git diff --check` produced no whitespace errors. LSP unavailable: typescript-language-server not installed. No builds, E2E, Mac, commits or pushes.

Contract: remote state includes owner `{origin: ConnectionUrl, revision: UUID}`, including signed_out/signed_in; optional candidate UUID equals email/local start revision. Local/unavailable fallback has owner null, no candidate. email/local/code/verify_email/mfa require owner; cancel requires origin and candidate; logout is unstamped. Accepted continuation rotates revision, rejected valid pending code preserves it; cancel/clear/logout/destructive failure/origin changes/active invalidation rotate. Candidate cancellation survives step rotation but cannot target its replacement or promoted account. Cancel of unused current revision consumes queued start authority without clearing another candidate. After-await commit checks candidate object, origin and live lifetime.

Modified product/test files: packages/schema/src/index.ts, packages/core/src/connection.ts, packages/core/test/connection.test.ts, packages/desktop/src/remote-session.ts, packages/desktop/test/remote-session.test.ts, packages/desktop/test/remote-chat.test.ts.

New deterministic regressions use explicit arrival/release promises through real SDK/native Fetch. They cover initial cancellation before/during/after acceptance, delayed candidate cancel across resend, stale code/resend/verification/MFA, repeated verification status, rejected-code retry, unused-start cancel with existing candidate, away-back invalidation, active account preservation and post-promotion cancel rejection. Existing held-reply invalidation and real deadline cases remain. Existing remote-chat polling tests were retained, not expanded; their cleanup is outside auth scope.

Parent retains renderer/E2E/docs and the intentional ownerless initial-read Cancel semantic change. No GUI acceptance claimed. First combined test/typecheck tool response was unusable (returned unrelated compressed text); no pass was recorded from it. A subsequent standalone typecheck exposed two caller-test transcription errors; those were corrected before the passing scoped run above.
