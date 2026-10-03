# Live Chat history races — retained negative baseline

**Four intended failures, light/dark: a late initial snapshot replaces a completed
new turn; a late snapshot restores deleted history.** Executed before the hook fix,
against application `f5bf305473db12fddfddcda890a01794f02f578f`.

Readable `initial/lint.log` trims trailing blank lines; `initial/lint.log.original.gz`
and `initial/lint-retention.json` preserve the original diagnostic bytes/hash.

Run started **2026-10-03 07:22:09.586 UTC**. Four case durations total **42.649s**;
runner duration **45.228s**. Exit 1; zero retries, skipped or flaky cases, setup
failures, captured page/console errors or renderer HTTP requests. Playwright reports
four `unexpected` failures: the regression has no expected-failure annotation.

## Receipt and exact sources

- [Run command](run-command.json), [summary](summary.json), [case assertions](cases.jsonl).
- [Original Playwright JSON, gzip](raw/results.json.gz) and [original log, gzip](raw/run.log.gz)
  decompress byte-for-byte to their supplied originals. [Retention hashes](raw/retention.json)
  record original paths, byte counts, SHA-256 values and verified round-trips.
- [Exact baseline hook](source/live.f5bf305.ts), retrieved from Git at `f5bf305`:
  SHA-256 `4c4ec7ae725dfd250f5102c273deeed827c22a3e70568eaa145435a2970119c7`,
  Git blob `1dbb29d2b97224f84be542553da17c2b809c4cc4`.
- [Exact test used](source/live-state.spec.ts): SHA-256
  `842804966f6cd584834c728c92c495ccc52ece47bce2dcd128df912f98c83710`.
  This test was newly uncommitted at the run's documentary HEAD `1076c25`; it is
  not represented as a test committed at application `f5bf305`.
- [Historical integrity receipt](raw/integrity.json.gz) preserves the identical
  before/after manifests once: all **90** app/main/preload members matched their
  frozen files and receipt, with no missing/unlisted members. This is the original
  run's verification, not a check of the subsequently rebuilt dist.
- [Provenance](provenance.json) pins the historical hook and existing helpers:
  [launch fixture](https://github.com/CortexLM/desktop/blob/f5bf305473db12fddfddcda890a01794f02f578f/tests/e2e/fixtures.ts),
  [HTTP provider fixture](https://github.com/CortexLM/desktop/blob/f5bf305473db12fddfddcda890a01794f02f578f/tests/e2e/fake-provider.ts),
  [catalog](https://github.com/CortexLM/desktop/blob/f5bf305473db12fddfddcda890a01794f02f578f/packages/core/test/fixtures/catalog.json),
  [original hook](https://github.com/CortexLM/desktop/blob/f5bf305473db12fddfddcda890a01794f02f578f/packages/app/src/state/live.ts).
  The working-tree [hook](../../../packages/app/src/state/live.ts) and
  [test](../../../tests/e2e/live-state.spec.ts) are later integration surfaces;
  the retained snapshots above define this negative receipt.

## What actually failed

The real engine first stores an older user/assistant pair through the controlled
HTTP provider. Main invokes the original `cortex:fetch` handler and holds exactly
one completed 200 response for the initial messages GET. Other IPC and genuine SSE
remain active. The held body is never manufactured or edited.

| Case | Before release | Failure after release |
| --- | --- | --- |
| Stream, light/dark | New exact user text and completed answer visible; four persisted messages; old two-message read held | Test line 146 expects `[OLDER, NEWER]`, receives only `[OLDER]` through the assertion window |
| Delete, light/dark | Real `session.deleted` observed; session absent from engine list; empty transcript | Test line 150, `Deleted history must never reappear`: old user text and answer return |

Each case retains its complete captured SSE events, DOM observations, held history
and error arrays: [stream light](traces/stream-light.json),
[stream dark](traces/stream-dark.json), [delete light](traces/delete-light.json),
[delete dark](traces/delete-dark.json). These are compact decoded extracts of the
original JSON attachments; original attachment bytes remain in the raw report.

The DOM observer's `before-release` phase remains active until the explicit
`after-release` sample. Intermediate rows with that phase include the released
response's DOM mutation; they do not mean overwrite preceded release. Before
release, the test separately asserts that the held response has not returned.
Real IPC completion, a microtask and two animation frames delimit observation;
there is no arbitrary sleep or state/SSE injection.

## Full-size images and review

All **eight** originals were read, converted to full-size **960×640 lossless WebP**,
then compared byte-for-byte after decoding both formats to RGBA. All eight retained
images were inspected full-size. No resizing, tolerance, masking or color adjustment
was used for these canonical images.

| Case | Before release | After release | Full-size observation |
| --- | --- | --- | --- |
| Stream light | [image](images/stream-light-before.webp) | [image](images/stream-light-after.webp) | New turn replaced by the older turn |
| Delete light | [image](images/delete-light-before.webp) | [image](images/delete-light-after.webp) | Empty transcript repopulated despite empty session list |
| Stream dark | [image](images/stream-dark-before.webp) | [image](images/stream-dark-after.webp) | Same new-turn loss |
| Delete dark | [image](images/delete-dark-before.webp) | [image](images/delete-dark-after.webp) | Same deleted-history revival |

[Image manifest](images.jsonl) records every original PNG hash, retained WebP hash,
dimensions and matching decoded RGBA hashes. The eight originals total 408,775
bytes; canonical lossless WebPs total 200,688 bytes. Failure and automatic screenshot
attachments are PNG-byte-identical to each case's after-release original; their
references map to the same canonical image in [references.json](references.json).
That manifest also maps inline attachments and explicitly marks omitted auxiliary
Playwright traces/error-context files. Original raw report paths remain unchanged.

[Contact sheet](contact.webp) is a labeled half-size navigation derivative,
not pixel evidence; its resampling and lossy encoding are explicit in
[contact.json](contact.json).

## Initial attempt retained separately

The first attempt produced the **same four negative product assertions**, not
product-test setup failures. Its independent lint check rejected a diagnostic
`throw` inside `finally` (`no-unsafe-finally`). Retained:
[initial log, exact gzip](initial/run.log.gz), [source](initial/live-state.spec.ts),
[lint diagnostic](initial/lint.log), [command](initial/run-command.json),
[summary](initial/summary.json). The final source simplifies that catch and passes
the shared `NEWER` constant to the continuity check. Initial duplicate screenshots,
Playwright traces and full JSON were not copied.

`SHA256SUMS` covers this retained package. Retention only: no tests/builds, current
dist inspection, Mac/CI actions, production/test edits or commit. Positive fix
verification belongs to the coordinator's separate receipt; this package claims
only the historical negative reproduction.
