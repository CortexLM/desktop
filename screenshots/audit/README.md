# View audit captures — 2026-08-17

62 PNGs of every reachable view, in both themes, plus the states the activity
bar cannot reach. Produced by `tests/e2e/specs/view-audit.spec.ts` and
`tests/e2e/specs/states-audit.spec.ts` against a real Electron launch with a
per-test Git fixture workspace.

## Read this before trusting a judgement in the report

**The agent that produced these screenshots could not see them.** Native image
input returned nothing (verified with a control PNG containing a known 4-digit
code — the code came back unread), and no vision MCP was reachable
(`GetMcpTools` found no `analyze_image` / `openrouter-multimodal` tool). The
screenshots are therefore **deliverables for a human reviewer, not evidence the
report is based on.**

Every claim in the report comes from the JSON probes captured alongside each
PNG: computed styles, geometry, visible text, control inventories, error-boundary
presence, and console/page errors. Where the report says "no crash", that means
`ErrorState`'s "This view failed to load" text was absent and no `pageerror`
fired — not that a screenshot looked right.

## Layout

```
dark/, light/    NN-<view>.png — the 12 activity-bar views, both themes
                 plus shell, editor, git, palette, no-folder states
states/          debug panels, dialogs, settings tabs, populated views
probes/          per-test JSON from view-audit.spec.ts
state-probes/    per-test JSON from states-audit.spec.ts
*.json           targeted probes (branch selector, git duplicate, a11y focus)
```

Naming is `NN-<view>` where NN is the activity-bar order, so `01-explorer`
through `12-settings` match the rail top to bottom.

## Regenerating

```bash
bun run build                     # probes read packages/*/dist
xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' \
  npx playwright test tests/e2e/specs/view-audit.spec.ts \
                     tests/e2e/specs/states-audit.spec.ts --workers=2
npx tsx scripts/summarize-view-audit.ts
```

Do not run `bun install` first: it rebuilds `better-sqlite3` for a single ABI and
breaks the Electron launch. If the launch fails, `bun run verify:native-abi`
tells you whether the dual-ABI build is still in place.

## Known capture caveats

- **Account views** (`account-*.png`, `11-account.png`) were re-captured after a
  concurrent agent finished editing `views/account/`. The re-capture is the one
  on disk; an earlier pass caught that directory mid-edit and was discarded.
- **Clicking an already-active activity icon collapses the sidebar** rather than
  navigating (`AppShell.handleSelect`). The spec re-expands via
  `toggle-sidebar` before capturing, so sidebar probes are not 0-width. An
  earlier pass missed this and recorded a collapsed Explorer.
- `debug-tab-4-tab-4.png` is the debug Settings tab. Its trigger is icon-only
  with no accessible name, so it has no label to slug — that is itself a finding.
