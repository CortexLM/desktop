# Initial transcript correction — scoped frozen comparison

**22 renders, 22 frozen comparisons, no gaps.** All 22 full-resolution triplets
were inspected. No new blocking static layout shift was identified in this scope;
existing frozen-reference residuals remain. This receipt covers the **initial**
`useMessages` candidate, before the separate logic review.

[Browse every triplet](index.html) · [raw measurements](metrics.json) ·
[verification receipt](verification.json) · [PNG/WebP path map](retained.json).

## Scope and provenance

| Registered route | States | Dark/light renders |
| --- | ---: | ---: |
| `chat` | 1 | 2 |
| `work-task` | 8 | 16 |
| `bot` | 1 | 2 |
| `code-session` | 1 | 2 |
| Total | 11 | 22 |

- Immutable reference: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674/shots`.
  Comparator verified the frozen source, metadata and all 410 reference image hashes
  before/after capture. The 22 selected references retain their manifest identities.
- French, 1440×900 CSS viewport, device scale 2; images **2880×1800**.
  Browser Date **`2026-10-02T12:09:00.000Z`**, timezone **UTC**, real timers.
  Exact clock/render/reference policy matches the earlier
  [6d96535 comparison](../../current-full-followup/compare/README.md).
  The original freeze's browser timezone and mount clock remain unattested.
- Capture HEAD: `1076c2584941cf054efffaf709a149b4195bc1c4`, plus uncommitted correction.
  Hook SHA-256: `fde8193d44f8e943915b18a5b3dc074ef048dc1f37cd580f25db1f2bfab6ed34`.
  All **90 build members and both source pins** match the coordinator's copied
  [manifest](source-build-initial.json) in [before](build-before.json) and
  [after](build-after.json) checks. The **473-input** renderer fingerprint remained
  `cc5192cbaaf1f5ac8e5b12ee00ac5b41089ff93d8fe1276eb22d2431a1c3afe2`.
  All **20 served resources** match build-manifest members; this is a supplied-artifact
  binding, not a reproducible-build claim.
- One comparator invocation; exit **0**, completed `2026-10-03T07:56:10.933Z`.
  [Command/log](execution.json), [original provenance](provenance.json).
  The static server produced **64 recorded preview API 404s**; no other console/page
  error passed the comparator. No live engine was present in this comparison.

## Raw measurements

Pixelmatch's existing color threshold **0.15** is unchanged. No acceptance tolerance
was introduced. Every frame contains **5,184,000 pixels**. Frozen maximum:
**`chat-light`, 7,945 pixels / 0.15326003086419754%**. Raw mean:
**0.0263695987654321%**. None of the 22 frozen comparisons is exactly zero;
the original report's rounded `0` entries are nonzero.

| Frame | Frozen Δ pixels | Previous app Δ pixels | Previous app exact RGBA Δ pixels |
| --- | ---: | ---: | ---: |
| bot dark | 2591 | 1260 | 4791 |
| bot light | 727 | 2232 | 5789 |
| chat dark | 7759 | 3 | 145 |
| chat light | 7945 | 27 | 210 |
| code-session dark | 226 | 0 | 30 |
| code-session light | 216 | 18 | 3319 |
| work-task running dark | 402 | 128 | 898 |
| work-task running light | 404 | 8 | 653 |
| work-task computer dark | 735 | 9 | 586 |
| work-task computer light | 795 | 86 | 963 |
| work-task takeover dark | 241 | 0 | 183 |
| work-task takeover light | 265 | 0 | 194 |
| work-task approval dark | 353 | 0 | 207 |
| work-task approval light | 382 | 0 | 3 |
| work-task blocked dark | 1808 | 0 | 0 |
| work-task blocked light | 1930 | 0 | 1 |
| work-task done dark | 223 | 21373 | 112885 |
| work-task done light | 243 | 22896 | 115865 |
| work-task failed dark | 1076 | 0 | 154 |
| work-task failed light | 1114 | 0 | 0 |
| work-task paused dark | 301 | 0 | 205 |
| work-task paused light | 338 | 3 | 229 |

Previous app is the exact same named state from the fixed-clock **6d96535** run.
Both prior metadata files and all 66 selected prior PNG hashes were verified.
**Two** app PNGs are byte-identical: blocked dark, failed light. **Ten** comparisons
have zero threshold differences; eight of those still differ at exact RGBA level.
The largest prior-app difference is Done light: **22,896 pixels / 0.44166666666666665%**.
This older baseline includes intervening corrections; it does not isolate the hook change.

## Image review

- **Chat:** the two prose-line residuals are inherited. Both sampled prose/code regions
  `[1140,440,2460,1490]` are RGBA-identical to 6d96535; whole-frame prior differences
  lie around small mascots. The frozen wording/typographic residual is not waived.
- **Bot:** large/small mascot poses differ between real-timer samples. Activity,
  routines and memory rectangle `[800,640,2760,1560]` is RGBA-identical to both the
  reference and prior app in each theme. These are overview fixtures, not live Bot chats.
- **Code:** both right diff panes and static left transcript regions are RGBA-identical
  to reference and prior app. Small running-indicator/timer raster differences remain;
  Code light's prior whole-frame exact difference is not zero.
- **Work:** all eight states retain their visible panels, controls and wrapping.
  Existing blocked/failed copy residuals remain; running/computer samples include
  small mascot/indicator differences. Done's prior large delta is the separately
  [documented font-ready scroll correction](../../remote-auth-followup/compare/README.md):
  both current transcript rectangles `[1110,510,2440,1490]` are RGBA-exact to the
  frozen reference without translation. The earlier app rectangles match only after
  a **+2 image-pixel / +1 CSS-pixel** vertical sampling offset. No new DOM timing
  or causal reproduction was collected here.

[Regional diagnostics](regions.json) retain coordinates, exact hashes and counts;
they do not replace whole-frame scores. All 66 current full-resolution images, four
contact sheets and five additional prior outlier images were inspected.

## Retention and limits

Original `report.json`, `provenance.json` and `comparator-index.html` retain their bytes.
Original PNGs remain at `/tmp/opencode/live-state-compare-initial`; their **66 hashes,
byte sizes and dimensions** were verified. All 22 current diff buffers were reproduced.
The accessible [HTML path map](index.html) links all 66 full-resolution app/design/diff
images: **37 new lossless WebPs (13,360,832 bytes)** plus **29 verified existing tracked
RGBA-identical images**. Every mapped image decodes exactly to its original PNG;
four reduced contact sheets are overview aids only.

This is settled browser-preview evidence. Live snapshot/deletion races, native windows,
minimum-window behavior and continuous motion require their separate evidence.
No full-fidelity, live-engine or remote-inference acceptance is asserted.
