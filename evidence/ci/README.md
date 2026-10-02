# CI evidence revisions

- `run-36957854761.json`: green `d40b5d7`, 62 unit passes, 8 E2Es per OS.
- `run-36962840639.json`: green `a205c6e`, 64 unit passes, 11 E2Es per OS. One optional
  real-backend unit skipped without its URL; no E2E retries, flakes or skips.
- `lint.log`, `types.log`, `units.log`, `audit.log`: local integrated checks before
  `b56d2ad`; the two later preview changes have their own green CI above.
- `linux-packaged-smoke.log`: local packaged launch at `a205c6e`. Renderer screenshots
  here are the earlier `d40b5d7` live empty-home baseline; they are not latest-tip captures.
- macOS CI could capture renderer pixels but native `screencapture` lacked permission.
  Installed native captures, package hashes and clean-install checks are under `../mac`.

These records identify successful revisions, not a claim that every subsequent commit
passed or the complete product objective is accepted. See `../STATUS.md` and the PR checks.
