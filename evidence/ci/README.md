# CI evidence revisions

- `run-36957854761.json`: green `d40b5d7`, 62 unit passes, 8 E2Es per OS.
- `run-36962840639.json`: green `a205c6e`, 64 unit passes, 11 E2Es per OS. One optional
  real-backend unit skipped without its URL; no E2E retries, flakes or skips.
- `run-36964561125.json`: green `2a9d1ad`, 65 unit passes, 11 E2Es per OS; CodeQL passes,
  zero open PR alerts. Application code is `7341cc7`; the last change uses keyboard theme
  selection in the navigation test instead of shared native-pointer hover.
- `lint.log`, `types.log`, `units.log`, `audit.log`: local integrated checks before
  `2a9d1ad` at application revision `7341cc7`.
- `linux-packaged-smoke.log`: local packaged launch at `7341cc7`. Renderer screenshots:
  Linux `7341cc7`, macOS CI `2a9d1ad`, both live empty-home states.
- macOS CI could capture renderer pixels but native `screencapture` lacked permission.
  Installed native captures, package hashes and clean-install checks are under `../mac`.

These records identify successful revisions, not a claim that every subsequent commit
passed or the complete product objective is accepted. See `../STATUS.md` and the PR checks.
