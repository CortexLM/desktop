# CI artifact review — 5ced8aa

**Two visible minimum-window issues established. CI passes; full product/native acceptance is not established by these artifacts.**

Run: https://github.com/CortexLM/desktop/actions/runs/37015801908
Reports identify PR head `5ced8aa1d2eb04ed3131ffb40c0d360e5706526d` through tested merge
`880c2f6b740a0652e2f901a7eb162ba9e00f73a3`.
Artifact root below: `/tmp/opencode/desktop-ci-5ced8aa/`.

## Verified results

- Parsed `macos/test-results/e2e.json` and `e2e-linux/test-results/e2e.json`: **40 passed each**;
  zero unexpected, flaky, skipped, retried results or report-level errors. Every test has one result.
- `/tmp/opencode/desktop-frozen-ci.log:1231–1296`: lint/typecheck completed; **131 unit passes,
  one optional backend skip**; i18n audit **63 files, 2,264 used keys, 3,395 English keys, zero findings**.
- Log lines 879–922: unsigned arm64 package, notarization disabled, packaged window/shell found,
  **SMOKE OK**. Native `screencapture` failed: `could not create image from display`.

## Images inspected

All eight existing contact sheets: `macos-contact-01.jpg` through `macos-contact-04.jpg`,
`e2e-linux-contact-01.jpg` through `e2e-linux-contact-04.jpg`.
SHA-256 deduplication establishes **44 distinct test PNGs per platform**. Each has three copies
across named outputs, attachment directories and `playwright-report/data`; macOS additionally
has one unique `macos/out/smoke-renderer.png`. Copies are not independent observations.

Full-resolution follow-up included:
- `macos/out/smoke-renderer.png` — 1440×900 packaged Home.
- `macos/test-results/artifacts/keyboard-frozen-shell-moti-289d0-wins-and-hidden-menus-close/frozen-focus-dark.png` — 1440×900 focus mode.
- `macos/test-results/artifacts/keyboard-hidden-navigation-4860c-Undo-work-from-the-keyboard/keyboard-{light,dark}.png` — both 960×640 focus states.
- `macos/test-results/artifacts/bot-safety-Bot-Studio-reta-0345e-aves-leave-once-—-960-light/bot-save-refused-960-light.png`.
- `macos/test-results/artifacts/bot-safety-Bot-Studio-reta-e3468-saves-leave-once-—-960-dark/bot-save-refused-960-dark.png`, plus the corresponding Linux image.
- `macos/test-results/artifacts/bot-safety-Bot-Studio-reta-adf70-ves-leave-once-—-1440-light/bot-save-refused-1440-light.png`.
- The Work and Chat examples below; Mac dark Work, Mac dark Code-session refusal, Linux dark
  preview Code, Mac 960px light upload and image-comparison originals.

## Visible issues

1. **Work board overflows horizontally at 960×640 with the sidebar open.** The “To approve”
   column is cut by the right edge; “Done” is outside the initial viewport. A horizontal
   content scrollbar is visible. This is current responsive debt, not a demonstrated new regression.
   Full-resolution examples:
   - `macos/test-results/artifacts/composer-safety-Work-and-B-e9acc-ed-sends-clear-once-—-light/work-draft-kept-light.png`
   - `e2e-linux/test-results/artifacts/composer-safety-Work-and-B-e9acc-ed-sends-clear-once-—-light/work-draft-kept-light.png`
   - `macos/test-results/artifacts/composer-safety-Work-and-B-79456-ted-sends-clear-once-—-dark/work-draft-kept-dark.png`

2. **Refusal toasts obscure composer recovery controls at 960×640.** “This model can’t read
   images” covers the right-hand model/send area while instructing the user to choose another
   model. Code’s “Message not sent” toast similarly overlaps its composer. The images establish
   visible occlusion while the toast is present, not a permanent interaction failure.
   Full-resolution examples:
   - `macos/test-results/artifacts/ui-flows-rejected-sends-ke-f168b-nts-retry-resends-the-image/chat-draft-kept-light.png`
   - `e2e-linux/test-results/artifacts/ui-flows-rejected-sends-ke-f168b-nts-retry-resends-the-image/chat-draft-kept-dark.png`
   - `macos/test-results/artifacts/composer-safety-Code-keeps-f8c8d-ocks-pending-submits-—-dark/code-session-draft-kept-dark.png`

No additional definite defect established in the inspected Bot save dialogs, focus layouts,
upload rows, comparison handle or packaged Home. Bot modal text/buttons remain within the
window in both themes; the refusal toast does not cover the dialog actions.

## Native and proof limits

These PNGs are renderer captures. The full-resolution Mac focus image reserves upper-left
space and shows the Work heading clear of it, but **native traffic lights are absent from
the capture**. Passing chrome tests assert `{x:20,y:15}` through Electron APIs; they do not
prove the native pixels or traffic-light overlap. Focus mode is not macOS fullscreen.
The failed CI native capture leaves that visual claim open; the separate native sweep was
not accessed. No claim of complete 426-state visual review, motion fidelity, Windows behavior,
signing, or full original acceptance follows from these test images or a source fingerprint.
