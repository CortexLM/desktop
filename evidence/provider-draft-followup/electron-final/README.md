# Provider drafts — final local Electron audit
**Bounded artifact approval: 111/111 local Linux Electron cases pass**, zero retries,
skips, flaky or unexpected results. All prior **107 cases** remain registered, green and
source-unchanged. Four new cases preserve their negative-test bytes; eight failures now pass.
Run: **2026-10-03 10:55:18.305 UTC**, **275.660251s**, four workers. One case records
**426 screen-state renders**, not 426 retained screenshots.

## Source and build identity
Final sources match coordinator commit **`37c22c2fcff92fb76b10ffc97ec0643ac325d62f`**,
verified offline after commit. Base application remains `2956564`; CI/native outcomes are separate.

| Source | SHA-256 |
| --- | --- |
| `packages/app/src/screens/system/settings.tsx` | `b859cf9785ada768307e77a2546c02b80576b1491187b6ffa944c1673432eed6` |
| `tests/e2e/provider-draft.spec.ts` | `bf57e5cdb18d53f31572ec04ec7727130574a1c33cbdf9cc3b6fcb4733365c3a` |
| `tests/e2e/provider-key-pending.spec.ts` | `bcafa61de982af883954f648123c06370021b0dab8c8aca5003a2ec06d3d7477` |

**90/90 build members**, exact complete file set, stable before/after audit. **88/90** equal
the 2956564 freeze; only entry `index-4DBB9Kor.js` and its HTML reference differ. Main/preload,
both maps and CSS are identical. Existing **514-input** inventory differs only in Settings;
catalogs are unchanged. **473 renderer inputs** recompute fingerprint
`5538c5298dbad432d82cf18781b9f7e62b5a861311ad61c6fc518c0cdb6e1ae7`.
No unexplained input drift. Recorded source/build pairing plus byte checks is not a reproduced build.

Retained logs: **245 unit passes + one optional skip**, 22 passing files; lint/types without
diagnostics; i18n **65 files / 2,272 used keys / 3,405 English keys / zero problems**; Linux
package/smoke **SMOKE OK**. Independently parsed packaged ASAR equals [package receipt](../integrated/package.json):
`d1e6987ac728723b5c9b1132aa532fc63c3db55d863c9b264c48fdc631eea1f7`, exact **90 build files
plus root package.json**, passing embedded file/block hashes. [Provenance](provenance.json).

## Four corrected regressions, actual engine writes
**Enable — both themes:** replacement B survives disable and enable; stored A remains hint1111.
Neither explicit preparation refill runs. Final Save accepts B, changes hint to2222, clears input.
Each case records exact observed non-GET sequence **PUT / PATCH / PATCH / PUT**, all 200,
metadata-only responses. Main HTTP observer begins **after launch**; zero means zero in that
observed interval, not the whole process lifetime. No observed prompt/message request.

**Pending Save/Remove — both themes:** original main IPC handler completes the actual mutation
before its response is held. Independent GET already shows B/hint2222 or no stored key.
Input stays editable; C or D is entered before release. The unchanged passing test compares
held/delivered **status, headers and body string**, then returns the original response.
After release, newer draft remains 20 characters; stored metadata independently remains2222/absent.
This is real engine persistence and delayed delivery, not manufactured API success.

Each pending case records **six credential mutation attempts**: four successful initial
PUT/PUT/DELETE/PUT operations, a **4097-character PUT refused 400 / `invalid_request`**, final
ordinary DELETE200. Refusal preserves the exact draft and hint4444; ordinary accepted Save
and Remove clear unchanged captured input. This is protocol-validation refusal, not a
credential-store I/O-failure probe. Responses/lists contain no raw key; no key request bodies
are recorded. Pending-case page/console errors and renderer HTTP lists are empty.

Toggle refills are explicitly false. Pending recovery refills have no separate telemetry;
retained input equality and unchanged source make their branch conditions false. No broader
Switch serialization or edit-history identity guarantee follows from the content-equality guard.
[Decoded checks](checks.json) and [negative-to-positive assertions](negative-to-positive.json)
bind toggle line99 twice/theme and pending lines84/101 to the eight corrected assertions.

## Images and retained limits
**294 PNG files / 143 unique file PNGs; 151 PNG attachments, four inline; 147 unique images.**
All **19 contact sheets** inspected; all **six new 960×640 originals** inspected full-size.
Toggle views show Off, saved1111 and a nonempty masked draft. PUT views show saved2222 with
the newer masked draft; DELETE views show absent-key copy with a newer masked draft.
Assertions identify B/C/D; masked pixels alone do not. Toggle captures crop part of Enable;
pending-write toasts overlap the lower model list. These are not all-controls geometry approval.

**125 canonicals reused; 22 new lossless WebPs**, all decoded RGBA-exact, including alpha.
Five new targets equal earlier targeted PNGs. Light DELETE differs by **one pixel**, bounds
`[954,620,955,621]`; cause unknown. Final-run attachments establish current provenance.
Against the previous full run: **145 comparable views, 114 exact RGBA, 31 different**;
all six Bot, eight Chat-race, six terminal-state and eight locale views are exact.
Other differences retain measured counts/bounds without tolerance or causal claims.
Local CJK checks retain six CDP records/12 glyph checks with **WenQuanYi Zen Hei**; previous
CI Noto acceptance keeps its earlier pin. No new CI or matching installed-Mac acceptance inferred.

[Images](images.jsonl), [contacts](contacts.json), [six originals](fullsize-targets.json),
[review](review.json), [comparisons](image-comparisons.json), [cases](cases.jsonl), [summary](summary.json)
and `SHA256SUMS` bind this review. Existing raw gzip reports/logs round-trip exactly; no report copies.
Offline scripts/receipt: `/tmp/opencode/provider-draft-final-review/`. No app/test/build,
Mac/GUI/network/CI operation, commit or delegation performed by this reviewer.
