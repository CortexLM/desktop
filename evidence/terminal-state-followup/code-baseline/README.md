# Code persisted-failure badge — retained Electron negative baseline

**Two intended failed cases, light/dark; four badge assertions total.** Both cases
continue through a successful UI follow-up and pass every recovery assertion. No
setup failures, retries, skipped or flaky cases. Started **2026-10-03 09:28:08.469 UTC**;
runner7.893s, harness8.838s, exit1.

## Exact sources and historical runtime

Application **`760c4a046ce454bc8b0ab2fd85c941fec321c3ea`**; documentary HEAD
`72d2926b284760d96462cc931777761eedf9e3c1`. The new regression was uncommitted at execution.

- [Exact 368-line test](source/code-models.spec.ts), SHA-256
  `ff1bc7e7e6d08f59d713f0c7fccfb79fa35c02b682a870b804988145ae107ff5`.
- [Original 255-line test](source/code-models.before.ts), SHA-256
  `f3b578195e1b79a4d8436cf7738a62bab1d2d9f47cfb05dc63bae31ceaa428b1`.
  Its entire16,474-byte prefix remains identical in the new file;113 lines were
  appended. The [clean-start receipt](source/before.json) and Git blobs in
  [provenance](provenance.json) bind the prefix to both revisions above.
- [Baseline Code screen](source/code.760c4a0.tsx), retrieved from Git760c4a0 and
  matched against the recorded source: SHA-256
  `65f25c7b534b9a8f8d032a6f67f9a794054c18a997a15de499f88ede8d8ccb89`.
  Documentary72d2926 contains identical bytes.
- [Existing build manifest](../../live-state-followup/integrated/build-final.json)
  has the same90 members as the historical freeze. The exact before/after
  [integrity receipt](raw/integrity.json.gz) matched all90 current-at-run and frozen
  members, without missing/unlisted files; identical receipt bytes are retained once.
- [Renderer input receipt](../../live-state-followup/integrated/renderer-inputs.json)
  matches the historical copy byte-for-byte:473 inputs, fingerprint
  `39a06106e8d3545e1131ed64dddf5c60013581ffb2f1465f5c67399892669609`.

These are historical negative-run checks, not validation of the coordinator's later
corrected build. Current app source/dist was not read or rebuilt during retention.

## What actually failed

The existing `startFakeProvider({ rejectFirst: true })` returns **HTTP400**. Core
persists **`provider_error`**, not `provider_auth_failed`. The earlier
[discovery](../discovery/README.md) used a separate controlled401; this baseline makes
no401/auth-failure claim.

The real Code home Composer creates a session after the test-selected native directory
dialog returns a real temporary project folder. The actual provider key is set through
the write-only IPC route; the selected catalog model is **Reasoner Large**. The engine
admits and persists the request before the provider rejects it. Its assistant is marked
completed with `provider_error`, then real SSE emits busy/error/idle.

| Theme | Initial settled badge, line327 | Reloaded badge, line335 |
| --- | --- | --- |
| Light | Expected Failed/`badge err`; actual Ready/`badge ok` | Same wrong Ready/ok with unchanged persisted failure |
| Dark | Same | Same |

The current error banner says **“The task stopped”** in all failed views. No running
Stop button remains. Each combined text/class assertion is soft only so the recovery
step executes; each error still fails the case. There is no expected-failure annotation.

## Successful recovery and real SSE evidence

Both cases then submit a follow-up through the same session's Composer:

- **Running/`badge run`** appears with Stop while the existing provider streams.
- The current error banner disappears; after successful completion, **Ready/`badge ok`**
  returns, Stop disappears and the draft clears.
- Exactly two provider requests use the selected model and fixture key. Four persisted
  messages share the original session ID; the first failed user/assistant pair remains
  exactly equal after success. The new last assistant is completed without an error.
- Each theme records39 actual engine events, including13 reasoning/text deltas belonging
  to the successful assistant. The actual status sequence is
  **busy, error, idle, busy, idle**.

The main observer forwards the existing SSE chunks unchanged; it neither replaces
events nor creates a second subscription. No synthetic history or arbitrary sleeps.
The existing fixture supplies the stream delays.

[Compact light trace](traces/light.json) and [dark trace](traces/dark.json) preserve exact
parsed inline attachments: both full histories, all events, initial/reloaded/running/
recovered badge values, requests and empty error arrays. [Case summaries](cases.jsonl)
record all four failures and passed recovery checks. [Run summary](summary.json) records
zero page/console errors and zero renderer HTTP requests.

## Raw results and source checks

- [Command](run-command.json), [receipt](receipt.json).
- Original [Playwright report](raw/results.json.gz) and [runner log](raw/run.log.gz)
  round-trip byte-for-byte through gzip. The identical before/after integrity receipt
  is stored once. [Retention hashes](raw/retention.json) bind all five gzip round-trips,
  including the two error contexts.
- Original Playwright trace archives retained unchanged:
  [light](traces/light.zip), [dark](traces/dark.zip),246,886 bytes combined.
- [Scoped checks](checks/checks.json): ESLint, strict TypeScript and whitespace pass.
  Only the two new title-matched cases ran. The five existing cases' source prefix is
  unchanged; their execution is not claimed here.

Node22.23.3, `NODE_ENV=test`, `CORTEX_RENDERER_URL` unset; actual Electron loads
`cortex://app` and uses the real bridge/session/storage. Cleanup closed each Electron
process, removed only its launch-owned temporary data directory, then closed its provider.
Only recorded fixture-placeholder Bearer values are retained; runtime credential files
and temporary profiles are excluded.

## Full-size image review

All four canonical images are **960×640 lossless WebP**, individually opened and
reviewed at full size. Decoded RGBA equals the original PNG byte-for-byte: no resizing,
masking, color adjustment or tolerance.

| Theme | Failed after reload | Recovered | Full-size observation |
| --- | --- | --- | --- |
| Light | [image](images/light-failed-reload.webp) | [image](images/light-recovered.webp) | Green Ready contradicts the stopped banner; recovery keeps Ready with the answer and clears the banner |
| Dark | [image](images/dark-failed-reload.webp) | [image](images/dark-recovered.webp) | Same contradiction and recovery |

[Image hashes](images.jsonl) record every original path, PNG/WebP hash and identical
RGBA hash. Original PNGs:214,482 bytes; full-size WebPs:110,772 bytes.
[Attachment references](references.json) map duplicate PNGs and automatic failure shots
to canonical images and preserve raw paths/hashes. The inspected [contact sheet](contact.webp)
is a labeled half-size navigation derivative; its resampling/lossy encoding is explicit
in [metadata](contact.json).

Captures are **English Linux Electron content at960×640**, not OS-window chrome or
installed/native-Mac evidence.

`SHA256SUMS` covers this retained package. Retention performed no app/test edits,
tests, rebuilds, CI/Mac/network actions or commits. Later corrected-positive verification
remains coordinator-owned; this package preserves the original four failures and their
already-working recovery branch.
