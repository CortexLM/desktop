# Final combined correction — Electron artifact review

**Artifact review ready; bounded approval. 103/103 cases passed**, zero retries, skips,
flaky or unexpected results. All six original negative regression cases pass with unchanged
test bytes. Source matches **`760c4a046ce454bc8b0ab2fd85c941fec321c3ea`**, verified offline
after the coordinator's commit; no CI result is inferred from that binding.

## Run and source identity

Final run: **2026-10-03 08:27:12.010 UTC**, **264.748s**, four workers. Registered cases
are exactly the initial **101 + two Bot ownership cases**. One case records **426 design
state render checks**; these are not 426 retained screenshots.

| Verified source | SHA-256 |
| --- | --- |
| `packages/app/src/state/live.ts` | `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34` |
| `packages/app/src/screens/bots/bot.tsx` | `f660ed2a4ab303bf55527ed8c9d8c4e535df786675790509f51a55c21409a6f1` |
| Original Chat regression | `842804966f6cd584834c728c92c495ccc52ece47bce2dcd128df912f98c83710` |
| Original Bot regression | `21af3392fad947945861063d93625d6115675f288ff43273568ea1fe4c50cdff` |
| Updated auth/glyph regression | `653016add38f51d766dfec52c205790de4b941c02739a993315c282469b1b0cb` |
| Workflow provisioning | `7d1fb3b18f9784ed295085dd96664e9f967f4eb12d3c4958bf183838e067e6c8` |

All six hashes match [source-final](../integrated/source-final.json), current bytes and the
application commit. The hook equals the retained initial correction. Bot source has the
scoped **two-added/one-replaced-line** delta from f5bf305; final bytes retained
[here](source/bot.final.tsx). This audit reviews evidence, not implementation logic.

**90/90 build members** match [build-final](../integrated/build-final.json) before/after
audit, with no missing/unlisted members. **88/90** equal the initial corrected build:
renderer entry is now `index-DKH-iKjj.js`, plus changed `index.html`; main/preload/maps,
CSS and other assets remain byte-identical. Against the existing **514-input** f5bf305
receipt, only the two application files above differ, exactly as final source pins require;
**zero unexplained drift**. Commit-tree comparison confirms the same input delta.

The renderer has no `sourcesContent` map. Source/build pairing is the coordinator's
recorded receipt plus independent byte checks, not a reproduced build. All before/after
checks and report hashes are in [provenance](provenance.json).

Retained logs also record **245 unit passes + one optional skip**, **22 passing files**,
lint/typecheck without diagnostics, i18n **65 files / 2,272 used keys / 3,405 English keys /
zero problems**, and **SMOKE OK**. The [package receipt](../integrated/package-final.json)
records **90 verified members**, ASAR
`bbd6dbddd5103e63d076f0edfd8afe245da1c5b858fc4883d9bd06cc70bcfc0a`.
No package rebuild/extraction or new input inventory was performed here.

## Two Bot cases: actual destination, not just correct heading

Both theme results are ordinary expected passes with empty error arrays. The exact
[negative test bytes](../bot-owner-baseline/source/bot-owner.spec.ts) remain unchanged:
**six soft ownership assertions per case, twelve now passing**. Soft assertions preserved
execution through the write proof; they were not removed or converted into expected failures.

The test holds an already-computed real **200 Beta session-list response**, preserving its
body. Real provider HTTP, IPC and SQLite continue. [Decoded checks](bot-checks.json) verify:

- While Beta's response is held: Beta title/placeholder, **zero transcript users/answers**.
- Release: exactly `Beta saved request` and its completed answer appear.
- Next Composer submission records exactly one actual POST to **Beta's session**:
  - Light: `/api/sessions/ses_01a100dfdf080000b08baf5a6b5fea66/prompt`.
  - Dark: `/api/sessions/ses_01a100dfdee8000065cfb1c63dd19b55/prompt`.
- Alpha persists exactly **two messages**, user `Alpha first request`. Beta persists
  exactly **four messages**, users `Beta saved request`, `Intended for Beta after navigation`.
  All **three assistant completions per case** are present, error-free, with complete answers.
- Each trace has **13 DOM observations**, including **11 under Beta**. None of those eleven
  shows Alpha's user text; the first is empty, the last contains Beta's two complete exchanges.
- Passing unchanged assertions require **three provider requests per case**, correct model
  and fixture authorization. Page/console errors and renderer HTTP are empty.

This regression records DOM/IPC/storage observations, not a per-event SSE ledger. All six
Bot originals were inspected full-size at **960×640**. Beta remains selected in the roster;
its transcript is empty while held, then correctly populated and extended. Alpha's roster
tile remains legitimately visible; its transcript does not. Scrollport tails/fades remain
part of the photographed layout.

| Theme | Held | Released | After follow-up |
| --- | --- | --- | --- |
| Light | [image](images/f94f4cdb31d5acb7006b67bd31ea7a1a83e363ed901d5614b088a02c4e4ec204.webp) | [image](images/1e3cd1629ea8bb65858340357d239d46ae8ed2fe33bf7bbe1be34683b3d0cc9a.webp) | [image](images/b878f6c0209192fe49f90cdcc833f79ece178fcb54f237b1659e88dd76bc8f5f.webp) |
| Dark | [image](images/947cf5d730a733340886a8ea7843a3acda83aebe026280f49009c57c6b5cb62c.webp) | [image](images/699aa0864b69cc81ba21581c760d577991f1dec3630b4e4a6d7dd2a361d963fe.webp) | [image](images/ad2a33042fd570fd3f9c01d1237edaa44cec8d2d347f3afd9eb0330c3a4e033e.webp) |

## Four Chat races remain green

The original [four-red test](../baseline/source/live-state.spec.ts) remains byte-identical.
[Final decoded traces](chat-checks.json) preserve the earlier real snapshot and live SSE:

- Stream cases: **26 deltas, 14 part updates, eight message updates, four status events**,
  two distinct completed assistants. Final users are exactly earlier/newer; final answers
  are exactly two complete copies of the fixture answer, in order.
- Each stream trace has **14 DOM samples**. All three non-setup samples retain the newer
  user and complete answer through history release.
- Delete cases: actual deletion event; all **three DOM samples** remain transcript-empty.
  No observed transient revival. Original empty-list/final-DOM assertions pass.
- Observation uses a real IPC health fence and two animation frames; no exhaustive
  CPU-instant claim. Errors and renderer HTTP remain empty.

All **eight before/after originals** reviewed full-size. **Six of eight** equal initial
run bytes. The two light-stream frames differ by **two sidebar-edge pixels each**, bounds
**[65,433,325,434]**; transcript pixels are exact. Runtime cause remains unknown.
Deleted before/after frames remain exact within each theme. See
[image comparisons](image-comparisons.json) and [full-size paths](fullsize-targets.json).

## Locale glyph proof: local WenQuanYi, not CI Noto

All **eight locale originals** reviewed full-size; visible Latin/CJK glyphs, retained digits,
refusal text and focused Cancel remain readable. **8/8 PNGs** equal the initial local
receipt exactly, including RGBA. Measured geometry retains **48 primary states / 80 total
states / 384 readable text measurements / 144 reachable Tab stops**.

The new [font attachment](font-records.json) contains **six CDP records**: Japanese,
Simplified Chinese, Korean, each light/dark. Its **12 paired-glyph raster checks** pass
at weights **400 and 500**: both glyphs have ink, differ from each other, differ from the
`U+10FFFF` missing-glyph raster. Sample pairs are `あ/ア`, `汉/字`, `한/글`.

CDP identifies **WenQuanYi Zen Hei** as the system fallback in all six headings; Korean
also records one Geist glyph. **This is local Linux font evidence.** Workflow Noto install
and future CI inventory/raster results remain unverified by this audit. The earlier CI
missing-glyph result is not overwritten by local passing geometry or glyphs.

## Image inventory, review and reuse

- **270 on-disk PNG files**, **131 unique file PNGs**; **139 PNG attachments**, including
  **four inline PNGs**; **135 unique images** total.
- All **135** reviewed in **17 contact sheets**. **22 target views / 20 unique images**
  inspected full-size: six Bot, eight Chat race, eight locale. Other images received
  contact review; no universal full-resolution design acceptance.
- **97 images** equal initial full-suite PNG hashes; two ordinary light auth images reuse
  earlier-final exact PNGs. **99 existing canonicals reused**, **36 new lossless WebPs**,
  all decoded **RGBA-exact including alpha**. Relative links and original aliases retained.
- No blank app capture or new target ownership contradiction found. Known email-step
  decorative-logo clipping, toast stacks and scrollport tails remain scoped qualifications.
  Broader pixel differences are measured without tolerance; causes remain unknown.

[Image manifest](images.jsonl), [contacts](contacts.json), [review](review.json),
[cases](cases.jsonl) and [summary](summary.json) preserve counts and review level.
Existing `../integrated/*-final*.gz` logs/reports round-trip exactly; no raw report duplication.

## Boundary

Approval covers the retained **final 103-case local Electron run** at the source hashes
above, now matched to **760c4a0**. Code/architecture review remains its separate receipt.
Earlier **101-case** evidence retains its initial pin. Prior **f5bf305 installed auth**
and **1076c25 CI** do not establish native or CI acceptance of these renderer/font changes.

No app/test/build, Mac/SSH/GUI, CI query or commit executed by this reviewer. Offline
verifier: `/tmp/opencode/live-state-final-review/audit.py`; final integrity verifier and
receipt remain in that directory. `SHA256SUMS` binds this delivered review.
