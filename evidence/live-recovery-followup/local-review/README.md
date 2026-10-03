# Local recovery E2E — artifact review

**83/83 passed; zero retries, skips, flaky results or reported errors. All 92 unique attached PNGs reviewed.** The targeted recovery screenshots support the tested changes. This is scoped local Linux Electron evidence, not whole-product visual acceptance.

## Run identity and counts

| Item | Verified value |
| --- | --- |
| Report | `test-results/e2e.json` |
| Report SHA-256 | `fc23dbf296d83323dcddd3c58c0c67eb9a99390ca41d47c96f1035652a34114a` |
| Console log | `/tmp/opencode/live-recovery-e2e-final.log` |
| Log SHA-256 | `5e25f47db93b1f6f66af830265b426a75c5d8db364a8b1911ec7e3a119fa1ca6` |
| Started | `2026-10-03T01:52:53.310Z` |
| Duration | 244,844 ms (about 4m 05s), four workers |
| Cases/results | 83 cases, exactly one result each, all `passed`/expected |
| Retry | Every result `retry: 0`; project configured `retries: 0` |
| Negative results | 0 skipped, 0 unexpected, 0 flaky, 0 test errors, 0 report errors, 0 stderr items |
| Attachments | 100 total: 92 PNGs, eight JSON geometry records |
| Artifact PNG files | 184 physical files, exactly 92 distinct SHA-256 hashes; original/output-attachment duplicates all accounted for |

Base HEAD remains `6d965358bb5e02473df6be7e97ecfdb07650c0b8`; the run used the **uncommitted integrated recovery build**, not pristine HEAD. Per coordinator, its application source predates the final `team.tsx` removal of `forgotten.current.clear()`. Review-time source hashes are preserved separately and explicitly are not reconstructed full-run build hashes.

The later memory-return before/fixed run is separate coordinator-owned evidence. Those pending outputs were not read, copied or merged. This 83-case result does not prove that later source delta. The supplied 188-pass Node 22 unit result is also separate, not recounted here.

## Render sweep: exactly what passed

The `screens.spec.ts` result has `status: passed`, zero errors, zero retries, and stdout `rendered 426 screen states`. The log independently contains that line followed by the passing screen test and `83 passed`.

The inspected test visits every registered screen/variant in both themes. It checks theme/content readiness, nonblank rendered text, untranslated catalog keys in visible/accessibility/tooltip text, and accumulated renderer `pageerror` events. Its final empty failure array passed. This is **426 successful renders**, not 426 uploaded screenshots or pixel comparisons. The sweep does not subscribe to every browser console warning/error, so “all console output globally clean” would exceed its assertions.

## Image inspection

All 92 unique uploaded PNGs (IDs 001–092 in `png-inventory.json`) were inspected across eight contact sheets. Every on-disk artifact PNG matches an attached-image hash; no orphan images were omitted.

Full-resolution originals inspected: **32**. This includes all 14 new memory screenshots, both approvals, all six model/provider screenshots, the terminal screenshot, plus nine frames flagged for closer inspection from the contacts.

### Targeted recovery views

| IDs | Observation |
| --- | --- |
| 001–002 approvals, 960 light/dark | Load failure is explicit; Try again is visible, readable and unobscured. No false “Nothing to approve” content. |
| 047–048, 054–055 memory owner/read pending | Add/delete controls disabled; no previous-owner memory row; no “Empty memory” claim while initial owner/list reads are pending. |
| 049, 056 accepted deletion while refresh pending | Deleted row absent, zero count, Forget everything disabled; success toast matches an accepted deletion. |
| 050, 057 refused Add | Exact draft remains in the editable field alongside “Couldn’t save. Try again.”; no disappearing-input failure. |
| 051–053, 058–060 refused/partial/single delete | Surviving entry stays visible with “Couldn’t forget this memory”; no false full-wipe success. Toasts remain above the bottom window edge and do not cover mutation controls. |
| 070–075 model/provider, 960/1024/1440 light/dark | Model name, context/cost and all three capability badges readable. Narrow layouts wrap badges below metadata; wide layouts remain inline. Saved last-four hint readable, key input blank. Lower settings content is inside the intended vertical scroll pane. |
| 069 French Code terminal | App-owned exit and truncation notices are French. User-output lookalikes `[exit code 7]` and `… [truncated 9 characters]` remain English/verbatim. Long output stays in the terminal's horizontal scroll area; localized suffix remains visible. |

### Contact-sheet anomalies checked at full resolution

- **016/021:** stacked Code error toasts obscure the older toast's title. Frontmost “Message not sent” remains fully readable; composer stays exposed. Static capture demonstrates stacked-notification presentation, not a new regression attributable to this recovery batch.
- **026/029:** preview Code toast covers part of the right-pane empty-state description. Current toast, composer and primary navigation remain readable. Retained as a presentation limit; no claim that every background line stays visible behind transient notifications.
- **077/080:** image-refusal toast overlays transcript text but stays above the actual composer. Draft, selected model and submit controls remain visible; this matches the scoped toast-position assertions.
- **083/088/092:** long routine name is clipped within its single-line editable field; instructions and assigned-Bot controls remain usable within the scroll pane. Failed assigned-Bot loading shows visible Try again; creation disabled. No form-wide overflow or missing control observed.
- **Memory at 960:** the destructive-action explanatory subtitle is ellipsized; the label/button is readable. Initial loading headers temporarily omit the Bot name. These captures establish mutation gating and content ownership, not complete small-window copy/layout approval.

No new blocking visual defect established by these artifacts. Low-level presentation limits above remain visible; this review does not silently promote the full UI to accepted.

## Non-image attachments

Eight original JSON records were decoded into `json-attachments/` without altering values:

- Cold fonts, both themes: scroll `409 → 392`, content height `1068 → 1051`, bottom gap remains `0`.
- Warm fonts: geometry unchanged, gap `0`.
- User wheel: scroll remains `229` across font completion while content height changes; viewport is not forced back to bottom.
- Variant change: new-state bottom gap remains `0` after font completion.

These complement the two passing Work-scroll tests; no additional screenshot or historical comparison claim is inferred.

## Retained deliverable

Directory: `/tmp/opencode/recovery-local-e2e-review/`

- Exact copied `e2e.json`, `e2e-final.log`.
- `summary.json`, `test-outcomes.json`: counts, statuses, retry/error data and source-scope qualification.
- `png-inventory.json`, `artifact-png-files.json`: all unique hashes, dimensions, sizes, test/attachment provenance and duplicate paths.
- `contacts/sheet-01.jpg` through `sheet-08.jpg`: all 92 images, labeled by inventory ID.
- `inspection-ledger.json`: per-image contact/full-size inspection coverage.
- `selected/`: 32 byte-identical original PNGs, including all targeted new views; no lossless RGBA re-encoding or credential redaction.
- `selected-originals.json`: retained-original hashes and sizes.
- `attachments.json`, `json-attachments/`: attachment metadata and eight decoded Work-scroll records.
- `review-time-source-pins.json`: current source-file hashes with the run-pin limitation above.
- `inventory.py`: deterministic inventory/contact creation script.

Retained originals: **2,013,117 bytes**. Originals plus contact sheets: **3,805,547 bytes**. Entire directory before this report: approximately **4.29 MB**. Provider screenshots contain only the test last-four hint `WXYZ`; no private key was exposed or redacted.

No test rerun, build, source edit, distribution change, Mac action or CI operation performed for this review.
