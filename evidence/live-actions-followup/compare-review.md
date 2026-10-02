# Cortex live-actions frozen comparison review

**Finding: capture-clock determinism defect. The large Work outliers are dominated by time-selected wallpaper, not a demonstrated regression from the new live actions. They remain outliers, not approved gaps.**

## Verified evidence
- Run: `/tmp/opencode/live-actions-compare`, `2026-10-02T23-44-44-180Z-2tKDDK`; 32 captures, 32 references, zero gaps. Search maximum 0.03%; AutomationEditor maximum 0.06%.
- Report SHA-256 verified: `20848f9030d8699fe2fce3a475d553ced0ec513e5fea4a0053e1c633b4577996`.
- Verified all 96 PNG hashes, byte lengths, 2880×1800 dimensions; all 32 reference records/images against the frozen manifest; five frozen metadata hashes; comparator hash.
- Recomputed all 32 percentages and saved diff RGBA buffers exactly at the original pixelmatch threshold 0.15. No images or comparison records rewritten.
- Frozen authority: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674`; independently recomputed 106-file source fingerprint `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`.
- Current 473-file application fingerprint matches recorded `78e91a2c0392e17b1ff128b37ad333481298f3c4efca8538633c1513b8098a63`. The run records base revision `f7900564b4d0d9e193b0e3a97b899b2a79276019` plus the working-tree fingerprint; it is not a clean-commit source assertion.
- Served-asset aggregate verified; all 20 recorded asset files match local `packages/app/dist` byte-for-byte. Source/served-asset provenance remains separate, without build-to-source attestation.

## Concrete cause
- Visually inspected app/design/diff triplets for `work-task~computer-{dark,light}` and `work-task~takeover-{dark,light}` in the run's `captures/` directory.
- New simulated-desktop menubars read **23:45**, displaying purple star/dune wallpaper. Frozen menubars read **12:09**, displaying teal waves. CRM geometry/content stays aligned.
- `packages/app/src/screens/work/home.tsx:193,204,219–220`: `new Date().getHours()` selects `crepuscule` before 07:00 or from 21:00, `lagon` from 11:00–17:59; the same clock renders the menu time.
- Matching frozen implementation: `src/screens/lot-travail.tsx:206,216,230–231`. Both use the identical hour-selection rule. Relevant `.travail-pc`, menubar, window and takeover CSS also matches (`work.css:122–125,148–150`; frozen `lot-travail.css`, same lines).
- `crepuscule.png` and `lagon.png` bytes match across application public assets, captured dist and frozen public assets. This is a selected-image change, not replacement asset content.
- `scripts/compare-shots.mjs:141–144,190–193` and frozen `shoot.mjs:22,65–77` set locale/viewport and wait 1100 ms, but do not fix browser clock/timezone. Waiting longer cannot align daytime wallpaper with a nighttime capture.
- `git diff f790056 -- packages/app/src/screens/work/home.tsx` contains exactly three added lines in `WorkTaskLive` options. All bytes preceding `WorkTaskLive`, including `BotComputer` and `WorkTaskPreview`, match `f790056`. `WorkTask` selects the preview branch for these shots (`home.tsx:260–263`).

## Pixel localization
Rectangles below are image pixels, half-open `[x0,y0,x1,y1]`; no masking or replacement acceptance score.

| State | Report % | Differing pixels | Inside simulated-desktop rectangle | Outside |
| --- | ---: | ---: | ---: | ---: |
| computer-dark | 3.68 | 190,699 | 189,967 (99.62%) | 732 |
| computer-light | 3.68 | 190,725 | 189,947 (99.59%) | 778 |
| takeover-dark | 8.18 | 424,290 | 424,049 (99.94%) | 241 |
| takeover-light | 8.19 | 424,474 | 424,209 (99.94%) | 265 |

- Desktop rectangles: computer `[1750,350,2768,1646]`; takeover `[777,365,2769,1708]`. Diff pixels concentrate around the CRM window, including wallpaper-backed menubar/shadows.
- CRM interior is **byte-identical in both themes**: computer `[1828,541,2688,1510]` (833,340 pixels); takeover `[910,558,2630,1570]` (1,740,640 pixels). Large-area cursor/layout drift is not the demonstrated cause.
- Small residuals remain: shell Back enablement, labels/mascots, plus computer transcript typography. App French fixture uses ordinary space before `?` (`locales/fr/fixtures/work.json:155`); frozen JSX uses `&#8239;` (`lot-travail.tsx:299`), matching the localized `? Je reste` diff. Other residual pixels are not fully attributed.

## Historical comparison and disposition
- Historical `evidence/compare-7b388e2d9674/report.json` hash verified: `161d8a2de53bce65dbdc189181edba3317771ba25e43913e9ebc0826fc4be3f4`. Its overall maximum remains 1.74%; these exact rows were computer 0.05%/0.05%, takeover 0.03%/0.03%.
- Historical 12 outlier PNG hashes verified under `/tmp/opencode/desktop-compare-7b388e2d9674`; inspected computer-light/takeover-dark app PNGs show **13:57** and teal wallpaper. Both historical app and frozen reference were inside the same `lagon` interval. `5ced8aa` source already has the identical hour rule.
- Preserve all four new outliers and original provenance. Flag the uncontrolled capture clock as a comparison defect; zero missing references does not mean visual acceptance. No increased thresholds or waived regions.
- Future coordinator follow-up: pin browser wall clock/timezone to the reference state in a separately recorded comparison, retaining this original run. Current evidence establishes the dominant delta; it does not approve all residuals or prove live/native behavior.
- Review-only: wrote this report; no application/source changes, build, recapture, test suite, CI, Mac access, live design-owner access or delegation.
