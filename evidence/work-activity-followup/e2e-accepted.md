# Work Activity E2E acceptance review

**Approved. All identified collector/proof gaps resolved; no remaining blocking finding.**
Source: `tests/e2e/work-activity.spec.ts`, 211 lines.
Final SHA-256: `d98c9205c5dbddfe349a06a4271b4a2a1c135248cf84817705b6d81e11916744`.

- `:66,69,73–74` matches held GETs by pathname + query, records actual heldURL and clears it for the next gate. Failure injection/call records still use pathname; queryless history holds retain their behavior.
- `:188–189` explicitly holds/asserts `/api/sessions?kind=bot` before checking immediate retirement. Sidebar `?kind=chat` cannot consume this hold; the Activity-authoritative refresh stays undelivered until after row removal is asserted.
- `:186` clears the Bot filter before checking stale-response non-resurrection. `:193,199–202` retains Activity's own header and verifies real preview URL before delivery/Back; component identity is no longer inferred from shared main.
- All three saved-row comparisons retain exact prior strings with `{useInnerText:true}`. No weakened containment/regex assertion or product change was needed.
- Read completed `/tmp/opencode/work-activity/final-targeted.log` and `.json`: **6/6 passed**, 7,286.332 ms total, zero retries/errors/skips/flaky results. Strengthened race case: 2,282 ms.
- This final local suite covers both-theme lifecycle/restart, bounded roots/filters, real source Retry, neutral attribution, exact task links, stale deletion and canceled-preview recovery on the coordinator's same frozen application.
- Original `0166d765…` baseline failures and initial 5/7 target with text-reader failures remain separate evidence. The earlier 132-case full run's archived `5740841a…` source cannot inherit these later query/ownership checks; final targeted results bind the strengthened scope.
- Approval is source plus completed local-receipt review, not CI/native or fresh artifact-hash admission. No rerun, application edit, build, network or device operation performed here.
