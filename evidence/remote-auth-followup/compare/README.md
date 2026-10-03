# Auth and native-correction preview comparison

**70 renders / 54 frozen comparisons / 16 explicit Settings gaps.** All 178 original
image hashes, dimensions and byte sizes verified; every comparison score and decoded
diff buffer independently reproduced. No new blocking layout shift found in this scope.
This run precedes the final asymmetric-diff minimum-height correction; its separate
committed-source [18-frame follow-up](final-code/README.md) preserves that boundary.

[Browse all frames](index.html). All 178 app/reference/diff PNGs are retained as
full-resolution, RGBA-verified **lossless WebPs: 68,607,600 bytes**. Three contact sheets
cover all 70 app states. `report.json` and `provenance.json` retain their original bytes.

## Coverage and measurements

| Family | Renders | References | Gaps |
| --- | ---: | ---: | ---: |
| Canvas | 10 | 10 | 0 |
| Code session | 2 | 2 | 0 |
| Code review | 6 | 6 | 0 |
| Code diff | 8 | 8 | 0 |
| Login | 10 | 10 | 0 |
| Settings | 18 | 2 | 16 |
| Work task | 16 | 16 | 0 |
| Total | 70 | 54 | 16 |

Maximum: `code-diff~conflict-light`, **3,495 pixels / 0.06741898148148148%**,
reported **0.07%**. Mean rounded score: **0.02111111111111111%**; mean raw score:
**0.02064936271147691%**. Pixelmatch's existing `0.15` color threshold is unchanged;
no percentage acceptance tolerance was introduced. Rounded **0.00% is not equality**.

| Selected frame | Different pixels | Raw percentage |
| --- | ---: | ---: |
| Code session dark / light | 230 / 213 | 0.0044367284 / 0.0041087963 |
| Login email dark / light | 215 / 224 | 0.0041473765 / 0.0043209877 |
| Login code dark / light | 2460 / 2542 | 0.0474537037 / 0.0490354938 |
| Login error dark / light | 2472 / 2566 | 0.0476851852 / 0.0494984568 |
| Work Done dark / light | 223 / 235 | 0.0043016975 / 0.0045331790 |

Both Done transcript rectangles **`[1110,510,2440,1490]`**, 1,303,400 pixels each,
are byte-identical to the frozen reference without translation. Whole-frame residuals
remain; this image-only audit collected no new DOM scroll telemetry.

## Visual findings and previous-run comparison

[Pixel verification](pixel-verification.json) binds each row to its previous app capture:
36 matching rows use the recovery 749bc0c run; the other 34 use the earlier full
fixed-clock 6d96535 run. Both prior reports and all 70 selected prior app hashes were
verified. Prior captures remain independent evidence, never replacement references.

- **Login:** email/code/error geometry remains aligned in both themes. Their sampled
  main-content region has zero threshold differences from the prior app frames;
  email/error are exact there, code has 176 below-threshold pixels. Frozen residuals
  remain in localized lead/email text and shell labels. Loading includes animation
  timing; locked includes mascot pose. New `maxLength` and live-auth handlers create
  no demonstrated preview-layout shift, but these fixtures do not exercise sign-in.
- **Code:** every one of the eight Code Diff app images is byte-identical to its prior
  full-run app image. Conflict's maximum is therefore an existing frozen-reference
  residual, including wrapped explanatory text. Code Session's sampled content has
  zero threshold differences from the prior app capture. Code Review retains existing
  risk-summary wrapping; applied/approved have small mascot/animation differences.
- **Canvas Code:** editor bounds/lines stay aligned. The frozen code-expression line
  residual is inherited; sampled previous-app content has zero threshold differences.
- **Work Done:** corrected unshifted transcript remains exact. Running/approval residuals
  are concentrated on small mascot/animation regions; no new whole-pane offset observed.
- **Settings General:** sampled prior-app content is byte-identical. Existing added
  navigation/shell differences remain. Connection, Account and Providers were also
  inspected at full size, but have **no frozen reference**; wide preview stills do not
  prove live auth status, write recovery or narrow-pane behavior.
- Only two rounded scores changed against the selected previous reports:
  `canvas~generation-light` **0.01→0.03%**, `work-task~takeover-dark` **0.00→0.01%**.
  Canvas visibly contains a different partial streamed-text endpoint and skeleton phase;
  its live timers are not fixed. Takeover's sampled main-content region has zero
  threshold differences from the prior app. Neither result establishes a new layout
  regression; all original residuals remain recorded.

60/70 sampled prior-app content regions `[754,260,2780,1560]` have zero threshold
differences. The ten others were inspected: Canvas generation light; Code review
applied/approved both themes; Login loading both themes; Work running both themes;
Work approval light. This statistic is regional, not whole-frame parity.

Inspection scope: all 70 thumbnails; **37 full-resolution triplets / 111 images**:
all Login, Code Session, Code Review and Code Diff; Canvas Code both themes and
generation light; Work Done/running both themes, approval light, takeover dark;
Settings General both themes. Plus six gap app images (Connection/Account/Providers
both themes) and the earlier Canvas generation-light app image. Other frames were
hash-verified and reviewed as thumbnails, not individually full size.

## Captured source and asset binding

| Item | Pin |
| --- | --- |
| HEAD during capture | `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874` plus uncommitted changes |
| Captured renderer inputs, 473 files | `815a49910bce8e35d2a48e6a3f3f03162d8cbf56ca41c4f58b5d0947c6902614` |
| Report SHA-256 | `b69c42e4605198c2e390fc021073ce3d75454d7b1c2f62dce3b50cfbb79fc3e1` |
| Provenance SHA-256 | `d41259b077bb8bf81cb2cfde02de690725f5eb8282c4c2e5b9f41cd25f12dc29` |
| Frozen source, 106 files | `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768` |
| Comparator SHA-256 | `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6` |
| Served asset ledger, 29 files | `a015191c40da2f8720a2b2456ac3fbeed6511328b6227d8422422c3c0e92ca32` |
| Captured CSS bytes | `6a94564e234b0993ce9b2649dcd48e726c7d7c908204ac07656d73cdff88e2ae` |

The capture completed `2026-10-03T03:43:21.769Z`, run
`2026-10-03T03-39-51-453Z-XhFJlD`. During review the working tree already contained
the later 70px minimum and parent-overflow rule. Removing only those additions in a
temporary in-memory reconstruction recovered the **exact recorded 473-file fingerprint**.
The [manifest](source-manifest.json) and [lossless archived source delta](captured-source-delta.patch.gz)
bind the snapshot; [compression receipt](captured-source-delta.json) preserves both
original-patch and gzip hashes. Sixteen inputs differ from b0e6d78. This is not a
claim that b0e6d78 alone, the current working tree, or a future commit produced these frames.

All frozen metadata/410 reference PNG hashes were checked; the 54 used references match
their manifest records. All 29 served assets were re-fetched and hash-verified before
the coordinator's later build. Source and served assets remain separate facts, not
a reproducible-build attestation. The [verification receipt](verification.json) records
details; [retention map](retained.json) binds every original PNG to its lossless WebP.

## Limits and final follow-up

French, 1440×900 CSS viewport, scale 2; fixed browser Date
`2026-10-02T12:09:00.000Z`, UTC, **real timers**. This matches earlier controlled
reruns; the frozen reference's actual mount Date/timezone remains unattested.
There are **236 separately recorded preview API transport errors**. These frames
prove no live engine/backend availability, native chrome, authenticated inference,
continuous motion, minimum-window behavior or complete localization acceptance.

The sixteen gaps are eight extra Settings sections × two themes: appearance,
providers, connection, bot, notifications, privacy, shortcuts, account. None receives
a substitute reference or score. The invalid initial `--only` selection containing
`code-editor` failed at route validation **before capture**; [original log](before-invalid-route.log)
is retained as a configuration/input failure, not a product failure. A numeric review
attempt hit its 120-second tool timeout; the longer offline pass completed with all
assertions intact. No capture was rerun by this reviewer.

The later [final-code receipt](final-code/README.md) verifies 18 new comparisons at
committed `ffc118a2e58df66f430f3078e00f6e931dd910cf`, including the final CSS minimum.
Its 473-file Git-blob fingerprint differs from this snapshot **only in `styles.css`**.
These two runs are retained separately; the 70-row report is not relabeled as final-source
acceptance. CI/native/live acceptance remains outside this image audit. Audit scripts
and numeric logs remain under `/tmp/reviewfinal/`; no build, source edit, native operation,
CI action or commit was performed.
