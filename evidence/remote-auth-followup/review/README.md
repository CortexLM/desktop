# Auth runtime evidence review

**Bounded approval. No new auth blocker found.** Existing artifacts reviewed; no tests,
build, CI or native launch rerun. Source untouched. This review predates the preview-departure
and terminal-overflow corrections.

## Verified counts

| Evidence | Verified result |
| --- | --- |
| Copied `e2e-full.json` | **90 passed**, 90 results, retry 0 throughout; no skips, flaky cases, unexpected results or report/result errors |
| Registry sweep | **426 theme/state renders**; asserts correct theme, nonempty content, no raw translation keys and no accumulated page errors |
| Auth within full suite | **6 cases**: two themed action cases, two themed continuation/restart cases, origin isolation, initial-read races |
| Integrated `units.log` | **201 passed + 1 optional real-backend skip**, 202 total across 18 files |
| Full-suite attachments | **104 PNG references, 102 distinct PNG hashes; 10 inline JSON attachments**; none missing |
| Auth captures | **12 references, 10 distinct images per pass**; MFA/email-verification states share pixels within each theme |

The first five-case run has nine captures; the separate held-read run adds three. All twelve
earlier captures were inspected at full resolution. The full run has two additional distinct
image versions, also inspected; twelve distinct hashes across the earlier/full-run evidence.
Only those two versions are copied into [`auth/`](auth/); matching originals remain referenced
in [`auth-images.json`](auth-images.json), avoiding another screenshot collection.

## What the checks establish

`remote-auth.spec.ts` launches built Electron and uses its real renderer, IPC, core and
main-owned SDK against controlled loopback HTTP. Verification barriers hold actual backend
responses. The sixth case wraps the existing IPC handler solely to delay completed GET
responses; it calls the original handler and returns its response unchanged. It does not
replace authentication or manufacture engine state.

Assertions cover refusal retention, explicit code submit, duplicate prevention, sanitized
continuations, accepted sign-in, renderer reload, device-local logout, process restart,
origin/mode cancellation and stale initial reads. Known fixture secrets are rejected from
IPC/DOM/browser storage/cookies and inspected engine files. Renderer HTTP requests remain
empty; fresh identities send no previous cookie/bearer. This is controlled-backend proof,
not deployed Cloud authentication or remote inference.

Visual readback: errors, signed-in copy and unavailable-continuation actions remain readable
at 960×640 in both themes; the 1440×900 light signed-in view is readable. Narrow Settings
subtitle ellipsizes; the focused long URL scrolls horizontally. The post-cancel Login image
is vertically scrolled, clipping the top brand mark while email and Cancel remain visible.
That limitation is retained, not presented as complete visual approval.

## Counts and claims requiring qualification

- **Zero report/test errors is not zero runtime errors throughout all 90 cases.** The native
  transition regression intentionally asserts three callback errors; its ordinary skipped-
  transition phase has none. Registry/auth zero-error assertions are positive and scoped.
- **426 renders is not 426 screenshot reviews** or a pixel-fidelity assertion. The sweep
  has no screenshots; it reports its actual loop count and asserts more than 300 renders.
- `read-races/report.json` retains an earlier **zero-test selector failure**. The successful
  one-case result is `read-races/result.json`. It is not a retried failing Electron case.
- First-run five-case wording describes that historical run. The full report contains six
  auth cases, already included in its total of 90.
- [`evidence/mac/b0e6d78`](../../mac/b0e6d78/README.md) retains preview-departure and terminal-
  viewport failures in an installed package without this auth delta. They remain negative
  whole-UI evidence; they do not negate the bounded auth assertions here.

## Build/source binding

Base HEAD: `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874`; auth changes uncommitted at observation.
All **90 built members** observed at **03:26:08 UTC** match the pre-held-read pins at
**03:08:56 UTC**, preceding the full run (**03:13:02–03:17:09 UTC**). The auth test and two
renderer auth sources also match those earlier pins: **93/93 comparisons**.

- Main bundle: `f57525a0d275ec1a624961962cf8d9ce9edd270322a803c826e187cf0a1074b2`.
- Renderer JS: `index-Cyo3CwAR.js`, `9a7cd3f912d69cb36bedfba399ea6cd2757a45f89b9a623c2c6c35231cb851b4`.
- Renderer CSS: `index-Bo4UCD38.css`, `66b5535728e44c658157393b4350e21624c56597d27ed3a5887aaf6b50a2fca5`.
- Content-only member-manifest hash: `3087be9698b06fb85ba30ced494ac00ab080818bdc61d0e6d6cbb05124d275f3`.

[`build-fingerprint.json`](build-fingerprint.json) records complete member hashes and targeted
working-tree source hashes. [`build-binding.json`](build-binding.json) compares earlier pins.
The main sourcemap independently matches **30/30 physical workspace source files**, including
auth/core/schema/main; its one virtual define source is identified separately. Renderer
source observations are not a reconstructed pristine build. Coordinator can reconcile auth
hashes with its eventual commit; later preview/terminal source edits need their own build
and verification evidence.

Machine-readable result: [`report.json`](report.json). Detailed counts, attachment provenance,
unit arithmetic and runtime-error qualification accompany it. No current-CI, native-auth or
whole-product approval is implied.
