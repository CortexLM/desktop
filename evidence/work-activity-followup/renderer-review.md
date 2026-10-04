# Work Activity — independent renderer source review
**APPROVED, source only. No blocking finding in the four released renderer files.**
Reviewed HEAD `906987b94c04c3c4566ecb33394584ff0e93074e`; application baseline `96df66ce727c42ddf647b2dcb4eeeff04fda4927`.
Authority: latest delivery contract plus its outcome/identity corrections; author handoff hashes match actual source. `activity.tsx` has 145 lines, not the brief's 144.

## Selection, outcomes and source failures
- `activity.tsx:38–46` uses the supported `kind=bot` query, then excludes children/empty botID/tombstones, sorts updated timestamp plus stable ID and takes 40 before any Bot/outcome filter.
- `findLast` selects the last finite completed assistant in the API's ascending message-ID order. User/incomplete follow-ups retain the prior finished turn; process loss invents no completion.
- Lines55–60 classify no error as Completed, `aborted` as Interrupted, other errors as Failed. Final state retains only row identity/title/outcome/time plus Bot metadata; parts and raw error text never enter the view.
- Completion ordering has stable session/message tie-breakers; routine sessions qualify once without appending TaskRun records. Rename legitimately changes the recent-root selection.
- Lines28–39/47/51 increment generation before queued work, validate before history fan-out and publication, and coalesce same-stack refreshes. Older batches cannot replace newer results; rejected stale batches cannot publish errors.
- History 404 is distinct from no completed assistant. Lines48–54 re-list authoritatively; still-listed IDs or failed re-lists become Retry, never invented empty. Confirmed absence is tombstoned; normal deletion refresh reselects roots.
- Session/Bot/non-404 history failure rejects the batch; a non-404 failure is not held behind another pending history. Retry reloads all three real sources; previous ready rows persist only while a refresh is pending.
- Lines75–78 tombstone deletion immediately, remove visible matching rows before further reads and invalidate outstanding generations. Later list/history replies cannot resurrect the ID.
- Subscription precedes initial reads. Root create/update/deletion and terminal assistant updates refresh; token events do not. Bot CRUD has no event; metadata refresh remains remount/Retry as contracted.

## Ownership, attribution and controls
- `desk.tsx:233–238` splits live/preview using committed NavCtx parameters. Pending actual-preview navigation cannot switch the outgoing component to fixtures.
- `activity.tsx:64–85` synchronously invalidates its owner at actual preview/gallery departure without changing displayed state; canceled live re-entry creates a fresh owner/reloads even without a preview commit. Cleanup removes both subscriptions.
- Committed permission and actual-URL guards cover reads/callbacks; row navigation also checks actual mode. Native menu/history traversal uses the same Navigation event. Activity performs no engine writes.
- Exact botID options derive from the bounded rows plus current selection. Same-name options retain distinct IDs, stable-ID-ordered localized ordinals and their own `toConfig` mascots; filters never expand the root cap.
- Missing metadata after successful Bot-list resolution uses neutral Unavailable Bot, not presumed deletion. Failed Bot-list reads produce the feed error state rather than unavailable rows.
- `home.tsx:431–434` resolves the Work destination's exact Bot configuration. Missing owners use neutral unavailable identity; pending/failed metadata remains neutral unnamed. No first-Bot fallback remains in this target.
- Rows are native buttons inside list items, opening `work-task` with exact session ID. Decorative mascots are aria-hidden/noninteractive; text supplies name/title/outcome/time. Existing focus styling, Base UI menu and pressed filter states remain applicable.
- Local day keys include year; labels/time reuse locale hooks. Only All/Errors appear, interruptions belong to Errors, Clear filters remains local, export stays disabled and recent-40 copy remains explicit.
- Fifteen new CSS rules are live-only: wrap row/menu text, size locale time automatically, constrain picker/menu overflow. No new raw color or preview-selector change. Geometry/visual acceptance still requires execution.

## Evidence boundaries
- Retained baseline binds frozen behavior test `0166d765dd10a8c332da09563af8c2418ea995cfd2ee07bcdd19b7438a347851`: six failures, five missing-row/one missing-source-error state; downstream assertions were not reached.
- Current behavior test changed during review; the frozen baseline is not a corrected-run claim. Locale source pin `bfda7f43480e7f20e8101480950c28c5ea149b0f6f3bedf231d56c3ed7a5e087` remains separately reviewed; planned 112 targets/eight dark captures are not results.
- Author-reported lint/typecheck and five pre-existing detector warnings were not rerun. Corrected build/E2E, preview comparisons and native acceptance remain coordinator-owned; Memory evidence does not certify Activity.
- Only this report written. Source/evidence reads and hashes only; no product/test edits, delegation, test/build execution, detector rerun, network, CI query, Mac action or capture.

## SHA-256 — `packages/app/src/screens/work/`
- `activity.tsx`: `ac08eb0411325df215cce7bcb16dae8b47f562621fd7ea87b1b74d59dc09d904`
- `desk.tsx`: `0ca4769cfa95e122f61d1cf9f23093707c0265bc12d89a43aa83fa98c247d288`
- `home.tsx`: `b3d1f50d603e03bd3335f299c7f80f333a7d2dd66a34e625900baf9ec2a60079`
- `work.css`: `b030e5979a31fb9d5cebc2a38d6922766d34cf693c1ab5c2fafb9efa4f0be5c3`
