# manualQa

Scope: main-process SDK/data contract execution, not GUI acceptance. Caller evidence directory used because JS eval/toolkit status is unavailable.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| auth-owner-sdk | Contract main invariants 1-7 | Real RemoteSession, vendored SDK, native Fetch, loopback HTTP | `NODE_ENV=test bun run test -- packages/desktop/test/remote-session.test.ts packages/desktop/test/remote-chat.test.ts packages/core/test/connection.test.ts` | PASS: 38 tests across 3 files | scoped-results |
| auth-owner-wire | Contract smallest settled schema | Core/server/client in-process request boundary | Same invocation, connection.test.ts | PASS | scoped-results |
| auth-owner-types | Required caller detection | TypeScript CLI | `bun run typecheck` | FAIL: external remote-sessions.test.ts:48-49 missing owner; parent action required | scoped-results |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| initial-cancel | Invariant 5 | Before/during/after initial dispatch race | Queued start refuses; live candidate cancels even after step rotation | PASS | scoped-results |
| stale-owner | Invariants 2, 4, 5 | Same-status stale code, resend, verification, MFA and old cancel | Reject before dispatch; replacement remains usable | PASS | scoped-results |
| late-reply | Invariants 5-7 | Cancel/logout/clear/origin replacement with held response | No stale identity/cookie commit; active account preserved on candidate cancel | PASS | scoped-results |
| malformed-stamp | Smallest settled schema | Missing/null/malformed authority and credential-bearing origin | Core rejects before host; output strips private fields | PASS | scoped-results |
| visual-layout | Main-only assigned scope | Responsive/theme layout | not_applicable: executor changes no visual surface; renderer owned separately | not_applicable | scoped-results |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| scoped-results | terminal-result transcript | Observed scoped runner summary, typecheck diagnostics, contract and file ledger | evidence/auth-owner-followup/scoped-results.md |
