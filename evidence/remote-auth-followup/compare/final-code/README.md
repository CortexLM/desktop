# Final shared-Code CSS — ffc118a

**18 renders / 18 frozen references / 0 gaps.** Code Session (2), Code Review (6),
Canvas (10), both themes. All 54 PNG hashes/byte sizes/dimensions verified, all scores
and decoded diff buffers independently reproduced, all images retained losslessly.
[Browse](index.html), [pixels](pixel-verification.json), [source/assets](verification.json).

## Result

- All 18 rounded percentages equal their corresponding earlier 70-run values.
- Maximum **3,203 pixels / 0.061786265432098766%**, rounded **0.06%**,
  `code-review~review-light`; existing risk-summary text wrapping remains visible.
- Code Session: **226 dark / 207 light** mismatches against frozen reference
  (0.0043595679% / 0.0039930556%), both rounded 0.00%.
- Compared with the earlier app images, Code Session differs by **6 / 8 threshold
  pixels** and **3,076 / 3,057 exact pixels**, confined to the left transcript's
  spinner/thinking area. Its checked **right pane is byte-identical**, both themes.
- All eight non-generating Canvas right-pane crops are likewise byte-identical.
  [Ten exact regional checks](right-pane-equality.json) retain coordinates/pixel counts.
  The final minimum-height/overflow additions produce no new visible pane movement
  in these short fixtures. This does not establish long/asymmetric diff behavior.
- Other full-frame threshold changes versus the earlier app range **0–55 pixels**,
  except Canvas generation dark (**771**). The generation frame samples a different
  partial text endpoint; real timers remain active. Generation light differs by three
  threshold pixels but 9,517 exact pixels, so neither is called identical.
- No blank/clipped pane or new blocking layout shift found. Existing reference text,
  shell and animation residuals remain; no percentage acceptance threshold added.

All eighteen thumbnails inspected. Eight full-resolution triplets (24 images) inspected:
Code Session, Canvas Code, Canvas generation and Code Review review, each dark/light.
Remaining states were hash/diff-verified and reviewed as thumbnails. Retained lossless
image payload: **20,390,358 bytes**. Original images remain 2880×1800.

## Provenance

| Item | Verified pin |
| --- | --- |
| Application commit | `ffc118a2e58df66f430f3078e00f6e931dd910cf` |
| Source fingerprint, recomputed from 473 Git blobs | `da9e8ed2dc6722fb34f27a64f5071e1fe0e5c1b95cb9cae9b9852fedc371cf0d` |
| Report SHA-256 | `94a09c5de6348d58f626c8795e32c2e69fae54c28465ab53d9050bf397d2c4cd` |
| Provenance SHA-256 | `d1ed5a3b7c015aac297f33441a0098858539f86e25d7816f718b37ff8c49be47` |
| Served ledger, 20 assets re-fetched | `d78fc1d89c0c5981c1696b4e00cb8a8f19d368aadb1ca73a6cb872d27d501aaf` |
| Final CSS SHA-256 | `1b1946a4b1078dca0bbf6b662bd6976228930b407b2569e9e2ff1d00d303f162` |

Only `packages/app/src/kit/styles.css` differs between the earlier recorded source
manifest and these Git blobs: final `min-height: 70px` plus scoped parent overflow.
The main JS bytes match the earlier run although its generated filename changed.
Frozen reference and comparator hashes equal the parent receipt exactly.

Original run `2026-10-03T03-56-16-522Z-3lzVsQ`, completed
`2026-10-03T03:57:13.947Z`, retained from `/tmp/opencode/auth-final-code-compare`.
French, 1440×900 @2x, Date `2026-10-02T12:09:00.000Z`, UTC, real timers.
**46 preview API transport errors** remain recorded. Reference mount Date/timezone,
animation phase, live engine behavior, native chrome and CI result are not established
by these stills. Code Diff/Login/Work/Settings were not recaptured in this final subset;
their parent receipt keeps its earlier source pin. No source/build/capture/CI/native
actions were performed by this audit.
