# Acceptance status

PR: https://github.com/CortexLM/desktop/pull/36 (`goal/desktop-rewrite`, draft).
The full objective is **not complete**. Evidence below is scoped to implemented surfaces.

| Required proof | Evidence | Limits |
| --- | --- | --- |
| 1. Lint, types, units | [Green CI](https://github.com/CortexLM/desktop/actions/runs/36957854761), code `d40b5d7`; [summary](ci/run-36957854761.json) | 62 unit tests pass; one optional backend test skipped without its URL; two existing hook warnings |
| 2. Electron E2E | 8 tests pass on Linux and macOS, no retries/flaky/skips; 426 preview renders, provider key entry, model/thinking/image composer flow, native menu/window assertions | CI inference endpoint is deterministic; every preview render is covered, not every interaction |
| Real inference supplement | [Real provider](real-provider.json), [replay script](../scripts/verify-real-provider.mjs) | Real GPT-6 Astra image response plus reasoning; test-only model alias; built IPC/engine path, not packaged UI |
| 3. macOS build/package/launch | Same green run, Blacksmith macOS 26, unsigned arm64, `SMOKE OK` | CI native screen capture failed; renderer screenshot inspected. Native chrome is verified separately on the remote Mac |
| 4. Remote Mac | Installed CI artifact, native window captures and menus under `evidence/mac` | Native capture set and revision recorded in its manifest; no signing/notarization claim |
| 5. Design comparison | [Report](compare/README.md), [421 reference comparisons](compare/report.json), [retained side-by-side shots](compare/index.html) | Mean 0.04%, max 0.78%; ten Settings states lack reference shots; mascot review boards are not routed screens |
| 6. Copy audit | [Zero-finding run](ci/audit.log), [audit regression test](../tests/unit/audit-i18n.test.ts) | Common static copy sinks checked, including local constants; runtime/imported values and dynamic keys are not a complete dataflow proof |

## Missing inputs and unfinished work

- **Design input:** Space welcome/pages/sites/images/recents, standalone Scheduled tasks
  with suggestions, Plugins & skills installed/public/personal/MCP. Requests remain
  unanswered in `/root/cortex-ui/DESIGN-REQUESTS.md`; no stand-in screens were added.
- **Additional design approval:** Providers, Connection, model capability picker and
  inline tool approval requests remain open. Existing functional controls need design review.
- **Connection behavior:** cloud/self-host mode selection and probes exist; sessions still
  call locally configured providers. Remote auth, model selection and inference routing are
  unfinished. A successful backend probe is not proof of a complete remote connection mode.
- **Interaction coverage:** several ported surfaces remain preview-only; projects, sign-in,
  billing, updater and file viewers do not become live features merely by rendering in the gallery.
- **Responsive acceptance:** native captures at 1024×685 and comparisons at 1440×900 do not
  prove every control usable at the 960×640 minimum; overflow issues remain under review.
- **Release:** signing/notarization and Windows CI are not configured. Unsigned test builds
  work; public release readiness is not claimed.

The source rewrite, tests and evidence stay on the feature branch. No merge or main push.
