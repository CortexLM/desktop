# Narrow preview findings — ffc118a runtime follow-up

## Result

**One confirmed narrow-layout correction: Code Settings → Approvals text flow.** DOCX Comments and side-by-side diff content are reachable by horizontal wheel and keyboard at both requested narrow sizes. Their original screenshots showed initial scroll positions, not unreachable content.

| Case | 960×640, light/dark | 1024×686, light/dark | Disposition |
| --- | --- | --- | --- |
| DOCX Comments | Comments initially offscreen; wheel and Tab reveal comments/Reply | Comments initially clipped; wheel and Tab reveal comments/Reply | Recoverable viewer scrolling; no required correction established |
| Code Settings → Approvals | Titles/descriptions join; default-model description overlaps its control | Titles/descriptions join | Confirmed text-layout defect |
| Code diff → Side by side | Both columns' longest-line endpoints reached with wheel; ArrowRight reveals right column | Same | Narrow scrolling works; no narrow correction needed |

At 1440×900, diff columns both appear initially, but their longest lines are ellipsized and cannot be recovered by horizontal scrolling. This is inherited wide-layout behavior, separate from the disproved narrow-unreachable concern.

## Execution and scope

- Revision before/after: `ffc118a2e58df66f430f3078e00f6e931dd910cf`.
- Existing desktop build, **Electron 44.5.1 / Chromium 152.0.7977.130**, independent Linux Xvfb, real preload and `data-host="desktop"`. Renderer loaded from `http://127.0.0.1:5309/` via `CORTEX_RENDERER_URL`.
- `BrowserWindow.setContentSize` produced exact measured `innerWidth/innerHeight` and `.window` sizes: 960×640, 1024×686, 1440×900. No web desk margin subtraction, iframe scaling or emulated desktop bridge.
- Only `file-docx?shot&v=comments`, `code-settings?shot&v=approvals`, `code-diff?shot&v=split`; English, light/dark, fonts ready, reduced motion. Preview fixtures only; isolated initially empty engine/profile directories under this report directory.
- **27 measured view observations**: initial 18 state/size/theme combinations; six approval-only diagnostic corrections; three temporary-CSS diagnostic views. Three additional startup loads: **30 total view loads**, below the 32-view bound. **Six screenshots**, all initial unmodified views, all inspected.
- No repository changes, build, CI query, shared test results, Mac access, native-action replay or new retained-Mac captures. Six relevant source files hashed before/after; unchanged. All three launches closed.
- Zero captured page errors or console errors. Existing build-to-source identity is coordinator-supplied; served assets were independently matched byte-for-byte to current `packages/app/dist`.

### Build fingerprints

```text
/assets/index-BdXdFE63.js   d768744b4132de58a1550a7967416a6edf0577d5e3b16b91a580f9e39dafc349
/assets/index-BWZasjBJ.css  1b1946a4b1078dca0bbf6b662bd6976228930b407b2569e9e2ff1d00d303f162
desktop/dist/main.cjs      f57525a0d275ec1a624961962cf8d9ce9edd270322a803c826e187cf0a1074b2
desktop/dist/preload.cjs   0c0dea24ae0345641c19ebc41af763ce8462f961a984fa530960a4b187831bb0
```

## Geometry and source bindings

### 1. DOCX Comments — scrollable, not unreachable

Both themes had identical layout measurements:

| Content size | Viewer client width / scroll width | Initial comments x…right | Wheel scrollLeft | Comments after wheel |
| --- | --- | --- | --- | --- |
| 960×640 | 603 / 919 | 971…1231 | 316 | 655…915, fully visible |
| 1024×686 | 667 / 919 | 971…1231 | 252 | 719…979, fully visible |
| 1440×900 | 1083 / 1083 | 1053…1313 | 0 | Already fully visible |

The document row is 871px: **595px page + 16px gap + 260px comments**. Viewer padding adds 48px. Linux native scrollbars consume 15px; these absolute numbers should not be substituted for macOS scrollbar measurements.

Horizontal wheel over `.fichiers-scroll` brought all three comment cards and the full Reply input into the clipped viewport. `elementFromPoint` confirmed the Reply center belonged to the input. After resetting scroll, focus on the Comments toolbar button followed by **Tab, Tab** reached Resolve then Reply; browser focus scrolling independently produced the same scrollLeft and visible/hittable Reply. No `scrollIntoView` or locator auto-scroll supplied this proof.

Source:

- `packages/app/src/screens/files/docs.tsx:412–453`: document and comment aside share `.fichiers-scroll` / `.fichiers-docrow`.
- `packages/app/src/screens/files/files.css:77`: `overflow: auto`, 24px padding, `align-items: safe center`.
- Same file `:168–169`, `:183`: row gap, fixed A4 width, fixed nonshrinking comment width.

**Minimum recommendation: no change for reachability.** Stacking/shrinking the A4 page would change the established viewer behavior unnecessarily. Frozen source `src/screens/lot-fichiers.css:84,177,193` uses the same scrolling/row/comment pattern.

### 2. Code Settings → Approvals — confirmed join and narrow overlap

`SetApprovals` renders adjacent inline `.ttl`/`.sub` spans with no whitespace. Their parent has `className="grow"`; that utility does not establish a vertical stack.

- At 960 and 1024, `Default model` wraps: its last fragment ends **x=668.734375**, exactly where `For new tasks and reviews` begins. Notification title ends **x=675.53125**, exactly where `Desktop and phone notification` begins. Both themes reproduce.
- At 960, description ends **x=814.15625**, while the model button starts **x=783.984375**, with overlapping vertical extents: about **30.17px horizontal overlap**.
- Both controls remain reachable by sequential Tab: model selector, then `role="switch"` / `aria-label="Notify approvals"`; both centers hit their controls.
- At 1440 the text still joins inline, without the narrow wrapping. This is inherited from the frozen markup, not an isolated regression introduced by ffc118a.

Exact source:

- `packages/app/src/screens/code/lot-code.tsx:878–883`: the first list and its two `.grow` wrappers.
- `packages/app/src/kit/styles.css:299–301`: `.grow` only flex sizing; `.ttl` inline; `.sub` nowrap/ellipsis.
- `packages/app/src/screens/code/lot-code.css:5`: existing `.code-grow` supplies column layout with 2px gap.
- Frozen `src/screens/lot-code.tsx:1033–1038` and `src/styles.css:294–296` have the same inline structure.

**Small-width-only recommendation, preserving the existing wide reference shape:**

```diff
// packages/app/src/screens/code/lot-code.tsx:878, first list in SetApprovals only
-    <div className="list">
+    <div className="list code-approval-defaults">
```

```css
/* packages/app/src/screens/code/lot-code.css:341, existing narrow block */
@media (max-width: 1200px) {
  .code-approval-defaults .grow { display: flex; flex-direction: column; gap: 2px; }
  .code-approval-defaults .sub { white-space: normal; }
}
```

Tested **in memory only**, then removed. At 960/1024, descriptions start below titles, every measured description glyph fits its box, no glyph overlaps the control. At 960 the default-model description wraps to 32px rather than disappearing under the button. At 1440, measured window/panel/row/title/description/control geometry and text were **exactly identical before/after** because the media query is inactive. This diagnostic used light theme; the underlying defect was measured in both themes. It is not a frozen-image pixel comparison or a shipped fix.

An earlier diagnostic replaced `grow` with existing `code-grow` globally. That separates the text in all six cases but changes wide geometry and leaves the description nowrap. Prefer the scoped narrow rule above when retaining the 1440 shape is required. A global typography correction necessarily changes the inherited wide reference and needs explicit visual review.

### 3. Side-by-side diff — narrow scroll proof; inherited wide ellipsis

| Size | `.code-split` client/scroll width | First/second column width | Wheel positions reaching each longest-line endpoint |
| --- | --- | --- | --- |
| 960×640 | 313 / 1086 | 618.02 / 467.81 | 438, 773 |
| 1024×686 | 392 / 1086 | 618.02 / 467.81 | 398, 694 |
| 1440×900 | 808 / 808 | 404 / 404 | 0, 0; endpoints remain clipped |

At both narrow sizes, each longest-line last character was brought inside the diff viewport and hit-tested against its own source element. Following Tab from Copy path enters the first line-comment button; ArrowRight scrolls its nearest diff ancestor to the right edge. The right-column longest-line endpoint is then visible/hit-testable. The surrounding `.code-dpane` has no horizontal overflow; the diff header remains in its own visible box.

Source:

- `packages/app/src/screens/code/parts.tsx:80–99`: paired old/new halves in `.code-split`.
- `packages/app/src/screens/code/lot-code.css:125`: diff body `overflow-x: auto`.
- Same file `:341–352`: at ≤1200px, intrinsic-width columns/subgrid and visible source overflow deliberately allow complete-source scrolling.
- Same file `:142–149`: wide columns remain `1fr 1fr`; halves/source use hidden overflow and ellipsis. Frozen `src/screens/lot-code.css:141–148` contains this same wide behavior.

**Minimum recommendation: retain narrow diff CSS.** The old screenshot cannot support an unreachable-right-column claim. Wide full-line access is a separately observed limitation; changing it would affect the original wide design, so it is not bundled into the narrow correction.

## Useful regression checks

1. Extend `tests/e2e/responsive.spec.ts` with one Approvals case at 960×640 and 1024×686, both themes. Assert exactly two label/description pairs; description top below title bottom; text Range rectangles inside the allocated description box and outside control rectangles; Tab reaches selector/switch. Compare 1440 geometry before/after a proposed narrow-only correction or retain a scoped reference capture.
2. A DOCX reachability case should assert initial horizontal overflow, then **wheel-only** access to full comments/Reply plus independent Tab focus scrolling. Avoid locator auto-scroll masking the property under test.
3. Existing `tests/e2e/responsive.spec.ts:144–160` already checks both longest-line endpoints using horizontal wheel at widths 960/1024, height 640, both themes. This audit additionally covers 1024×686 and keyboard scrolling. Extend that existing case if keyboard coverage is wanted; no duplicate diff suite needed.

No application tests were edited or existing suites invoked. Standalone scripts here provide the executed checks.

## Evidence, correction to the diagnostic, limits

- `geometry.json`: original 18-view record, screenshot hashes, source/asset hashes, wheel/Tab/ArrowRight geometry. Its six Approvals row arrays are **empty due to an incorrect `:first-of-type` selector**; the associated vacuous checks are invalid evidence. Preserved, not silently overwritten.
- `geometry-approvals.json`: corrected six-view run with an explicit `rows.length === 2` assertion; authoritative Approvals geometry. Zero failed checks.
- `scoped-diagnostic.json`: three temporary-CSS measurements; all five scoped assertions pass.
- `audit.cjs`, `scoped-diagnostic.cjs`: runnable standalone probes; no test-runner output outside this directory.
- Original run retains **four failed wide-diff endpoint checks**, two themes × two sides. They establish wide truncation rather than invalidate successful narrow checks.

Six inspected screenshots under `images/`:

```text
docx-960x640-light-initial.png
approvals-960x640-light-initial.png
diff-960x640-light-initial.png
docx-1024x686-dark-initial.png
approvals-1024x686-dark-initial.png
diff-1024x686-dark-initial.png
```

Re-run only with the same already-built revision/server:

```bash
xvfb-run -a -s '-screen 0 1600x1000x24' node /tmp/opencode/narrow-preview-findings/audit.cjs
xvfb-run -a -s '-screen 0 1600x1000x24' node /tmp/opencode/narrow-preview-findings/audit.cjs --approvals-only
xvfb-run -a -s '-screen 0 1600x1000x24' node /tmp/opencode/narrow-preview-findings/scoped-diagnostic.cjs
```

This is controlled Linux Electron preview evidence, not macOS packaging/native-chrome parity, live engine control acceptance, all-screen minimum-size acceptance, motion proof or approval of newer revisions. Original f9aca44 retained-image evidence remains historical and unchanged. The 1440 measurements use native desktop bounds; they are not the frozen browser's inset 1360×840 window and cannot be reported as a fresh frozen-reference comparison.
