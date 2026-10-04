# Send with Enter: current local verification

Uncommitted renderer correction on application base `9e4c438`. Historical saved-text
CI/package/native receipts remain pinned to that application and do not certify this change.

The existing device preference now controls native live textareas in Chat, Work, Bot
and Code. Missing means enabled; invalid/unreadable means newline-only with feedback.
Accepted writes precede publication. Shift+Enter remains newline; composition and
modified/repeated Enter do not submit. Committed history-entry identity prevents an
outgoing same-URL New Chat draft from submitting before the next route commits.
Preview input geometry remains unchanged. Live user bubbles preserve internal newlines.

## Observed checks

- Five negative behaviors reproduced on the unchanged 90-member `9e4c438` build;
  preview isolation already passes. Initial test-locator failures remain distinct.
  See `enter-preference-manual-qa.md` for commands and original evidence.
- The same six core scenarios pass on the initial corrected production build in
  15.7 seconds. Two added synthetic composition/storage cases pass in 4.4 seconds.
- Code/Bot and existing draft-safety selection: seven cases pass in 30.5 seconds.
  Eight inspected images expose a narrow Code text-width defect despite passing behavior.
  A scoped container rule wraps its controls; rebuilt Code/Bot cases pass in 8.8 seconds.
  Corrected light/dark Code captures show readable words and reachable controls.
- Types, lint, 295 units plus one optional backend skip and i18n pass. The i18n audit
  reports 73 files, 2,296 used keys, 3,462 English keys, zero problems. These static/unit
  unit results precede the final CSS-only correction and last Code/Bot test additions.
  Types, lint and i18n were rerun after those changes and pass unchanged.
- Final production build succeeds. Linux package builds; packaged launch reports
  `SMOKE OK` under Xvfb.
- Independent `.omo/evidence/send-enter-gate-review.md` approves bounded source/visual
  review, inspects twelve images, and preserves its explicit coverage gaps.

Full Electron regression passes all 162 cases in 17.0 minutes with one worker.
Current positive outputs live at
`/tmp/opencode/enter-positive-initial`, `enter-adversarial`, `enter-callers`,
`enter-callers-wrap` and `enter-full-regression`. The latter four names share the
`/tmp/opencode/` prefix. No native Mac or real IME proof exists for this correction;
no CI, signed release, exhaustive locale/layout or whole-product acceptance is claimed.
