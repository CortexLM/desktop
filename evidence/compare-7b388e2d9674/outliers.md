# Cortex frozen-reference outlier review

**Three source-proven port differences:** Work preview does not update sidebar Bot activity; Code instructions lose the inline monospace styling; the first preview chat stays undimmed outside Chat. The largest differences also include intentional preview copy and unmatched capture state. **No threshold-based acceptance claim.**

## Evidence scope

- Input: `/tmp/opencode/desktop-compare-7b388e2d9674/{report.json,provenance.json,captures/}`. Read-only inspection; only this report written. No builds, recaptures, E2E, delegation, Mac access or retention-output inspection.
- Recorded: **431 captures, 410 comparisons, 21 reference gaps**. Mean of rounded per-row percentages: **0.05170731707317054%**; maximum **1.74%**. Pixelmatch's `0.15` parameter is a per-pixel color threshold, not a visual-acceptance percentage.
- Verified report SHA-256: `161d8a2de53bce65dbdc189181edba3317771ba25e43913e9ebc0826fc4be3f4`. Verified all **33 inspected PNG hashes**, dimensions **2880×1800**, copied-design hashes against each row's reference hash. Render viewport: 1440×900, scale 2, French.
- Independently recomputed all **473 source-file hashes from `5ced8aa1d2eb04ed3131ffb40c0d360e5706526d`**: fingerprint `c0572c874ec5c437aa59a1b24f8ed950ea22415df7be42d3b988b064a0f52d4c`, matching provenance. Recorded starting revision `08533dab9867fe60d951ac280e512fc6b361a681` remains authentic. This establishes source-byte equivalence, not build-to-source attestation.
- Reference source: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674/src/`. App source references below concern the captured `5ced8aa` snapshot; relevant TSX/catalog reads were checked against it, shared CSS read from that commit where current files differed. Ongoing narrow-window fixes are outside this review.

## Root causes

### `chat-states~long-dark` — 1.74%

**Capture scroll-state divergence; precise trigger unresolved.** The app transcript is **20 CSS px higher** than the reference: the “Critères retenus” heading falls above the visible thread. Header, composer and floating bottom control retain their positions. Paragraph widths, wrapping and section spacing agree after translating the transcript by 40 image pixels. The light counterpart is **0.02%** and shows the same heading in both images.

Both implementations initialize `scrollTop = 260` in a mount-only layout effect: app `screens/chat/states.tsx:320–337`; frozen `screens/lot-chat.tsx:519–533`. The long fixture matches the reference's `fr()`-normalized copy; relevant thread CSS agrees. Neither mount effect waits for fonts; both capture scripts wait for fonts afterwards. Mount/font layout and scroll anchoring are plausible contributors, not proven diagnoses. This pair does **not** demonstrate a ported 20px spacing defect. A matched settled-scroll check is needed before assigning a product fix.

### `components-dark/light` — 1.21% / 1.21%

**Intentional honest-preview copy dominates.** The added demonstration notice moves the table of contents and catalog down **24 CSS px**: `components.tsx:188`, `.cmp-demo-note` in `components.css:103` (8px top margin + 16px line). An interior titlebar-card rectangle is byte-identical after compensating for that displacement, in both themes.

Remaining visible content changes have explicit sources: the header drops a supplier attribution; `App.tsx` becomes the actual `shell/shell.tsx` source location; the thumbnail link says demonstration rather than new tab, matching its same-window preview navigation (`components.tsx:140,226–229`, French `components.json`). These are truthful integration/localization changes, not missing catalog blocks. The narrow theme thumbnail exists on both sides. No catalog geometry correction demonstrated beyond the shared sidebar-dimming defect below.

### `code-settings~instructions-dark/light` — 0.52% / 0.54%

**Genuine typography port defect, plus a minor fixture-space difference.** App `SetAgents` renders its lead via `rich()` (`screens/code/lot-code.tsx:831`); `screens/code/parts.tsx:24` emits an unstyled `<code>`. Frozen `screens/lot-code.tsx:1010` uses `<span className="mono">AGENTS.md</span>`; `.mono` explicitly selects Geist Mono at 11px. No `.code-lead code` rule restores those values.

The app's inline filename is visibly larger/different; subsequent lead text shifts horizontally. The editor and footer sit **1 CSS px lower**, consistent with the changed inline font/line box. Translating the editor upward two image pixels removes almost all of its difference. The text area's own `.code-agents` rule is identical. The 431-character fixture differs at only index 167: reference U+202F, app U+0020 before the migration-path colon. That localized whitespace explains a residual text difference, not the whole-editor shift. Restore the lead's explicit monospace styling; no broad editor spacing adjustment justified.

### `upload~uploading-light` — 0.51%

**Different timer samples, not a different upload algorithm.** App: **3/5 ready**, presentation completed, document **78%**, image **24%**. Reference: **2/5 ready**, presentation **94%**, document **64%**, image **18%**. Matching seed values and `pct + 3 + (id % 5)` every 160ms explain this exactly: the app is **two ticks / nominally 320ms ahead**. Crossing 100% also swaps the presentation's progress row for ready metadata/actions, shifting subsequent rows slightly.

Sources: app `screens/files/docs.tsx:587–600,669–684`, French `fixtures/files.json`; frozen `screens/lot-fichiers.tsx:630–641,644–660,699–711`. Both capture scripts use a wall-clock settle wait, not a pinned progress state; the app additionally waits for images/assets. Minor metadata spacing differs through localized size/percent formatting. No upload-layout or progress-logic fix demonstrated by this pair.

### `work-task~done-dark/light` — 0.44% / 0.47%

**Two distinct causes.**

1. **Transcript position:** app content is **1 CSS px lower**. A large rectangle covering the routine event, steps and recap is **byte-identical** in each theme after a two-image-pixel translation. The visible cards, labels and completed step values therefore agree within that checked region. Both sources scroll to `scrollHeight` in one `requestAnimationFrame` after mount/state changes: app `screens/work/home.tsx:264–268`; frozen `screens/lot-travail.tsx:266–270`. Relevant transcript/card CSS agrees. This isolates a scroll/layout-state offset; the exact timing/rounding cause is unproven. Do not compensate with card margins based on these captures.
2. **Genuine missing preview wiring:** sidebar still says “trie tes e-mails”; reference says “a relancé 5 devis”, with completed mascot state. Frozen `screens/lot-travail.tsx:272–280` publishes task status through `setLive` and restores background activity on exit. App `WorkTaskPreview` computes `state`/`doing` but never publishes them. `preview.tsx:28–38` seeds background work; `shell/shell.tsx:217` reads that shared state. This is a missed preview port, not honest live-engine data and not timer noise.

### `chat-dark/light` — 0.15% / 0.15%

**French typographic normalization dominates.** Frozen `screens/chat.tsx:32–33` uses ordinary spaces before the “teasing” and “lancement” colons. French `fixtures/chat.json:134–135` uses narrow no-break spaces. The diff begins at those colons and follows the horizontally displaced remainder of each line. The content, paragraph breaks, code block and overall transcript geometry agree. Both render paragraphs with the same split/map structure (`live-chat.tsx:167`; frozen `chat.tsx:99`). No chat-body port correction demonstrated.

## Corrections demonstrated by this inspection

These are fidelity findings, not a release verdict:

| Priority | Finding | Required correction before claiming parity |
| --- | --- | --- |
| P2 | Work done preview leaves stale sidebar activity/state | Publish the preview task's state/doing through the existing preview Bot context; restore background activity on exit. Keep it preview-only. |
| P3 | Code instruction lead loses `.mono` styling | Retain semantic markup if desired, but restore the frozen font family/11px styling for the inline filename. |
| P3 | First preview chat lacks route-dependent dimming | App `shell/shell.tsx:234` passes only `dim={c.dim}`; the first fixture has no `dim`. Frozen `App.tsx:231` dims it outside its selected conversation. Restore that conditional appearance. Visible in Components, Upload, Work and long-chat outliers; no need to change fixture content. |

The enabled shell Back button versus the frozen disabled placeholder is explained by native browser-history wiring (`shell/shell.tsx:33`; frozen `App.tsx:156`). Tiny mascot-pose/raster differences also remain. They do not explain the major outliers. Exact causes of all small residual shell pixels were not established.

## Full-resolution PNGs actually inspected

All filenames below are under:

`/tmp/opencode/desktop-compare-7b388e2d9674/captures/2026-10-02T13-37-48-050Z-4xScRl/`

| App | Design | Diff |
| --- | --- | --- |
| `chat-states~long-dark.app.png` | `chat-states~long-dark.design.png` | `chat-states~long-dark.diff.png` |
| `chat-states~long-light.app.png` | `chat-states~long-light.design.png` | `chat-states~long-light.diff.png` |
| `components-dark.app.png` | `components-dark.design.png` | `components-dark.diff.png` |
| `components-light.app.png` | `components-light.design.png` | `components-light.diff.png` |
| `code-settings~instructions-dark.app.png` | `code-settings~instructions-dark.design.png` | `code-settings~instructions-dark.diff.png` |
| `code-settings~instructions-light.app.png` | `code-settings~instructions-light.design.png` | `code-settings~instructions-light.diff.png` |
| `upload~uploading-light.app.png` | `upload~uploading-light.design.png` | `upload~uploading-light.diff.png` |
| `work-task~done-dark.app.png` | `work-task~done-dark.design.png` | `work-task~done-dark.diff.png` |
| `work-task~done-light.app.png` | `work-task~done-light.design.png` | `work-task~done-light.diff.png` |
| `chat-dark.app.png` | `chat-dark.design.png` | `chat-dark.diff.png` |
| `chat-light.app.png` | `chat-light.design.png` | `chat-light.diff.png` |

### Read-only offset checks

Coordinates are image pixels, half-open `[x0,y0,x1,y1]`. Compare app `(x,y)` with design `(x,y+dy)`; no files altered and no comparator percentages replaced.

| Region | Rectangle | `dy` | Result |
| --- | --- | ---: | --- |
| Long Chat, dark transcript | `[1160,490,2400,1410]` | +40 | 0 pixelmatch mismatches at the recorded 0.15 color threshold; 16,486 exact pixel differences remain. |
| Work done, each theme | `[1110,510,2440,1490]` | −2 | 1,303,400 pixels byte-identical per theme. |
| Code instructions, dark/light editor | `[1380,455,2610,1180]` | −2 | 601 / 611 pixelmatch mismatches remain; 1,428 exact pixel differences per theme. |
| Components, each theme, titlebar-card interior | `[835,590,1735,790]` | −48 | 180,000 pixels byte-identical per theme. |

These checks corroborate specific displacement explanations. They are not normalized acceptance scores. The 21 reference gaps remain gaps; this browser-preview inspection establishes neither native/live-engine behavior nor motion acceptance.
