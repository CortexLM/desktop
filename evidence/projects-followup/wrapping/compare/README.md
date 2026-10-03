# Wrapping correction — independent image delta audit

**Scoped pass:** no new blocking short-fixture layout shift identified in **18 comparisons / 18 references**, four routes.
Projects 6 + Project 8 + Library 2 + Chat 2; **14 Projects/Project theme-state renders**. Three prior/current contact sheets
inspected, four full-resolution originals: current creation light, overview light, empty light, previous empty light.
[Images](image-index.md) · [visual review](visual-review.json) · [metrics](metrics.json) · [summary](summary.json) · [verification](verification.json).

## Exact source and build binding

- Capture `2026-10-03T15:06:22.395Z–15:07:22.804Z` retains dirty base `8e3fd795b699c8ff07357544421d00f34dc2823c`.
  Later frozen receipt `f82a64800c0fffd6ebaa99e571a8af0fa4307095` has identical input/member payloads; all 515 inputs match that commit.
- **515 inputs / 90 build members / 473 renderer files / 24 served assets** verified against `/tmp/opencode/build-projects-wrap`.
  Renderer fingerprint `2230ff6f2deeee6b9d2b7eff21e96f152c193e15dfa824080721b3d1853d4464`.
- [Source delta](source.patch): **two CSS files, four rules, +4/-2**; 513 other inputs unchanged versus the [prior audit](../../compare/README.md).
  `packages/app/src/kit/styles.css`: `1f728575e54ab195b0efa61c80043b5300264c98ff0210934c475f183c893be1`.
  `packages/app/src/screens/system/system.css`: `f82f52986d0148715b3b596afde15018852a9e4821dac918237e249fb2f8ecbd`.
- [Build delta](source-build-delta.json): main/preload and **all 57 JavaScript assets byte-exact**; main JS filename changes only.
  Only bundled CSS content changes; HTML updates CSS href/JS src. 87 members retain both path and bytes.
- Same frozen `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`: 106 source hashes, metadata,
  all 18 selected reference hashes/mappings and 54 current PNGs checked. Earlier 410-image audit remains inherited, not repeated.
- Same French/`fr-FR`, **1440×900 / scale 2**, Date **2026-10-02T12:00:00.000Z / UTC**, real timers. All 18 current and
  prior pixelmatch results/diff hashes reproduce offline at color threshold 0.15. [Raw report](report.json)/[provenance](provenance.json) unchanged.

## Measured delta

Each image: 5,184,000 pixels. Table retains original rounded percentages; counts are exact. Δ lists threshold/raw RGBA pixels.

| State | Previous % / pixels | Current % / pixels | Δ threshold / raw |
| --- | ---: | ---: | ---: |
| `chat-dark` | 0.15 / 7759 | 0.15 / 7754 | 2 / 148 |
| `chat-light` | 0.15 / 7833 | 0.15 / 7904 | 139 / 2693 |
| `library-dark` | 0.01 / 280 | 0.00 / 249 | 32 / 199 |
| `library-light` | 0.01 / 273 | 0.00 / 224 | 44 / 225 |
| `projects~grid-dark` | 0.01 / 320 | 0.01 / 318 | 0 / 18 |
| `projects~grid-light` | 0.00 / 217 | 0.01 / 268 | 53 / 245 |
| `projects~empty-dark` | 0.01 / 663 | 0.01 / 634 | 28 / 605 |
| `projects~empty-light` | 0.02 / 985 | 0.00 / 75 | 910 / 17676 |
| `projects~create-dark` | 0.00 / 0 | 0.00 / 0 | 0 / 1426 |
| `projects~create-light` | 0.00 / 0 | 0.00 / 0 | 0 / 1252 |
| `project~overview-dark` | 0.00 / 215 | 0.00 / 225 | 10 / 285 |
| `project~overview-light` | 0.01 / 685 | 0.00 / 232 | 381 / 1159 |
| `project~files-dark` | 0.01 / 297 | 0.01 / 288 | 6 / 159 |
| `project~files-light` | 0.00 / 237 | 0.00 / 228 | 9 / 157 |
| `project~instructions-dark` | 0.00 / 252 | 0.01 / 289 | 38 / 212 |
| `project~instructions-light` | 0.01 / 285 | 0.01 / 296 | 0 / 147 |
| `project~sharing-dark` | 0.00 / 248 | 0.00 / 254 | 1 / 556 |
| `project~sharing-light` | 0.00 / 243 | 0.00 / 243 | 0 / 33 |

- Frozen maximum **Chat light 0.15246913580246912%**; Projects maximum **empty dark 0.012229938271604937%**.
  Same 18-row exact mean: 0.022282235939643347% prior / **0.020877271947873796% current**. Twelve rounded scores equal; six change.
- Largest prior/current delta: **empty light 910 pixels / 0.017554012345679014%**, 17,676 raw pixels. Full frames are never RGBA-exact;
  five pairs are threshold-equal only. No whole-image invariance claim or erased historical residual.
- Both creation interiors and preview tile/label are RGBA-exact against previous/frozen; `flex:1` introduces no short-label geometry shift.
  Overview chat/file column and Instructions card likewise exact. Library content and Chat prose/code match previous exactly.
- [Regional audit](regions.json): 12 content bodies are RGBA-exact; overview/sharing changes stay inside assigned Bot pixels,
  empty dark inside mascot pixels. Empty light differs in title/copy/button text raster; mascot equals previous. Its current title/copy
  now exactly match frozen pixels with identical descriptive ink bounds. Shell/back-button raster residuals remain; timing cause unproven.

## Retention and acceptance boundary
- [Retention](retained.json): **18 new RGBA-exact lossless WebPs**, 11,999,814 bytes; six verified canonical reference reuses.
  Twelve other references retain exact hashes/paths only. Three compact delta sheets; no repeated 36-image campaign or bulk triplets.
- [Raw gzip](raw-retention.json), [helper hashes](helpers.json), [SHA256SUMS](SHA256SUMS) preserve exact attribution; prior audit files untouched.
- Zero gaps in these 18 rows closes no earlier Home-menu/Appearance gap. Preview retains 20 `/api/projects` 404s; no other admitted console errors.
  Long-input/toast negative and confirmation evidence stays coordinator-owned. No new runtime, CI, ASAR/native or 960×640 acceptance.
- Offline existing-image review only; no source edit, test/build/capture, network/CI/Mac execution, commit or delegation.
