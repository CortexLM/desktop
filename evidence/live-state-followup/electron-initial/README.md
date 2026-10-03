# Initial transcript correction — positive Electron evidence

**Bounded evidence approval.** The unchanged four-red regression test now passes **4/4**
in isolation and within **101/101** full-suite cases. Zero retries, skips, flaky or
unexpected results. This audit covers the initial uncommitted renderer candidate below;
implementation review remains separate.

## Exact run and source binding

| Item | Verified value |
| --- | --- |
| Base application | `f5bf305473db12fddfddcda890a01794f02f578f` |
| Initial `packages/app/src/state/live.ts` | `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34` — [retained bytes](source/live.initial.ts) |
| Unchanged regression test | `842804966f6cd584834c728c92c495ccc52ece47bce2dcd128df912f98c83710` — [baseline test bytes](../baseline/source/live-state.spec.ts) |
| Isolated races | **4/4**, one worker; **07:38:23.615 UTC**, **12.721s** |
| Full suite | **101/101**, four workers; **07:39:28.493 UTC**, **265.136s** |
| Registry render checks | **426**, within one passing case; no 426-image capture claim |
| Current build members | **90/90** match the retained initial source/build receipt at audit start/end |

[Provenance](provenance.json) binds the initial source receipt, exact test/support hashes,
build and existing compressed reports. The baseline retained test, original temporary test
and current test are byte-identical. Baseline JSON preserves **four actual assertion
failures**, not setup errors: two erased newer turns and two revived deleted transcripts.
All original assertions remain. Comparing registered case identities gives exactly the
same **97 existing cases + four new `live-state.spec.ts` cases**.

Against frozen f5bf305, **88/90 built members remain identical**. Renderer entry changes
from `index-CxOxyGGT.js` to `index-Cu9ldSsB.js`, plus its `index.html` reference; all main,
preload, CSS and other assets match. At audit, only `state/live.ts` differs among app and
i18n inputs. Auth, screenshot-registry, launch fixture, fake-provider and Playwright config
bytes equal f5bf305. The Vite renderer has no `sourcesContent` map: binding uses the recorded
source/build receipt and audit-time byte checks, not an independently reproduced build.

Retained ancillary logs report **245 unit passes + one optional skip**, **22 passing files**,
i18n **65 files / 2272 used keys / 3405 English keys / zero problems**, diagnostic-free
lint/typecheck and `SMOKE OK`. The existing [package receipt](../integrated/package-initial.json)
records **90** matching members and ASAR
`6eb8fcf3b2f235d88fe682c107568b3dd982dacdd2246bbc17a15982476f1662`.
Package extraction/input inventory belongs to its separate receipt, not this audit.

## Regression assertions and actual DOM/SSE evidence

The test delays **one already-computed real IPC history response**. Engine SQLite reads,
provider HTTP and `window.cortex.events` SSE continue normally. It does not replace the
history DTO, fabricate stream events or inject a final DOM snapshot. Each case checks
real provider request count, selected model and fixture authorization; page/console errors
and renderer HTTP remain empty.

[Race checks](race-checks.json) independently decode all eight successful executions
(four isolated, the same four in the full suite):

- **Stream, both themes:** held snapshot contains the earlier user/assistant pair, with
  a completed, error-free answer. SSE then contains a distinct newer pair and two distinct
  completed assistant IDs. Each stream trace has **26 deltas, 14 part updates, eight
  message updates, four status events**, including two idle completions.
- Before release, DOM contains exactly the newer user and complete answer. After release,
  users are exactly `[Earlier saved message must remain., Newest streamed message must remain.]`;
  answers are exactly **two** `Hello from the streaming test provider. Everything works.`
  entries, in order. No duplicate or missing final turn is accepted.
- Each stream trace has **14 DOM samples**, including incremental text; all **three
  non-setup samples** retain the newer user and complete answer. MutationObserver evidence
  covers the release transition, beyond a final screenshot assertion.
- **Delete, both themes:** actual `session.deleted` event and absence from the engine list
  are required before release. All **three DOM samples**, including before/after release,
  have zero users/answers. No sampled transient revival occurs; final DOM remains empty.
- The released IPC response is fenced by another real `/api/health` round trip and two
  animation frames. Observations establish no disappearance/revival at recorded DOM
  notifications and settled frames; they are not an exhaustive CPU-instant trace.

### Full-size before/after review

All eight full-suite race views inspected at original **960×640** resolution. Stream
before frames show only the completed newer exchange; after frames show both completed
exchanges above the composer. Deleted transcript and sidebar entry remain absent. No
race-frame clipping, overlap or blank application render found.

| Case | Before | After |
| --- | --- | --- |
| Stream light | [image](../baseline/images/stream-light-before.webp) | [image](images/d30497dbd191521d55de4aa9116897165ec2499070900548df5adb555450eddc.webp) |
| Stream dark | [image](../baseline/images/stream-dark-before.webp) | [image](images/648512d98d97f67967196c2286f3a3dd93d747fb6c9379eace095f7ccb814f7a.webp) |
| Delete light | [image](images/7527c1e21887550b2aadbdede78e30821b41776026525c7b1ba596713ce4e706.webp) | Same exact pixels |
| Delete dark | [image](../baseline/images/delete-dark-before.webp) | Same exact pixels |

Isolated versus full-suite race images: **6/8 pairs exact**. Light deletion before/after
differs by **3,108 pixels**, bounded by **[357,67,795,615]**; both executions stay empty,
both within-run before/after pairs are exact. The isolated pair was also inspected full-size.
Runtime cause remains unknown; [numeric differences](race-run-comparisons.json) are preserved.

## Locale and broader visual review

All eight original locale auth PNGs inspected full-size: **en, fr, es, de, ja, zh-Hans,
pt-BR, ko**. Headings, retained digits, refusal text and focused Cancel render legibly;
Japanese, Korean and Simplified Chinese have visible glyphs, not missing-glyph boxes.
These are local Linux captures. The [earlier Linux CI glyph failure](../../remote-chat-foundation/ci-1076c25/README.md)
remains separate; this run does not establish its cause or correction.

All **8/8 locale images** equal the corresponding final f5bf305 PNG bytes and RGBA exactly:
**zero changed pixels**, verified existing canonical files reused via
[locale comparisons](locale-comparisons.json). The entire decoded locale geometry also
equals that final receipt. Directly measured counts:

- **48 primary states** = eight locales × two themes × wrong-code/signed-in/enrollment.
- **80 total measurements**, additionally 16 unavailable-option and 16 send-refusal states.
- **384 readable text measurements**, settled opacities, **144 reachable keyboard stops**.
- Passing unchanged locale assertions enforce exact copy, editable retained code, auth
  status/private-state checks, zero page/console/fixture errors and renderer HTTP.

All **129 unique full-suite images** reviewed across **17 contact sheets**. These include
four inline approval-layout PNGs, not merely the files on disk. Total original inventory:
**258 PNG files / 125 unique file PNGs**, **133 PNG attachments including four inline**.
The isolated run has **16 files / eight image attachments / six unique PNGs** and adds one
distinct light-deletion image, giving **130 combined unique images**.

**22 full-size capture views / 19 unique images** inspected: eight race views, eight locale
views, the two differing isolated delete views and four auth/contact follow-ups. Remaining
images received contact-sheet review; this is not 129 full-resolution visual acceptances.
All contacts show rendered UI. Expected refusal/loading/empty/scroll states remain visible.

Preserved visual qualifications:

- Email-step decorative top-logo clipping is **byte-identical to prior final evidence**;
  main copy/actions remain visible. No new repair claimed.
- Ordinary light refusal and signed-in images differ from prior final by **25 left-shell
  pixels each**, bounds **[22,16,57,154]**; auth content is exact.
- Canonical-origin settings differs by **83 input-region pixels**, bounds
  **[631,386,833,420]**; field/actions remain readable. Cause unknown.
- Toast stacks and clipped scrollport tails in broader contacts are retained as photographed;
  no whole-pane-visible or complete design-acceptance claim.

[Review inventory](review.json), [all contacts](contacts.json), [auth comparisons](auth-comparisons.json)
and [image manifest](images.jsonl) retain exact scope and differences.

## Retention and boundary

- **70 existing identical PNGs + four existing RGBA-exact WebPs** referenced relatively.
  **56 new lossless WebPs**, decoded **RGBA-exact including alpha**, deduplicated by original
  image hash. Every original/retained hash, size, source alias and canonical path is recorded.
- Existing `../integrated/*.gz` reports/logs round-trip to supplied originals; no duplicate
  raw report copies. Compact [cases](cases.jsonl), [summary](summary.json), race data and
  image metadata support this review. `SHA256SUMS` covers delivered files.
- Initial source bytes are retained so a later independent correction cannot silently
  inherit this verdict. **CI 37105137365 / 1076c25 and installed f5bf305 do not contain this
  uncommitted renderer delta.** No current CI or native-Mac acceptance follows.
- Audit-only: no implementation-logic review, package-input preparation, build, test run,
  live app/device access, CI query or commit. The separate implementation reviewer owns
  logic acceptance; this receipt approves the recorded initial candidate's positive evidence.

Offline verifier: `/tmp/opencode/live-state-positive-review/audit.py`. Initial retention
timeout and empty-output recovery are recorded there; all delivered images passed final
decode/equality checks. Historical four-red evidence remains intact.
