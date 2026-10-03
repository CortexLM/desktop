# Clock-controlled Work comparison

The original ambient-clock [32-state comparison](../compare/index.html) remains intact, including
its 8.19% wallpaper outlier. This separate run uses the unchanged `f9aca44` application with an
explicit browser Date of **2026-10-02T12:09:00Z**, timezone **UTC**, timers running normally.

```sh
node scripts/compare-shots.mjs \
  --shots /root/cortex-ui-freezes/2026-10-02-7b388e2d9674/shots \
  --out /tmp/opencode/live-actions-compare-clock \
  --base http://127.0.0.1:5309/ --only work-task \
  --clock 2026-10-02T12:09:00Z --timezone UTC
```

**16 renders, 16 references, zero missing within this scope.** Computer states: 0.01% dark /
0.02% light; takeover: 0.00% rounded dark / 0.01% light. Overall maximum remains **0.45%** at
`work-task~done-light`; residual alignment/typographic pixels are not waived or claimed identical.
[Independent pixel review](review.md) verifies all 48 hashes and sixteen diff calculations.
Done light has a measured 1 CSS-pixel downward transcript offset; its cause remains unproven.

The clock matches the observed frozen simulated-desktop minute and daytime wallpaper. Frozen
metadata does not attest its original browser timezone or mount time; this is an explicit caller
control, not recovered original capture metadata. Real host capture timestamps remain separate.

`provenance.json`, every row and every run record the policy. Different clock policies cannot
merge; historical clockless records remain readable as ambient. Reference images, source hashes
and pixelmatch threshold 0.15 retain their original values. [Logic review](source-review.md) and
[assert check](tests.log) cover validation/merge refusals. The browser run exercises fixed Date with
real timers against the actual build.

[Comparison plates](index.html), original report/provenance and `retained.json` bind 48 original
PNG hashes to pixel-identical lossless WebP copies. Full original PNGs remain in the command's
output directory. This scoped preview comparison does not establish native, live-engine or full
reference acceptance.
