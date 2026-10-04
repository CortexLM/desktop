# Code attachment recovery: FAIL in both themes

Read-only verification of the current built Electron app; no rebuild/source edits. Linux/Xvfb, native Cortex window 960×640, real engine/IPC, repository catalog and fake-provider fixture, isolated data directories.
One focused refusal journey, light/dark; repeated with a long filename because the short-name chip left its Remove control outside the overlap.
Built main SHA-256: `6e6cc1f0604a6f673e66603bbb097d6dced22ebda9006cbd9891123cf7349d67`.
Built index SHA-256: `1295d838c97d66b898333e4d4951918865dbbe7be49ed9e2a7becf5521f5454f`.

## Reproduction and measured result

Create a real Code session using `fake/reasoner`; attach PNG through the file input, switch to `Plain Text`, submit `  Keep this image request  `.
Real response: HTTP 422, `model_no_image_input`, observed from the unmodified engine response.
Both themes retain exact draft and image; persisted messages remain empty; fake-provider request count stays zero; original session model remains unchanged. No renderer errors.

| Geometry, CSS px | Light | Dark |
| --- | --- | --- |
| `.chat-box` top / form top | 501 / 565 | 501 / 565 |
| attachment region | x371–663, y501–566 | same |
| toast bounds | x596–936, y487.125–553 | same |
| required toast bottom | ≤489 | ≤489 |
| actual toast bottom | 553: FAIL | 553: FAIL |

Short `dot.png`: Remove/model/input/send trial-click checks pass, but toast overlaps the attachment region.
`architecture-screenshot-with-long-filename.png`: Remove lies x654–676, y523–545 underneath the toast. Center hit test returns `.t-body`; Playwright trial-click fails within 600 ms, explicitly reports intercepted pointer events. Model/input trial clicks pass; toast still visible after checks.

## Minimum correction

`packages/app/src/kit/styles.css:276` anchors `--cortex-dock` to `.content .split-l .composer`, excluding its newly introduced attachment wrapper (`screens/code/code.tsx:261–262`; `screens/chat/model-composer.tsx:105–114`).
Change only that Code anchor selector to `.content .split-l .chat-box` (or a fallback selector for a direct preview `.composer`); keep the existing `body:has(...) .toasts` positioning rule. Attachments then move the anchor with the full dock; preserve preview's direct-composer anchor.
Add this long-filename refusal regression to the owned Code E2E: toast bottom above `.chat-box` top, Remove/model/input hittable while toast is visible, draft/file unchanged after refusal.

## Artifacts and prior baseline log

Captures inspected: `/tmp/opencode/code-attachment-check/refused-{light,dark}.png` and `/tmp/opencode/code-attachment-check/long-filename-refused-{light,dark}.png`.
Exact pre-fix textual failure artifact: `/tmp/opencode/code-model-baseline/code-models-Code-sends-the-935b1--unavailable-models-—-light/error-context.md` (lines 14–19: 2500 ms wait for missing `Reasoner Large`).
The earlier command used `--reporter=line`; stdout was returned to the session, never redirected to a separate `.log`. No standalone pre-fix text log exists; `error-context.md`, trace and `.last-run.json` are the retained artifacts.
