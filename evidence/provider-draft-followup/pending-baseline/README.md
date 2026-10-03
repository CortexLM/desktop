# Pending provider-key responses — retained negative baseline

**Two failed cases, four intended draft-loss assertions**, light/dark; final run has zero
setup failures, retries, skips or flaky cases. Started2026-10-03 10:49:53.287UTC;
Playwright6.938s, harness7.891s, exit1. No corrected-positive result is claimed here.

## Historical source and build

Application `2956564fbe31f882014d74ff3a7f920e839fd634`; documentary HEAD
`10a57be97ee9e9f9ea0c761784279ec8744b70d3`. English960×640 Linux Electron content,
Node22.23.3/Xvfb, `cortex://app`, `NODE_ENV=test`, `CORTEX_RENDERER_URL` unset.
- [Exact144-line test](source/provider-key-pending.spec.ts), SHA-256
  `bcafa61de982af883954f648123c06370021b0dab8c8aca5003a2ec06d3d7477`.
- [Original Settings source](source/settings.2956564.tsx), matching Git2956564 and10a57be:
  `54e9b65e6f37710d6235e64f720e75f0ed03ec647cd1f0dd1bda63aca544285d`.
- [Historical integrity](raw/integrity.json.gz) retains identical before/after bytes once:
  all90 dist members matched current-at-run and frozen copies, no missing/unlisted files.
  All473 renderer inputs matched fingerprint
  `e288e023805e998f276b224f10f63a5b448082d7a31174020b943f70815c028e`.
- [Build members](../../terminal-state-followup/integrated/members.json) and
  [renderer inputs](../../terminal-state-followup/integrated/renderer-inputs.json) have
  matching member/file arrays; wrapper metadata differs. [Provenance](provenance.json)
  pins relative references, Git blobs and original sources. Current corrected dist was
  neither inspected nor rebuilt during retention.

## Real operation, delayed receipt

The test wraps main's existing `cortex:fetch`, calls its original handler, then holds
one completed PUT/DELETE200 response **after the actual credential-store operation**.
Independent GETs remain live. Status, headers and body string are returned unchanged;
this is response timing, not a stub. The renderer input stays password-typed and enabled
while Save/Remove are disabled. The wrapper is restored during isolated-app cleanup.

| Phase per theme | Actual store before release | Assertion after release |
| --- | --- | --- |
| SaveA normally | hint1111 | Unchanged accepted input clears |
| SaveB, holdPUT200, enterC | hint2222; UI still1111 | **Line84:** C expected; empty actual |
| Remove, holdDELETE200, enterD | `hasKey:false`; UI still2222 | **Line101:** D expected; empty actual |
| Explicit SaveD | hint4444 | Unchanged input clears |
|4097-character dummy PUT|400 `invalid_request`; hint4444 unchanged| Entire rejected draft retained |
| Ordinary Remove with unchanged short draft | DELETE200, no stored key | Input clears; Save disabled, Remove absent |

Exactly **six write requests per theme: five accepted mutations, one validation refusal**.
Recovery refills occur only after the soft failures are recorded; they do not erase failures.
The4097 check exercises the existing4096 maximum, not a mocked storage error.
Public GET/list and successful response shapes contain only metadata/last-four hints.

[Light observations](observations/light.json) and [dark observations](observations/dark.json)
exactly match parsed inline attachments: original response bodies, stored metadata,
editable-input/undelivered-response evidence, draft lengths and control outcomes.
No submitted key bodies or credential profiles are copied. Only obvious fixture values
appear in test source and expected-failure diagnostics. [Cases](cases.jsonl) retain all
four assertions; [summary](summary.json) records zero page/console errors and renderer HTTP.

## Raw receipts and separate setup failure

[Command](run-command.json), [receipt](receipt.json), original [report](raw/results.json.gz)
and [log](raw/run.log.gz). [Retention index](raw/retention.json) verifies seven exact gzip
round-trips. [Recorded checks](checks/checks.json): lint/types pass; whitespace has no
diagnostics (`git diff --no-index` exit1 denotes addition). Checks were not rerun here.

The [initial source](setup/provider-key-pending.spec.ts) armed the gate with Electron's
module argument instead of the requested method. Both cases stopped at the held-response
precondition; TS2322 identified the same mismatch. [Setup summary](setup/summary.json),
[command](setup/run-command.json), [report](setup/results.json.gz), [log](setup/run.log.gz),
[TypeScript output](setup/types.log.gz), [checks](setup/checks.json.gz) remain unmodified
on decompression. These two setup failures are excluded from the final product counts.

## Images

Four full-size960×640 lossless WebPs were individually inspected; decoded RGBA equals
original PNG bytes exactly, without resizing/cropping/tolerance. They show empty newer
drafts with the correct stored hint or no-key state in both themes.
| Theme | After PUT | After DELETE |
| --- | --- | --- |
| Light | [image](images/light-after-put-release.webp) | [image](images/light-after-delete-release.webp) |
| Dark | [image](images/dark-after-put-release.webp) | [image](images/dark-after-delete-release.webp) |
[Image index](images.jsonl) preserves PNG/WebP/RGBA hashes. [References](references.json)
map attachment paths; auxiliary trace/error-context/cleanup images remain at original
temporary paths. The inspected [contact sheet](contact.webp) is a half-size navigation
derivative; [metadata](contact.json) declares resampling/lossy encoding. These are Electron
content captures, not installed-Mac or OS-window evidence.

`SHA256SUMS` covers this package. Only retention files were written; no app/test edits,
tests, build, CI/Mac/network actions or commits. Positive verification remains coordinator-owned.
