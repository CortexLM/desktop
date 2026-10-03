# Code Settings → Approvals: eight-locale narrow correction check

**PASS: 16/16 views, 320 recorded checks, zero captured page/console errors.**
Real Linux Electron, 960×640 client viewport, sidebar shown; light/dark for
`en fr es de ja zh-Hans pt-BR ko`. Scope: the two corrected default-model/notification
rows in `.code-approval-defaults`, their headings and keyboard access.

## Artifact and execution

- Revision: `78857365a509d78af10ebdda5b52348a2e50e961`.
- Frozen receipt: `/tmp/opencode/build-7885736/members.json`.
- Launched the existing checkout's `packages/desktop/dist/main.cjs`, following
  `tests/e2e/fixtures.ts`; the frozen directory lacks the launch-root package metadata.
- All **90 dist members** (86 renderer, four desktop) matched their frozen SHA-256
  values before and after execution. Ordered member-list digest:
  `b2c2f54529a76ac43549136a496c7b24865fe722f8889ca9b42fed9e340c8dcb`.
- Eight `code.json` catalogs and the corrected Code CSS/TSX also matched
  `pinned-inputs.json` before/after. The broader source receipt is recorded, not
  independently revalidated as an all-source audit.
- Successful run: **2026-10-03 05:20:01.102–05:20:18.149 UTC**, exit **0**.
- Electron **44.5.1**, Chromium **152.0.7977.130**, embedded Node **24.21.0**;
  harness Node **22.23.3**, isolated Xvfb `1280x900x24`.
- One isolated app/profile for the complete 16-view sweep; app closed afterward.
  Empty deterministic catalog; renderer override unset; `cortex://app` built renderer.

## Results

| Locale | Light | Dark | Actual row-text font families |
| --- | --- | --- | --- |
| en | PASS | PASS | Geist |
| fr | PASS | PASS | Geist |
| es | PASS | PASS | Geist |
| de | PASS | PASS | Geist |
| ja | PASS | PASS | WenQuanYi Zen Hei |
| zh-Hans | PASS | PASS | WenQuanYi Zen Hei |
| pt-BR | PASS | PASS | Geist |
| ko | PASS | PASS | Geist, WenQuanYi Zen Hei |

Each view sets the real locale preference, reloads, verifies `html.lang`, theme and
catalog copy, awaits `document.fonts.ready` and full element/ancestor opacity.
CDP reports actual glyph-bearing fonts for all four title/description elements.
The browser's language list is recorded separately; it does not substitute for the
selected document locale.

`BrowserWindow.setContentSize(960, 640)` is followed by measured 960×640 renderer and
`.window` bounds, plus a 960×640 PNG. Text Range rectangles prove complete visible
titles/descriptions, description placement below titles, containment within allocated
text-column width and real clipping ancestors, and clearance from both controls.
Unclipped CSS line-box height is not used to reject font ink.

Real Tab presses from the final `.pg-nav` button reach the model selector, then the
notification switch; focus, enabled state, localized copy and center hit tests pass.
Each view has 20 recorded checks plus Playwright focus/enabled assertions. No injected
CSS, replacement copy, API interception or animation override.

Both contact sheets were inspected across all 16 views. German, French and Brazilian
Portuguese were additionally inspected at full 960×640 in both themes: corrected text
wraps completely; controls remain distinct and reachable; switch focus is visible.
No correction defect found in this bounded check.

## Retained evidence and negative attempt

- `manifest.json`: expected localized copy, before/after geometry, font diagnostics,
  Tab results, per-view errors, PNG hashes and dist integrity results.
- `screens/approvals-<locale>-<theme>.png`: all 16 original captures.
- `contact-light.jpg`, `contact-dark.jpg`: reduced review sheets.
- `check.mjs`, `run.log`, `exit-code.txt`: exact successful harness and result.
- `probe-attempt/`: preserved first run, exit **1**, stopped at English/light. Its
  sole failed predicate queried platform fonts on the list container and received
  no glyph data. Layout, copy and keyboard predicates passed. The probe was corrected
  to query the four text-bearing elements; no application change occurred. Original
  script, manifest, PNG, log and isolated profile remain retained.

Original pre-fix `ffc118a` geometry failures remain under
`/tmp/opencode/narrow-approvals-fix/`; this evidence neither overwrites them nor
reclassifies the font-probe failure as an application defect.

## Acceptance boundary

This establishes the corrected two-row layout and Tab access on Linux with the recorded
fonts. Translation meaning, all-screen eight-locale acceptance, native Mac font/layout
behavior, lower permission controls, SDK authentication and live account behavior are
outside this check. Preview account/project labels are fixtures. Repository source,
dist and prepared native harness were untouched; no build, commit, CI or Mac execution.
