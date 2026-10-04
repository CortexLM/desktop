# Authentication owner binding: renderer integration in progress

The accepted design grant permits binding existing sign-in controls to main-owned
attempts. This increment does not enable new verification/MFA forms or remote Chat.

The settled contract separates step freshness from cancellation lifetime:
`owner: { origin, revision }` fences submissions; `candidate` identifies only the
pending candidate. Local/unavailable state has `owner: null`. A new email/local
request consumes its owner revision as its candidate cancellation ID. Accepted
pending steps rotate the submission revision, not that cancellation ID.

The renderer captures the displayed owner with its draft. It never fetches a newer
owner to retry an old code. Same-owner rejected codes retain their draft. Ownership
changes clear code when sanitized state is refreshed. Initial remote selection
obtains main's owner before submission; every await checks the local request guard.
Cancel during that bootstrap stops local continuation. After POST starts, Cancel
uses the captured candidate ID even before the response reaches the renderer.
Cancel before the first auth state is known may navigate away but cannot mutate an
unseen candidate. That intentionally changes the earlier held-initial-GET test.

Main/schema integration passes 299 unit tests with one optional skip, typecheck,
lint, i18n and a production build. The first integrated Electron run passes eight
auth cases (`/tmp/opencode/auth-owner-e2e`). Those results precede the recovery
corrections below and do not establish their acceptance.

Visual inspection found an old email label surviving a replacement-state refresh;
the renderer now updates that label. Independent source review found two further
recovery defects: ownerless remote retry after bootstrap read failure, and early
loss of the initial candidate cancellation identity after failed POST delivery.
Both are corrected in source; the corrected production build passes. The stale
form test now checks the new email and cleared code without reloading. Two more
deterministic recovery regressions now pass. The corrected full auth suite passes
all ten cases in 1.1 minutes at `/tmp/opencode/auth-owner-recovery-diagnostic`.
The first corrected run at `/tmp/opencode/auth-owner-recovery-e2e` passed nine cases
but failed initial email dispatch in the dark continuation case. Its cause remains
unknown; that negative is retained. An isolated diagnostic passed, then the full
diagnostic run passed without application changes. This is not proof that the
earlier failure was fixed. Types/lint pass. Independent follow-up review approves
the reviewed fixes with no blockers, retaining WATCH for the unexplained negative;
see `.omo/evidence/auth-owner-integrated-review.md`. Full Electron regression passes
all 165 cases in 16.9 minutes with one worker at
`/tmp/opencode/auth-owner-full-regression`. Linux packaging and the packaged startup
check pass (`SMOKE OK`, exit 0). Native acceptance remains open.
No expiry time is invented; no backend token, challenge or cookie crosses IPC.
Main issues process-local opaque identifiers; they are not durable account identity.
