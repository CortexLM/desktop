# Cortex controlled-clock comparison review

**Verified: clock provenance and artifact integrity. Night/day wallpaper mismatch disappears under the explicit clock override; done-light remains an unresolved 0.45% residual. No blanket visual approval.**

## Provenance
- Input: `/tmp/opencode/live-actions-compare-clock`; run `2026-10-03T00-14-09-114Z-4zGwo6`; 16 Work renders, 16 comparisons, zero reference gaps.
- Root, run and all 16 rows agree: `{mode:"fixed",source:"cli",time:"2026-10-02T12:09:00.000Z",timezone:"UTC",timers:"real"}`. Actual capture timestamps remain 2026-10-03; each original reference timestamp remains 2026-10-02 12:09.
- Report SHA-256 verified: `7b8289331d708fcbe05beaa2f93e16417647c479c9674666932d1eed5465ac2c`; provenance SHA-256: `90e08dad3ee9a0f3e7dd95266869340f6bd01bdb7d66428c64d109d21e18d1b4`.
- Verified all 48 PNG hashes, byte lengths and 2880×1800 dimensions; 16 frozen image/manifest mappings; five frozen metadata hashes. All 16 percentages and saved diff RGBA buffers reproduce exactly at unchanged pixelmatch threshold 0.15.
- Independently recomputed frozen 106-file fingerprint `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768` and application 473-file fingerprint `5f709c11d836948142b65c5c2b4fe0582bddbfc19f76dbe15cf6d2146a6bcf0f`; application bytes match both current tree and recorded commit `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a`.
- Comparator hash and served-asset aggregate verified; all 19 recorded assets match local dist. Source and served-asset hashes remain separate provenance, not build-to-source attestation.

## Inspected pixels
- Inspected full app/diff PNGs for computer-dark/light and takeover-dark/light; done-light app/design/diff; done-dark diff. Files reside under the run's `captures/` directory.

| Work state | Ambient % | Controlled % | Controlled differing pixels |
| --- | ---: | ---: | ---: |
| computer-dark / light | 3.68 / 3.68 | 0.01 / 0.02 | 732 / 778 |
| takeover-dark / light | 8.18 / 8.19 | 0.00 / 0.01 | 241 / 353 |
| done-dark / light | 0.42 / 0.45 | 0.00 / 0.45 | 223 / 23,133 |

- All four simulated desktops now show **12:09 and teal waves**, matching the frozen state. Large wallpaper-border diffs disappear; remaining marks are localized shell/text/mascot/badge pixels. Rounded 0.00% is not pixel identity.
- Image-pixel rectangles `[1750,350,2768,1646]` (computer) and `[777,365,2769,1708]` (takeover): respectively 0/0 and 0/88 threshold mismatches in dark/light. Takeover-light's small badge-dot difference remains.
- Done-light retains a coherent **1 CSS-px downward transcript offset**: app `(x,y)` equals design `(x,y−2)` byte-for-byte across `[1110,510,2440,1490]`, 1,303,400 image pixels. The same dark rectangle is byte-identical without translation.
- This proves the measured displacement, not its cause. No captured DOM/scroll measurements establish timing, subpixel rounding or a code defect. Done-dark's lower score does not prove the clock fixed scrolling. Keep done-light **0.45% unresolved**; no normalized replacement score.

## Bounded conclusion
- `f790056..f9aca44` changes `work/home.tsx` only by three live-options lines; preview implementation and `work.css` are unchanged. The controlled images corroborate the earlier clock-selected wallpaper diagnosis.
- Original `/tmp/opencode/live-actions-compare` report hash `20848f9030d8699fe2fce3a475d553ced0ec513e5fea4a0053e1c633b4577996` and all 96 PNG hashes still verify, retaining maximum **8.19%**. This separate run neither replaces nor relabels those outliers.
- UTC is an explicit caller-selected override, **not original browser-timezone attestation**. Maximum across this controlled scope remains 0.45%; residuals remain unapproved. No live/native/motion acceptance follows.
- Report-only review: no app/source edits, build, capture, test suite, CI, Mac access or delegation.
