# Provider key layout — scoped review

**Verdict: PASS. No blocking findings in the narrow wrapping fix.**

- `packages/app/src/screens/system/settings.tsx:218-224`: existing key form gains one class and one controls wrapper; no new surface or engine behavior.
- `packages/app/src/screens/system/system.css:35-39`: provider-specific selectors; 120px label basis prevents collapse, normal whitespace exposes the hint, grouped controls wrap and shrink within the pane.
- Accessibility: native form submission, password-input accessible name, button semantics and DOM focus order survive the wrapper. CSS introduces no focus suppression or visual reordering.
- Security: write-only key API, password masking and last-four-only status remain intact. Added captures occur after the test input clears; catalog/key are deterministic test fixtures.
- Wide layout: 200px preferred input width, existing 12px gaps and vertical alignment retained when space permits. Passing 1440px checks require the label/input/button to remain inline; no concrete wide-layout regression found.
- `tests/e2e/ui-flows.spec.ts:19-88`: both themes cover 960/1024/1440, real save/reload/removal, text Range containment plus hit testing, overlap and horizontal overflow. Six capture attachments add evidence only.

Evidence read:
- `/tmp/opencode/provider-key-layout-before.log`: both themes fail at 960px; API key and Saved hint clipped/covered, collapsed label container.
- `/tmp/opencode/provider-key-after.log`: all four UI-flow cases pass, including both width/theme regressions.

Review is source/log-based. Capture/package verification belongs to the coordinator's ongoing run.
