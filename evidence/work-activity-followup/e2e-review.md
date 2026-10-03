# Work Activity E2E independent source review

Source: `tests/e2e/work-activity.spec.ts`, 208 lines, six registered cases.
SHA-256: `0166d765dd10a8c332da09563af8c2418ea995cfd2ee07bcdd19b7438a347851` (matches author handoff).
Reviewed updated contract, helpers and existing engine/SDK semantics; subsequently read completed coordinator receipts below. No independent execution, unfinished Activity-source review or repository writes.

## Verdict / narrow corrections
**Meaningful real-engine suite; assertion mismatch now corrected/approved below. Two race-proof gaps remain; neither is a demonstrated application regression. Preserve frozen baseline bytes.**
1. `:107–109,111,116`: snapshots use `innerText()`, comparisons use default `toHaveText()` (textContent). Block descendants can produce line breaks only in innerText; whitespace normalization does not invent missing separators. Use `{useInnerText:true}` for the three snapshot comparisons, or capture textContent consistently. This avoids layout-dependent false failure without weakening retained-row equality.
2. `:183–186`: deletion is tested only after selecting the surviving Bot. A resurrected deleted-owner record remains hidden by that filter, so row count/title absence cannot prove immediate retirement or non-resurrection. Clear the filter and assert absence after stale release; to claim immediate retirement, hold the deletion-triggered authoritative read and assert the deleted row vanishes before that refresh returns.
3. `:190,199`: retained owner is `main.content`, which can survive while Activity unmounts/remounts inside it. Capture an Activity-owned node stable across loading/ready (such as its header), assert the same node remains connected after Back; also assert the actual preview URL before delivering held history. Existing callback counts/history restoration otherwise establish the intended scheduling mechanism.

## Confirmed coverage
- Success, streamed failure, held-stream API abort, manual routine run and all metadata mutations use real routes/IPC. No SQLite injection or fabricated successful engine response.
- Provider failure is **HTTP-200 SSE error**, not HTTP 400 (`:33–41`); installed compatible SDK accepts that error shape. Assertions require persisted non-abort failure, not a particular provider error code. Keep this claim distinct from the locale test's HTTP-400 fixture.
- Light/dark lifecycle checks four root rows, real completion ordering, All/Errors membership, disabled export, private prompt/output/error exclusion and exact session destinations with owner mascots.
- Same-name Bots are selected by distinct actual mascot colors and verified by resulting sessions. `(1)/(2)` ordinal text/order is not asserted; do not claim it is.
- Running follow-up retains a prior row before/after renderer reload, then real failure replaces it. SIGKILL restart reuses the same engine directory and renderer profile; preserved message prefixes/incomplete tails distinguish history from invented completion.
- 40-root case verifies exactly 40 initial history requests, excludes child/Chat/empty-botID records, filters within that set, then admits an older completed root after a real updated-time mutation. No unnecessary server-summary contract.
- Source-error case forwards to real missing-route 404s; still-listed history and failed authoritative re-list must remain errors until Retry. Gates consume one exact GET path; diagnostic calls do not consume their holds. Changing fail flags preserves the pending release callback.
- Missing/deleted Bot case verifies neutral row/composer identity, exact session links and absence of an unrelated mascot/name.
- Cancelled-preview helper changes transition callback scheduling only; real URL/history/IPC remain exercised. Release fences handler return, health IPC and two animation frames. Cleanup releases IPC/transition waits before application/provider/profile cleanup.

## Proof boundaries
- All prompt creation here uses direct real IPC, not composer sending. UI filters, keyboard/pointer opening and Retry are exercised.
- Four explicit 960×640 captures include horizontal fit; 1440×900 only exercises a later pointer destination. No full-size layout capture/geometry assertion or glyph inspection is implied.
- Final 404-plus-delete case establishes eventual authoritative empty; it does not by itself prove successful-snapshot tombstoning or 40-window backfill after deletion.
- Preview check establishes fixture visibility and no mutation during that visit; no exact preview screenshot fidelity claim.
- Baseline old-build failures at missing rows/copy cannot execute every later race assertion. Initial source review asserted no execution result; completed receipt readback follows.

## Completed receipt / approved collector correction
- Read `/tmp/opencode/work-activity/targeted.log` and `targeted.json`: seven cases, five passed, two failed; both lifecycle failures at first `:109` snapshot comparison, 15-second assertion timeout, identical title/outcome/time with newline-versus-concatenated text only.
- This confirms finding 1 as a collector reader mismatch, not evidence of lost prior outcome or an application regression. Later reload/replacement/SIGKILL assertions had not yet executed in those failed cases.
- Current source SHA-256: `5740841a75bda4c688f5407122b870bda049698c1b5e80c6746ce55b82ba4af0`; both `toHaveText(prior)` calls and `toHaveText(finishedText)` now specify `{useInnerText:true}`. **Approved:** exact saved-string equality remains; no regex/contains substitution, application change or rebuild required for this correction.
- Receipt passes include locale matrix, 40-root selection, source Retry, neutral attribution and the bounded stale/cancelled case. Passing that case does not close findings 2–3's stronger retirement/component-identity proof gaps.
- All findings are consolidated above. No further test bug identified; no rerun performed, corrected lifecycle pass not claimed. Keep original baseline/initial-target receipts separate from later corrected-source execution.
