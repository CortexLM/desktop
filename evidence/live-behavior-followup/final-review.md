# Final live-behavior review

**PASS — scoped. No critical blocker found.**

Scope: final Code attachment anchor, Code/routine regressions, retained evidence and claims.
Started at `0257395d1a15d12a08de307ca75b132096dc973c` plus the batch; coordinator committed
`d635fcf34f83db7849a1ee59ab3d790b20f74c9f` during review. Final renderer fingerprint still matches.

## Source and regressions
- `packages/app/src/kit/styles.css:276` anchors the complete `.chat-box`; excludes its nested
  `.composer`, preserving the direct-composer preview fallback. Existing dock positioning remains valid.
- `tests/e2e/code-models.spec.ts:148–230` verifies real IPC 422 `model_no_image_input`, exact retained
  draft/file, unchanged messages/model, zero provider calls, visible-toast geometry, center hit tests,
  trial clicks, then one accepted image request and persisted/reopened recovery in both themes.
- Existing new Code cases verify keyless endpoints, chosen creation/follow-up models, reasoning=false
  payload, folder cancellation/pending lock, persisted selection and unavailable/unsupported refusal.
- `tests/e2e/routines.spec.ts:30–42` adds resolved text, opacity 1 and hit-testable control guards;
  no sleep or relaxed assertion. Running/Failed/latest-eight and refused-action assertions remain intact.
- File-backed scheduler reopen test and retained core review support recovery, duplicate admission,
  interruption and deletion claims; review correctly discloses that it predates the file-reopen assertion.
- Withdrawn implicit-fallback P2 stays withdrawn: provider mutations publish no refresh event;
  event schema has no `provider.*`. Both original review reports match their retained bytes.

## Evidence verification
- All 24 `retained-files.json` retained hashes verified; corresponding original hashes located/matched.
- E2E JSON agrees with logs: initial 59 expected/426 renders; final targeted 17 expected;
  zero unexpected/flaky/skipped cases, retries all zero. Final 61-case full suite remains pending CI.
- Units log: 178 pass, one optional backend skip. Types/lint logs clean; i18n 63 files,
  2,266 used keys / 3,395 English keys / zero findings. Both builds and Linux smoke logs agree.
- Packaged archive matches current built renderer/main/preload: 88 files checked byte-for-byte.
- Final comparison report/comparator hashes, all 30 image hashes/sizes, five frozen metadata hashes,
  ten frozen reference images/records and 20 served-asset hashes verified; no mismatch.
- Current source: `822f33bc4fa69476a08baf00509f5ae2b1208a441bcab4eefbaac3d26471c4ed` / 473 files.
  Initial comparison fingerprint reconstructs by restoring only the pre-anchor stylesheet.
- Frozen source: `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768` / 106 files.
- Recomputed ten retained PNG comparisons at threshold 0.15: max 0.05%, zero missing references.
  Four Code results round to 0.00%; each still has 198–228 differing pixels, not byte/pixel identity.

## Image inspection and claim limits
- Inspected all ten final live PNGs at 960×640, all ten final comparison app PNGs, original blank dark row.
  Final attachment Remove/model/input/send controls clear of toast; routine rows readable in both themes.
- Eight initial / ten final live captures match their E2E attachments byte-for-byte.
- Probe JSON confirms 12 reloads, opacity 0 in five of six legacy samples, content in all 24 images.
  Exact initial blank remains unreproduced; no persistent defect or remount cause established.
- `evidence/live-behavior-followup/README.md` and `evidence/STATUS.md` accurately distinguish initial
  full run, final targeted checks, frozen preview scope and pending CI/installed-Mac acceptance.
  Retained negative runs, withdrawn finding and historical reference gaps remain explicit.
- Full objective remains incomplete: remote authentication/inference, missing surfaces, native/full-reference acceptance.

Read-only review; only this report written. No tests/builds rerun; no CI/Mac/SDK/design-owner actions.
