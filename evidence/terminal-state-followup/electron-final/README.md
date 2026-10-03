# Terminal-state correction — final local Electron audit

**Bounded artifact approval: 107/107 local Linux Electron cases pass**, zero retries,
skips, flaky or unexpected results. Four new cases preserve the exact negative-test bytes;
all eight original failed assertions now pass. All prior 103 cases remain registered and green.

## Exact run and source binding

Run **2026-10-03 09:34:10.288 UTC**, **266.662225s**, four workers. One case records
**426 screen-state render checks**; these are not 426 retained screenshots.
Final source matches application **`2956564fbe31f882014d74ff3a7f920e839fd634`**, verified
offline after the coordinator's commit. Base application: `760c4a0`; source review remains
[separate](../source-review.md). No CI outcome is inferred from the Git binding.

| Final source | SHA-256 |
| --- | --- |
| `packages/app/src/screens/chat/live-chat.tsx` | `c70919bb1dd6167f1bd32c4618a11e59aa79df7a7c5484a9adbf7810b79e0a6e` |
| `packages/app/src/screens/code/code.tsx` | `51c76d03b98da536bc84d8e010a22115ca1df1d215df2723fab9224d0a1db225` |
| `tests/e2e/chat-missing.spec.ts` | `a9bdc8e86f3ede94f0b54dc6a5d8b45142a62b98ad9fd0af2515c96bddb3d994` |
| `tests/e2e/code-models.spec.ts` | `ff1bc7e7e6d08f59d713f0c7fccfb79fa35c02b682a870b804988145ae107ff5` |

**90/90 build members** match before/after audit, with complete file-set equality.
**88/90** equal the 760c4a0 freeze; only renderer entry `index-O6tp7Lco.js` and its HTML
reference differ. Main, preload, maps, CSS and catalog inputs remain identical.
Existing inventories bind **514 package inputs / 473 renderer inputs**: exactly the two
screen files changed; zero unexplained drift. Preview function excerpts match baseline bytes;
this is a static source check, not a new frozen-reference pixel comparison.
Source/build pairing uses recorded receipts plus exact byte checks, not build reproduction.

Retained logs record **245 unit passes + one optional skip**, 22 passing files, lint/types
without diagnostics, i18n **65 files / 2,272 keys used / 3,405 English keys / zero problems**,
and Linux **SMOKE OK**. Independently read packaged ASAR: exact **90 build members + root
package.json**, all member/block hashes valid, ASAR
`de7b30a5eedc416a1e1b35756e268fc7028f70908564e15b3ef4df9ec9c94d6e`.
See [provenance](provenance.json), [package receipt](../integrated/package.json).

## Four corrected cases, unchanged assertions

**Deleted Chat — light/dark.** Real admitted exchange completed; real DELETE returned 200.
After reload, both session and history GETs return **404 / `not_found`**. Transcript is empty;
alert reads **“Page not found” / “This link goes nowhere, or the page has moved.”** No retained-
message promise or Retry button. Existing New chat opens editable empty Home; session list
stays empty. One actual fixture-provider request per case; no page/console or renderer HTTP errors.

**Code failure — light/dark.** Existing fake's actual **HTTP 400** persists `provider_error`,
not the earlier discovery's 401/auth error. Completed failure shows **Failed / `badge err`**
before and after reload. Follow-up shows **Running / `badge run`**, then **Ready / `badge ok`**;
error banner disappears, draft clears, successful answer appears. Four messages remain in
the same session; first two match the failed history exactly. Each case records two fixture
requests, **13 successful-assistant deltas**, status sequence **busy, error, idle, busy, idle**.
Banner/draft assertions come from the unchanged passing test; badge/history/SSE values are
also retained in decoded attachments. Fixture keys are explicit test placeholders.

[Negative-to-positive](negative-to-positive.json) binds Chat lines **55/56** and Code lines
**327/335**, two failures per theme, to corrected values. [Checks](checks.json) retain actual
404s, histories, statuses and request summaries; raw reports remain in existing gzip files.

## Existing transcript, Bot and locale coverage

All four earlier Chat races pass with unchanged tests: two completed exchanges survive
late history; deletion samples remain empty. Stream cases each record **26 deltas / 14 part
updates / eight message updates / four status events**. This is observed DOM/SSE evidence,
not an exhaustive every-instant timing guarantee.
Both Bot cases retain **12 ownership assertions** total: Alpha history stays two messages,
Beta reaches four; actual POSTs target Beta, all eleven Beta DOM observations exclude Alpha's
transcript. Bot evidence is DOM/IPC/storage, not a per-event SSE ledger.

Eight locale PNGs equal previous local evidence byte-for-byte. Current attachments retain
**48 primary states / 80 measured states / 384 text checks / 144 Tab stops**, six CDP records
and **12 passing paired-glyph checks**. Local fallback is **WenQuanYi Zen Hei**. Previous CI
Noto evidence keeps its earlier pin; this audit establishes neither new CI font provisioning
nor matching installed-Mac acceptance.

## Image review and retention

**282 PNG files / 137 unique file PNGs; 145 PNG attachments, four inline; 141 unique images.**
All **18 contact sheets** inspected. All **six new 960×640 originals** inspected full-size:
two missing-Chat, two failed-Code, two recovered-Code. Copy and task badges agree with state;
recovered frames show the complete answer and no error banner.
**118 existing canonicals reused; 23 new lossless WebPs**, all decoded RGBA-exact including
alpha. Six new-case images equal earlier targeted PNGs, so their canonicals are reused;
final-run attachments establish current provenance, not the earlier pre-refactor run.

Against the previous full run: **139 comparable attachment views, 108 RGBA-exact, 31 different**.
All six Bot views and eight locale views are exact. Six of eight Chat-race views are exact;
two light frames differ only at two sidebar-edge pixels each, bounds `[65,433,325,434]`.
Other differences retain exact counts/bounds and unknown causes; no tolerance applied.
Known decorative-logo clipping, toast stacks, narrow composer-placeholder truncation and
scrollport crops remain scoped qualifications. Contact review does not certify every pixel.

[Images](images.jsonl), [contacts](contacts.json), [six originals](fullsize-targets.json),
[visual review](review.json), [comparisons](image-comparisons.json), [cases](cases.jsonl),
[summary](summary.json) and `SHA256SUMS` bind the retained review.

## Boundary

Approval covers this final **local Linux** run at the stated source/build pins. Earlier
targeted passes, CI receipts and installed-Mac captures retain their own scopes.
No app/test/build, Mac/GUI, CI query, network request or commit executed by this reviewer.
Offline verifiers and final integrity receipt: `/tmp/opencode/terminal-state-final-review/`.
