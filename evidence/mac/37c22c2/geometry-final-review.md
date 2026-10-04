# Provider native geometry — final independent source approval

**Approved: actual input-only correction. No remaining source blocker from this review; no additional native run required for this collector correction.**
Readback: **2026-10-03 11:50:07 UTC**. Current `/tmp/opencode/provider-draft-native.mjs` remains **117 lines**.

## Exact byte binding
- Original: `0125e457b2cd05ba2be8aa1344b6c6e5a0c15dbb7efdecab2af32a2add170d30`.
- Approved prepared driver: **`205f719896f1aa1574249e849d7da06b66d39cd619046f3e0ba68b05513339ac`**.
- Executed confirmation driver remains **`c84743eeed5d8a5cda6f873269fcd0a247d8fcf467962fa6e6e7001bd9c0ad73`**; archived bytes independently match the broad two-guard version.
- Exact whole-file reconstruction from archived original passes: only line 63 differs, adding `(node !== el || !(el instanceof HTMLInputElement)) &&` to each of the two overflow conditions. Final readback unchanged.
- No assertion or target removed. Six targets, 0.5px tolerance, ancestor clips, self/ancestor opacity, non-input text-range clipping, input/switch hit tests, draft/config/mutation checks, package identity and cleanup are byte-identical.
- Input's own content clip no longer rejects its visible border. Text elements retain their original self-overflow checks, including `.sub { overflow:hidden; text-overflow:ellipsis }` at `styles.css:301`.

## Offline validation against recorded geometry
- Diagnostic `c7e8ac741c68ac9a1fe4853282ef58df81dbb1eea42a50a9b3f6fbe338bdfada` exactly matches the archived initial diagnosis.
- Original input border `[631,358,831,392]` fails its own client clip `[632,359,830,391]`; narrowed rule correctly uses ancestor clip `[617,302,915,518]`.
- Replayed all six recorded targets: border bounds and applicable recorded ink fit; all six recorded hit flags true. No DOM, UI or native operation executed.
- Saved · 1111 ink `[631,330,690.40625,346]` fits its own hidden clip `[631,330,901,346]` under the narrowed rule.
- Counterexample `[631,330,910,346]` passes broad ancestor-only clip, fails narrowed hint clip: the earlier false-positive gap is closed.
- API key / Enable ink begins 1px above its own box with `overflow:visible`; retaining original overflow-sensitive checks avoids a new blanket text-containment false failure.

## Native outcome boundary
- Coordinator reports c847 confirmation: 94.2s, four native images, eight UI writes. These remain attributed to **c847**, never to prepared **205f719**.
- Prepared **205f719 was not run natively**. Recorded-vector replay establishes its corrected predicate on those vectors, not a retroactive runtime pass.
- Existing four-image review plus 24 recorded target boxes can support the fixed English states' actual visible fit and ancestor geometry. Broad boxes alone cannot establish arbitrary self-clipped text safety.
- The recorded 1111 range does not prove 2222 glyph widths or all confirmation text ranges. Readability of both hints belongs to the native auditor's existing original-image review; no same-width inference is needed.
- No concrete physical clipping concern established here; an extra capture campaign is unnecessary for this measurement-quality correction. Native acceptance remains the separate auditor's bounded disposition.
- Settings source remains `b859cf9785ada768307e77a2546c02b80576b1491187b6ffa944c1673432eed6`; application pin remains `37c22c2`. Original failure, broad confirmation and earlier review retain their historical attribution.

Only this report written. Offline byte/hash assertions and six-vector/counterexample checks passed; no Mac/network/build/test/CI/commit/delegation actions.
