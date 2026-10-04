# CI 37105137365 — remote foundation, bounded artifact audit

**All three CI jobs pass; Linux locale visual acceptance does not.** Linux and
macOS each pass **97/97 Electron cases**, without retries. Full-size Linux
`ja`, `ko` and `zh-Hans` wrong-code captures show **missing-glyph boxes** despite
passing geometry assertions. The eight matching macOS locale captures display
their glyphs. Root cause was not established in this artifact-only review.

Run: <https://github.com/CortexLM/desktop/actions/runs/37105137365>, attempt 1,
2026-10-03. Application `f5bf305`; documentary head `1076c25`.

## Checkout, source and dependency binding

| Pin | Verified value |
| --- | --- |
| Run head | `1076c2584941cf054efffaf709a149b4195bc1c4` |
| Actual checkout in all three logs and both reports | `d74251813ecd9aa67e7125c32d138214e27778cf` |
| Checkout and head tree | `138c4e5c5104fc30f887d28c340d1f3a744cb74d` — equal |
| Application commit | `f5bf305473db12fddfddcda890a01794f02f578f` |
| Application tree | `cf877d57c2a8dc46d11965c68d7baed72e862a02` |
| Frozen main bundle SHA-256 | `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7` |
| Frozen main map SHA-256 | `831431b289084fa3efb3d4c8fea110356a25e64e7bd2b304fa05efd7b6decc02` |
| Committed `main.ts` SHA-256 | `d33d466e1a16b45ac124fb2c72b28a3ae632960e6575d0ebf4d90eb6f076396c` |
| 473-input renderer comparator fingerprint | `5361c34082a62dfb944d47fc27b11695d3f9826870bb928f74670ba778cc3d9b` |
| Same inputs, NUL-delimited manifest fingerprint | `fb6220f8df77bdee09241fb2084417d3e3cc4924c8a1a4fbfa19200e09e96acb` |

`1076c25` directly follows `f5bf305`: **21 documentary paths changed**, all in
docs/evidence. Their full trees differ; **all 514 frozen repository input hashes,
modes and blobs match**. The 473 renderer inputs reproduce both explicitly named
fingerprint formats. Against `7885736`, **172 app, 297 i18n and three client files
remain identical**; renderer input delta is schema index, two additive groups / 68
lines. Uncommitted working-tree tests or application changes were not audit inputs.

All **90 frozen local build members** match `/tmp/opencode/build-remote-final/`.
Its main map binds **eight changed runtime pins**, **32 workspace sources**,
**16 SDK modules** to committed bytes. Fourteen final source pins also match;
31 runtime/test/config source pins are recorded here. The map has 980 entries:
19 third-party `sourcesContent` values are null; one generated define is separate.

SDK **0.3.5** archive SHA-256
`5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8`;
API-types **0.2.0** `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`.
Tarball versions and computed SHA-512 integrity match the unchanged lock. Vendor
tarballs are supplementary to, not counted within, the 514-input manifest.
All three CI frozen-lock installs pass. Frozen main includes the private binding,
core service and SDK methods; **test artifacts contain neither main bundle nor ASAR**.
CI package-member equality therefore belongs to the coordinator's separate audit.

See [checkout-binding.json](checkout-binding.json), [source-pins.json](source-pins.json),
[provenance/binding-summary.json](provenance/binding-summary.json) and associated
per-input/build/source manifests. The fingerprints bind frozen application bytes
to documentary CI source, not an inspected installed package.

## Downloads and exact result counts

| Download | Artifact ID | Bytes | Files | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Linux tests | `11267328056` | 27,042,910 | 367 | `5eaad9162ecb13335c6a7d868a041ee5a2f370cdda9b3724f18dc2e474bfd2b0` |
| macOS tests | `11267821981` | 26,453,409 | 372 | `82f8a2e326a97a09710b5cfed6887a99bfd353511a28f1765ee1528cc62ec28d` |
| Run logs | — | 94,671 | 52 | `3f26cb5e3767910b282e6329668381c937194cfe5ffab7377956ff70a9610fee` |

Both artifact outer digests match the supplied API receipts and CI upload logs.
ZIP CRCs, unique names, safe paths and every extracted member hash pass. Log ZIP
digest is locally computed; no API digest was supplied for that archive.

| Check | Actual result |
| --- | --- |
| Lint / types | Successful steps, no lint/type diagnostics |
| Unit | **245 passed + 1 skipped**, 246 total, **22/22 files** |
| i18n | **65 files, 2,272 used keys, 3,405 English keys, 0 problems** |
| Linux Electron | **97 passed / 97 attempts**, four workers, 202.747s |
| macOS Electron | **97 passed / 97 attempts**, one worker, 562.182s |
| Both Electron reports | **0 retries, skips, flaky/unexpected results, runner errors**; `retries: 0` |
| Gallery case | **426 render visits per OS**; no 426-image inventory claim |
| Package / smoke | Unsigned arm64 package and process/window/renderer smoke pass; **native capture fails** |

Both reports have the same 97 case identities across 22 E2E files. The previous
96 remain; the only addition is the eight-locale sign-in case. Seven auth cases
run per OS. New unit files account for 44 passes: bus **2**, remote-sessions **18**,
remote-chat **21**, remote-core **3**. Existing main-auth tests pass **8/8**.
The optional skip remains `lists models from a real backend`, guarded by
`CORTEX_TEST_BACKEND_URL`. Node versions: checks **22.23.3**, Linux Electron
**22.22.0**, macOS **22.22.3**; Bun **1.4.2**, Electron **44.5.1**.

**Coverage boundary:** Linux checks exercise private remote models/raw image
upload/turn/replay/history/projection with the actual SDK and controlled native
HTTP. macOS runs no unit suite. Its auth E2E uses the changed `RemoteSession` and
creates the private binding on sign-in, but does not invoke private Chat delivery
through `core.remoteSessions`. Compiled inclusion and auth success are not macOS
private-core HTTP acceptance. No credentialed Cloud or remote public-UI inference
is established. SDK discarded-frame handling keeps projections limited; the new
service has no public route/renderer caller at this pin.

## Locale measurements versus visible glyphs

Per OS, the single locale case records **80 measurements**: eight locales × two
themes × wrong-code, signed-in, unavailable-enrollment, send-failed and unavailable
option. The first three are **48 primary state visits**, not 48 test cases.
All **384 text-row geometry flags**, **144 keyboard reachability records** and
recorded opacity checks pass. All seven new auth copy keys are exercised. Passing
final assertions require no page/console/fixture errors or renderer HTTP; no
standalone error arrays were attached.

It supplies **eight dark wrong-code captures per OS**. Full-size review finds:

- **Linux `ja`, `ko`, `zh-Hans`: visually fail.** Headings, sidebar labels, error
  copy and controls contain missing-glyph boxes. Decoded JSON still contains the
  intended Unicode text. A range fitting its box does not establish glyph support.
- **Linux other five locales, macOS all eight:** sampled glyphs and controls are
  visible; retained digits and focused Cancel are unobstructed. This does not
  certify translation accuracy or every uncaptured locale state.
- Against the final corrected local Linux receipt, geometry changes **920 scalar
  values**, confined to Japanese **392**, Korean **324**, Simplified Chinese **204**.
  Text and boolean flags do not change. Current macOS versus Linux changes **1,258
  values** across all locales; identical cross-OS geometry is not expected.

Failure images: [Japanese](images/e2e-linux/remote-locale-ja.webp),
[Korean](images/e2e-linux/remote-locale-ko.webp),
[Simplified Chinese](images/e2e-linux/remote-locale-zh-Hans.webp).
Font environment/fallback is not inventoried by these artifacts; no root cause or
fix is inferred. See [locale-summary.json](locale-summary.json),
[locale-geometry.json](locale-geometry.json), [locale-drift.json](locale-drift.json)
and [visual-findings.json](visual-findings.json).

## Image review and bounded drift

**248 unique PNGs, 22 contact sheets, 54 full-resolution originals inspected.**
Linux: **365 PNG copies / 123 unique / 26 full-size**. macOS: **367 / 125 / 28**.
There are no cross-OS identical PNG hashes. Duplicate unavailable continuations
explain two five-copy groups on Linux, one on macOS; macOS has a distinct light
verification image plus renderer smoke. Four approval PNGs per OS occur once as
report data and also inline in JSON. The locale case adds eight images per OS.

Full-size targets cover all **37 unique auth images** (18 Linux, 19 macOS), including
all **16 locale captures**, plus **four narrow approvals, four keyboard/glyph
samples, two provider rows, two diffs, two terminals, two Work tasks and one smoke**.
All **54 lossless WebPs preserve dimensions and decoded RGBA exactly**.

Against the final corrected local Linux 18-image auth set: **13 identical**, five
differences. The three missing-glyph frames change **27,641 / 24,113 / 15,184 pixels**
(ja/ko/zh-Hans); canonical-origin input styling changes **83**; light signed-in
secondary-button fill changes **15,329**. Same-OS prior CI comparison covers
23 targets: **16 identical**, seven differences. Five macOS auth frames differ by
29/37 sidebar pixels, light unavailable differs by 15,375 button pixels; Linux
signed-in has the same button difference above. Causes remain unisolated.

Narrow approval descriptions remain clear of controls; actual diff tails and
French terminal omission suffixes are visible. Provider labels, selected keyboard
focus and sampled Work task render correctly. Contact sheets retain stacked Code
toasts and preview-toast/transcript overlap. Email-step decorative logo clipping
and horizontally scrolled canonical-origin input remain visible, not erased.
No aggregate score or green assertion substitutes for the Linux glyph failure.

Refreshed assertions also retain 16 approval-row geometry records, 12 bounded
terminal-tail records, 24 diff-header records, preview departure with `errors: []`,
Work cold/warm final `top=392, height=1051, viewport=659, gap=0`; wheel-preserved
gaps remain 163px Linux / 162px macOS. Terminal uses `scrollTop`; diff tests use
real wheel input. Work/preview departure have measurements, not dedicated success
screenshots. The deliberate native-transition test's two route and one theme
callback errors per OS are expected injected failures, not unexplained errors.

## Native negative, cancellation and retention

Smoke records `window: Cortex cortex://app/index.html`, empty Chat / `No model`,
then `SMOKE OK`. It also records **`could not create image from display`** and
**`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`**.
The script catches this; no native display PNG exists. The CDP renderer capture
does not prove native chrome, menus or installed interaction.

Only uploaded `.ips`: historical **simulated Setup Assistant**, 2026-03-16,
`EXC_GUARD` / `WEBKIT`, SHA-256
`384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`.
No Cortex diagnostic appears; the tolerant copy step is not a crash-free guarantee.

Coordinator-owned application artifact **11267761992**, 144,676,617 bytes,
API/upload SHA-256 `d3d05506cd42d69a5fa5214372cf4d55a700bfe6488a8a7b14001360e282f3f5`,
was not downloaded. Installed/ASAR/native proof remains separate.

Cancelled **37105080871** at `f5bf305` remains preserved as an incomplete run.
The 07:07:51 metadata observation records `cancelled`; same-ref push cancellation
is coordinator-reported and consistent with workflow concurrency. It is neither
a passing run nor an application failure. Its nested PR head had already advanced;
the top-level `head_sha` supplies the original run identity.

Retained: original JSON reports/API receipts, inventories, normalized complete job
logs and smoke log, **lossless original log/HTTP gzip copies with both hashes**,
original crash gzip, image manifests/contacts/WebPs and source/build bindings.
Checksums: [SHA256SUMS](SHA256SUMS). Runnable verification and original downloads:
`/tmp/opencode/remote-ci-1076c25/`. Initial integrated and final targeted local
receipts keep their original revisions and scope.

Artifact audit only: no application/test/build/Mac/CI rerun, owner post or commit.
This receipt establishes the stated checks and preserves the visual failures;
it does not complete the broader product objective.
