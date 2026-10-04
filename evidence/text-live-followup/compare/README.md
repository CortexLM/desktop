# Saved text — preserved-preview comparison audit

**Scoped static PASS:** 13 supplied captures, 12 frozen comparisons, one explicit Ask gap; no new visible blocking P2.
Two contact sheets and all **13 application +12 reference originals** inspected at full size.
[Image ledger](image-index.md) · [exact metrics](metrics.json) · [visual findings](visual-review.json) · [summary](summary.json).

## Source/build binding
- Original run `2026-10-03T23-48-56-219Z-LGqZib`; frames captured `23:48:59.010Z–23:49:42.699Z`, served from production on `127.0.0.1:5434`.
- Dirty base **`f2c1bc828d2eb64fbe0792031c2e33de63c54957`** remains dirty attribution. No later Git commit, CI or native authority is assigned.
- All **524 frozen inputs** match their receipts and current files at audit; exact path inventories verified. **482 renderer inputs**, fingerprint **`e19de38f6a5cd68b770c9a960bc9e9e62e5e88b27885602c3a6b8e6845354c4b`**.
- All **90 build members /20 served-asset receipts** match captured production bytes, including HTML, main JS/CSS, locale chunks, fonts and images. [Binding](binding/verified.json), [build log](binding/build.log).
- Original receipts were copied before verification; [final check](final-check.json) records end-of-audit source equality separately. A future source delta requires new attribution.
- Versus the dirty base: **4 added +13 changed /507 unchanged inputs**. `media.tsx` (CodeScreen/ImageScreen), PreviewChat function and ChatStates remain byte-identical. [Source delta](binding/source-delta.json), [patch](binding/source.patch).
- Existing Files CSS, including all image/preview rules, is byte-identical after removing only 14 new text-specific rules. Chat additions style only the live text Open card; preview/shot dispatch still invokes incumbent CodeScreen/ImageScreen.
- Frozen source **`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`** verified: 106 sources, 205 states, 410 original PNG hashes, manifest/registry/coverage/motion metadata and 12 exact selected mappings.
- French/`fr-FR`, 1440×900 CSS pixels, DPR 2. Fixed Date `2026-10-02T12:00:00.000Z`, UTC; timers real. Frozen timezone/mount Date remain unattested.
- All **37 supplied PNGs** pass decoding/CRC/hash checks; all **12 original pixelmatch counts and diff PNG bytes** reproduce exactly at threshold **0.15**, with no masking, shifting or tolerance changes.

## Every row
Each frame contains 5,184,000 pixels. Percentages are original rounded values; counts are exact.

| State | Frozen % / differing pixels | Prior image-delivery threshold / raw pixels |
| --- | ---: | ---: |
| `chat-dark` | 0.15 /7751 | 45 /255 |
| `chat-light` | 0.15 /7915 | 0 /16 |
| `file-image~view-dark` | 0.01 /340 | 229 /4087 |
| `file-image~view-light` | 0.01 /294 | 7 /163 |
| `file-image~zoom-dark` | 0.01 /603 | 31 /189 |
| `file-image~zoom-light` | 0.02 /872 | 42 /219 |
| `file-image~compare-dark` | 0.04 /2103 | 2 /50 |
| `file-image~compare-light` | 0.04 /2254 | 11 /165 |
| `file-code~view-dark` | 0.01 /267 | Not in prior image scope |
| `file-code~view-light` | 0.01 /292 | Not in prior image scope |
| `file-code~diff-dark` | 0.00 /198 | Not in prior image scope |
| `file-code~diff-light` | 0.00 /208 | Not in prior image scope |
| `file-image+ask-light` | **No reference** | 0 /257 |

- Maximum exact whole-frame difference: **0.15268132716049382%** (Chat light). Rounded zero does not mean RGBA equality; all twelve whole frames retain nonzero differences.
- Four Code main interiors `[754,150,2790,1690]` are **RGBA-exact to frozen**: header, metadata, gutter, code/diff rows, minimap and controls retain geometry in both themes. Their larger content partitions retain only141/189 raw bottom-edge pixels, zero threshold differences.
- Six Image content rectangles `[754,150,2880,1800]` are **RGBA-exact to the prior image delivery**. Frozen View content has zero threshold differences; Zoom385/602 and Compare1821/1936 content pixels are inherited residuals.
- Both Chat transcript/code crops `[1150,430,2460,1080]` are **RGBA-exact to prior**. Remaining prior content changes are36/2 raw mascot-area pixels, zero threshold differences. [Unshifted crop receipts](regions.json).
- Chat retains inherited French punctuation-space differences versus frozen; remaining shell/raster differences stay recorded without an invented timing/font cause. None of the nine prior whole frames is RGBA-exact to current.
- Ask is readable in the supplied frame but has no matching frozen reference; it earns no design-fidelity credit. Ordinary Chat only was captured, not uploaded/selected attachment preview states.

## Retention and limits
- **17 new lossless WebPs /17,178,816 bytes**, **8 exact historical reference reuses**, all25 decoded RGBA payloads verified. Nine prior app images were compared; none qualified for full-frame reuse. [Retention](retained.json), [original PNG hashes](original-images.json).
- Original report/provenance/logs remain intact; archived comparator/reference metadata and executable offline audit helpers support reproduction. [Verification](verification.json), [helpers](helpers.json), [SHA256SUMS](SHA256SUMS).
- 52 expected static-host `/api/*`404 receipts remain in provenance; comparator asserts no other console/page errors. Offline audit made no requests.
- User-supplied light/dark Code images correspond to the approved frozen `file-code~affichage` reference already reviewed; this run preserves that preview. New live plaintext has no formal golden here: source-level frame/type/gutter consistency is not pixel-perfect or live-render acceptance.
- Live text behavior, full Electron regression, minimum windows/locales, motion, Git/CI/package binding and installed-native acceptance remain separately owned. This audit establishes none of them.
- No application changes, new captures, tests, builds, engine/device/network/CI actions, commits or delegation; writes confined to this directory and `/tmp/opencode/text-compare-audit`.
