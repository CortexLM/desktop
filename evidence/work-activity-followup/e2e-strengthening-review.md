# Work Activity E2E corrected-source review

Current: `tests/e2e/work-activity.spec.ts`, 211 lines; SHA-256 `3cf71b7c5a2ce730ffdbef866c9555758f4974a11844621c8429abc2460be9ff`.
Original frozen baseline: `0166d765dd10a8c332da09563af8c2418ea995cfd2ee07bcdd19b7438a347851`; earlier full-run snapshot `/tmp/opencode/work-activity/initial-full-behavior.spec.ts` hashes to `5740841a75bda4c688f5407122b870bda049698c1b5e80c6746ce55b82ba4af0`.

## Verdict
**Prior filter-mask and component-identity gaps resolved. One new immediate-retirement fence remains ambiguous; narrow gate correction needed for that stronger claim.**

- `:186` clears the Bot filter after stale successful-history release, then checks one row/no retired title. A hidden deleted-owner row can no longer satisfy that assertion through the prior filter.
- `:193,199–202` retains Activity's own `.content-top` node, confirms actual preview URL before IPC delivery, releases both real route callbacks after Back, then checks retained node/no Home/visible survivor. This closes the earlier shared-main identity weakness.
- Explicit `{useInnerText:true}` comparisons remain approved; inspected diff against the earlier full-run snapshot only adds stronger race checks, with no assertion weakening.
- **Remaining fence issue `:66,188`:** hold matching uses pathname only. Sidebar `CortexNav` also calls `/api/sessions?kind=chat` (`packages/app/src/shell/shell.tsx:212`); `state/live.ts:30–31` refreshes it on the same deletion event. That GET can consume the single `/api/sessions` hold, while Activity's `/api/sessions?kind=bot` refresh completes normally. The test can pass without proving retirement before its own authoritative refresh.
- Smallest fix: match held requests against `pathname + search` while leaving failure/recorded-path matching unchanged; set this hold to `/api/sessions?kind=bot`. Also record/assert that held request identity. Exact history holds have no query, so remain equivalent. No new gate framework or application change.

## Completed receipt readback
- `race-strengthened.log/json`: one passing case, 2,283 ms; suite 3,188.593 ms, zero retries/errors. Pass establishes its executed assertions, not the ambiguous request-owner claim above.
- `lifecycle-corrected.log/json`: both corrected lifecycle cases passed (4,270/4,013 ms; suite 5,161.413 ms), zero retries/errors. Their source is unchanged by this race-only diff.
- Original baseline/initial-target failures remain distinct from corrected lifecycle and strengthened-race results. The running full suite's earlier snapshot cannot inherit later test strengthening; no running result was inspected.
- Source and completed-receipt review only; no application review, edits, builds, tests, network or device execution. No demonstrated product regression; no further collector defect identified.
