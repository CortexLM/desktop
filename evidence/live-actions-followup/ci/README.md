# Work/Search CI — f9aca44

[CI 37080136101](https://github.com/CortexLM/desktop/actions/runs/37080136101) passes all jobs:
178 unit passes plus one optional backend skip; lint/types; i18n 63 files, 2,267 used keys,
3,395 English keys, zero findings; **70/70 Electron cases per OS**, 426 renders per OS,
zero retries/flaky/skips; unsigned macOS package/smoke.

[Independent receipt](review/README.md) verifies head/merge/tree, 473 source pins, both E2E reports,
458 artifact members, 90 packaged build members, nineteen scoped captures and smoke. Matching JSON
metadata/inventories/reports and twenty inspected PNGs are retained in `review/`. Its receipt keeps
original temporary input paths; the complete run log and verification script stay at those paths.

CI native display capture fails, explicitly retained. Window/menu API assertions pass; actual
[installed native pixels](../../mac/f9aca44/README.md) come from the separate matching artifact.
The retained March Setup Assistant incident is historical, not a Cortex crash.
