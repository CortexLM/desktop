# Corrected unit fixture, cancelled desktop rerun — ea1c54b

[Run 37075722150](https://github.com/CortexLM/desktop/actions/runs/37075722150) is **cancelled**,
not green overall. `run.json` records checks/Linux success and macOS cancellation after the
documentary `93c1e78` push. `checks.log` retains lint/types, 178 unit passes plus one optional
backend skip, and zero i18n findings (63 files, 2,266 used keys, 3,395 English keys).

The only executable change from `d635fcf` is `tests/unit/runtime-copy.test.ts`; application,
E2E, dependency and build/package inputs are identical. This proves the corrected fixture in
CI without reassigning the cancelled macOS job a passing outcome. Replacement run 37076113707
belongs to `93c1e78` and has its own disposition.
