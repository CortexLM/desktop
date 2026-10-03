# Frozen reference and historical comparison status

## Active direction

The 3 October user correction names `/root/cortex-ui/review/ACTIVE-DIRECTION.md` as the
current design direction: Cortex UI with its existing Base UI/shared kit. Retired board
approval no longer gates existing owner work. Historical freezes/captures below retain
their source-specific meaning; they are not instructions to recreate boards.
The request90 reuse map permits effort/replay motifs as design inputs. The design owner
will complete stored-thread model, one-off model, limited history, image-history refusal
and continuation ownership within Chat/Settings. Product import retains exact-state/source
review; the Code supplement's scoped prototype acceptance does not authorize product import.

## Delivered source freeze

The design owner delivered `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674` on 2026-10-02.
Its 106 source files independently reproduce fingerprint
`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768` using `shoot.mjs`'s
sorted `relative path:SHA-256` algorithm. Preview: `http://127.0.0.1:5198`.

Home reviews `review-home-A7-final.md` and `review-home-B7-final.md` give 10/10 on their
verified/inherited scope. They retain unavailable original-reference fidelity and multi-turn
preview persistence limits. This is not approval of every product screen. Components is
delivered with 12 sections, 94 blocks, 30 motion entries, 31 real-screen families, 80 glyphs
and 19 accessories; at most three screen-preview iframes mount simultaneously.

Source integration uses this freeze. Frozen screenshot/sequence provenance must be checked
before each comparison; live mixed-revision shots are not accepted substitutes. Missing
Space, Scheduled, Plugins & skills and platform/auth/stream-control designs remain live drafts
until the design owner delivers their routes, variants and approval.

Independent artifact read-back at 12:15:32 UTC verifies 410/410 registered screenshots and
44/44 sequence/theme boards (220 frames), without missing, duplicate or mismatched hashes.
The owner subsequently finalized `freeze.json.captures`: 410 images, 205 comparison plates,
44 sequences, 220 motion frames, status `passed`. Its coverage manifest now exists; source
and image hashes establish capture provenance, not global design approval.
Sequence frames independently replay each action; their delays do not measure continuous motion.
The fingerprint covers `src/`, not public assets, dependencies or capture configuration.
The desktop comparison's 431 jobs therefore have 410 frozen references and 21 missing images:
16 extra Settings renders plus five clicked extras. Older PNGs cannot fill those gaps.

The [completed frozen run](../compare-7b388e2d9674/README.md) at `5ced8aa`-equivalent source
records 410 comparisons, mean 0.0517%, maximum 1.74%. All 431 renders have per-row hashes;
21 reference gaps remain explicit. This establishes comparison provenance, not global approval.

The sections below retain the earlier reconciliation against application
`0e63f876bbe3d0fe893c6c698ff3fadb6dcec702`. The old `report.json` is not a comparison of the
new integration against the freeze.

## Registry counts

Both have the same 61 routes. The other 60 routes contain 204 matching states and design
variant IDs. Reference Settings registers one state; the app registers nine. Therefore
205 reference states versus 213 app states is entirely explained by Settings:

| App Settings variant | Reference evidence |
| --- | --- |
| `general` | Registered `settings` route |
| `appearance` | Clicked section; `settings-apparence-{light,dark}.png` |
| `shortcuts` | Clicked section; `settings-raccourcis-{light,dark}.png` |
| `account` | Clicked section; `settings-compte-{light,dark}.png` |
| `bot`, `notifications`, `privacy` | Existing clicked sections; no dedicated shots |
| `providers`, `connection` | App controls; design requests unanswered |

The later `9d704ee` correction only wraps the existing provider key row in narrow panes;
960/1024/1440 both-theme geometry and captures are recorded in
[the provider follow-up](../mcp-followup/provider-layout.md). The 1440px row stays inline.
There is still no approved frozen Providers image to pixel-compare; the scoped correction
does not close that reference gap or import the newer Platform draft.

Source: reference `src/screens/pages.tsx:141–227`; app
`packages/app/src/screens/system/index.tsx:27–30`. Counts do not establish live functionality.

## Drift observed at 0e63f87

- Reference Activity icon is `mentions`; app uses `bell`.
- Reference Home suggestion glyphs are 16 px, gap 16 px, horizontal padding 5 px;
  app uses 20 px, 12 px and 3 px. The refreshed Home screenshots show these differences.
- Reference composer gained a separate capsule, typed-state contraction and detached send
  button. App keeps the earlier composer treatment.
- Reference sidebar/theme/focus changes include bottom fade/padding, a theme ring,
  arrow-key navigation and `inert` hidden regions. App carries the earlier behavior.
- Reference Undo uses `Toast.Action`; app uses the earlier `Toast.Close` primitive.
- Reference Components now has 12 sections, 30 motion entries and 31 family definitions
  observed in source; the app has 14 earlier static blocks and 12 motion entries. Its old
  reference PNG matching 0.00% does not establish current-source parity.
- Reference's 610 ms segmented-navigation delay was still under review at that snapshot;
  it is present in the subsequently delivered freeze.

Reference paths: `src/App.tsx`, `src/styles.css`, `src/ui.tsx`,
`src/screens/{chat,components}.tsx`; acceptance notes in `review/acceptance-status.md`.

## Historical coverage limits

The earlier status summary said A6/B6 pending; the actual reports and delivered A7-final/B7-final
supersede that stale summary. Historical 205-state coverage distinguishes 61 motif references and 144 shell-only references,
all `unproven`; this is not certification of full-screen content. That coverage already
predates refreshed Home/Notifications image hashes and current source fingerprints.

The source freeze and Components scope have since arrived. Matching frozen shots/coverage,
integration checks and missing-surface delivery remain separate acceptance requirements.
Historical `report.json` remains a mixed-revision pixel comparison, not complete visual or
interaction acceptance.

## Subsequent interaction corrections

The follow-up adopts `inert` for hidden chrome/sidebar/project rows, arrow/Home/End theme
navigation, reduced-motion theme changes and `Toast.Action` Undo. Frozen shell integration
adds vertical theme motion, appearance-aware System glyph, mode-switch feedback, sidebar
fade/spacing, segmented motion and capsule composer geometry. Targeted Electron assertions
cover keyboard and final motion states. The completed frozen comparison is linked above;
the [outlier disposition](../compare-7b388e2d9674/outliers.md) separates intentional copy,
unmatched scroll/timer samples and three source-proven port differences. Their subsequent
[corrections](../fidelity-followup/README.md) preserve this run's original scores.

## Later correction and integration receipts

Latest scoped handoff confirms **all 63 historical corrective units**, including M02 on
`5daa8d29` with A's 36 and B's 60 checks. This resolves the earlier count/repair discrepancy
recorded in [handoff-correction.json](../recovery-followup/handoff-correction.json); that receipt
remains historical. [Scoped closure readback](../recovery-followup/scoped-design-closures.md)
records the named pins and limits. Whole-page acceptance and the approved unified package
remain pending.
Final independent reconciliation confirms the quoted `10744dc` ledger prefix already contained
63/5/8/9 scoped closures: **85 defect units, not pages**. The 59/3/1 current-status interpretation
is superseded; original negative suites remain unchanged. Attachment retention and G4's three
new layout requests remain outside those closures.
Author counts (48 confirmations, 32 consolidated Work cases, 47 Readers/Code actions and
92 renders) remain separate. This readback does not rerun the 63 corrective journeys.
The [bounded desktop crosswalk](../recovery-followup/corrected-reference-map.md) identifies
existing overlap and five remaining candidates: M01 command-model handoff, M21 preview image
prompt retention, M11 first Work-task identity, M02 specialist identity and M05 Code-task
identity. These are anchored static mismatches, not new runtime-test results or blanket
authorization to import live design sources. M02's reference correction is closed at its pin;
desktop's distinct preview-specialist identity gap remains an integration candidate.

[Read-only delivery verification](../recovery-followup/design-update-receipt.json) records
the separate `bd0a487691a4` / 5609 prototype: 163 source hashes, 26 stored integration checks,
18 image hashes, 116 routes and 117 catalogue families. Later 5610 receipts bind 26 navigation
checks/18 images and 16 public-host configurations/images to 165 source files. They do not
retroactively test the older build.

The later `d814599e9654` candidate's read-only verifier passes 1,574 source/asset/config inputs,
1,399 build files and five served resources. Its stored receipts cover 26 navigation checks,
16 public-host configurations, 43 Security checks and bounded gallery previews. This is a
prototype assembly, not an Electron build or whole-page approval. Subsequent live changes
retain their own pins. The original `7b388e2d9674` reference remains immutable.
The complete `3eeb6235` candidate on `35647` is also verified: 1,574 inputs, 1,399 outputs,
342 exact reused compiler files, 1,057 restored documentary files and nine HTTP resources.
Its saved gallery/registry checks are separate from the prior 48-image gallery and the later
`da5fd54b` residual correction. [Package attribution](../recovery-followup/scoped-design-closures.md#complete-predecessor-package--3eeb6235--35647).

Two new glyphs (`plug-zap`, `settings-2`) have matching raw/normalized/installed hashes and
four verified proof images. The design inventory is **121 SVG files, 124 usable names,
125 catalogue samples** (four HAND entries, one overriding `system`). Desktop's frozen icon
set is not reattributed to that inventory.
All 45 additions remain separately delivered assets; `settings-2` belongs to the two-rail
preferences request. Their usability does not authorize the associated prototype layouts.

The corrected Public pin is separately verified: **511 source files, 342 build artifacts,
151 recorded passing checks and 14 image hashes**. This read-only validation does not rerun
browser journeys. PUBLIC A1–A5 and all eight Product groups now have two scoped confirmations.
Product's MCP promise is limited to recognized credential formats and stated field boundaries;
an empty registry blocks selection until explicit demo entry. The later `79f725c9` Productivity
file differs by exactly eight French display-string substitutions, verified byte-for-byte;
earlier four-source captures retain their `41545` pin. Final package approval remains pending.

The independent iOS **web** reference `bbf640ff95cc` passes its read-only freeze verifier:
278 source files, 954 1179×2556 PNGs, 3,816 recorded browser views. Twenty-two checks confirm
**three** scoped corrections, with 41 retained review artifacts verified. It does not certify
native iPhone behavior or replace desktop's reference. Two independent per-route reviews are
reported underway; no results are inferred. G3 SDK reconciliation remains pending.
