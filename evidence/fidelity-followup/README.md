# Frozen-source fidelity corrections

Application revision: `dc7f529f7a3cce2b375881436ba5a7dae4999c3a`.

The independent [outlier review](../compare-7b388e2d9674/outliers.md) found three concrete
differences, now corrected:

- Work task previews publish their activity/state to the shared sidebar Bot. Leaving restores
  prior background activity, preserving explicit pause, appearance, drafts and live boundaries.
- The Code instructions lead restores semantic inline code in Geist Mono at 11px.
- The first preview conversation dims outside its selected fixture conversation, including
  same-URL personal conversation history.

Targeted Electron checks: 14 passed. `compare/` contains 64 new renders, 62 frozen comparisons,
two explicit Home-menu gaps; 24 selected application/reference/diff images are retained as
verified pixel-identical WebP. Two contact sheets were inspected. Source fingerprint:
`37cc83b15d76b98152e337964efaeb09848cbef0270e81e0bbbd6baf549e15be`.

Code instructions now differ by **0.02%** in each theme (previously 0.52–0.54%). Home rounds
to **0.00%**. Work done still differs by 0.42–0.45%, largely the previously isolated one-pixel
scroll offset. Long Chat remains 1.73% with a 20px scroll-state difference. Components' explicit
demonstration notice remains an intentional 24px layout shift. No normalized score or global
parity claim replaces these measured differences. The [six-run scroll diagnostic](long-scroll.md)
proves fallback-font reflow triggers 20px Chromium scroll anchoring in both implementations;
matching post-font scroll positions yields matching sampled geometry. It does not reconstruct
the original capture's exact scheduling or replace its raw difference score.
Saved measurements can be checked with `node evidence/fidelity-followup/scroll-diagnostic/check.mjs`.
The original diagnostic summary preserves hashes of its temporary PNGs; those PNGs are not
retained here. The committed check reads only the six retained measurement records.

The first integrated run found shared Electron profile preferences leaking French into an
English keyboard case. The fixture now passes a unique `--user-data-dir` per engine data
directory. Engine isolation alone had not isolated locale/theme/model preferences.
Final local verification: **46/46 Electron cases**, 426 registered renders, zero retries/flaky/skips;
131 unit passes plus one optional backend skip; lint/types/i18n and packaged Linux smoke pass.
All 473 renderer-related files match the recorded source fingerprint and this application commit.
Forty-four renderer screenshots from the final passing suite are retained with hashes;
both contact sheets were inspected. An independent launch read-back confirmed Electron's
`userData` resolves to its per-test profile directory.

CI 37024188829 failed one responsive test on each OS despite the local pass. Mac sampled
pre-resize geometry; Linux evaluated an old control during React route replacement. The
failure screenshots show the eventual correct layout. A test-only readiness correction
waits for renderer width/column positions and detachment of the previous screen.
That test-only correction is `8b90a8e`; all eight responsive cases pass locally. Application
source remains byte-identical to `dc7f529`; CI 37025236580 is the fresh verification run.

[CI 37025236580](https://github.com/CortexLM/desktop/actions/runs/37025236580) passes:
**46/46 Electron cases per Linux/macOS**, zero retries/flaky/skips, lint/types/131 units
(one optional backend skip)/i18n, unsigned macOS packaging and launch smoke; CodeQL passes.
[Installed Mac corrections](../mac/8b90a8e/README.md) add twelve native captures at 960×640,
both themes, plus recovery assertions. Their capture-clock limits are explicit.
[Final CI screenshot review](ci-review.md) found two additional existing defects: toasts
cover nested Work/wide-Chat composers, and never-started Work tasks claim Done. Their
[subsequent correction](../recovery-followup/README.md) is recorded separately; this revision's
passing assertions did not cover them.
