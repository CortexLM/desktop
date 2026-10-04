# 07 — Git and pull requests

## 7.1 Branches

`feat/…`, `fix/…`, `docs/…`, `test/…`, `refactor/…`. Agent-run branches may use their
workflow's prefix (e.g. `goal/…`). No other assistant brand or codename in a branch name
(`06-product.md` § 6.5). Never force-push a branch someone else may have pulled; never
amend a pushed commit unless asked.

## 7.2 Commits

One logical change per commit; the message says what changed and why. Conventional
prefixes as used in this tree: `feat(core): …`, `ci: …`, `chore: …`.

**Bad**: `fix stuff`, `wip`, `update 3 files`.

**Good**:

```
feat(core): computer use through the Cua Driver MCP server, input actions always ask
```

No secrets in a message, branch name or body. If you committed one, rotate it first.

## 7.3 PR title

`type: short description` — `feat`, `fix`, `docs`, `test`, `refactor`. Imperative, lower
case after the colon, no trailing period.

## 7.4 PR body

What changed, how to try it on the desktop app, which honest states you added, and what
you verified. No secrets, no screenshots with a key on screen.

## 7.5 Attestation is required

Every PR ends with the attestation block from
[`.github/pull_request_template.md`](../.github/pull_request_template.md). A reviewer reads
it first; an unticked or deleted block is grounds to close the PR unreviewed.

- **Tick a box only if it is true.**
- **If a line does not apply, say why on the line**, rather than deleting it.
- **Do not remove or weaken the block.**
- **The last box is the real one.** "I verified this carefully" means you ran the app and
  the checks, in the themes you touched, and read your own diff.

## 7.6 Before you open it

```bash
bun run lint
bun run typecheck
bun run test
bun run audit:i18n
bun run build && bun run test:e2e   # when the renderer, desktop or engine wiring changed
```

Then read your own diff top to bottom.

## 7.7 What CI checks

`.github/workflows/ci.yml` on every pull request and push to `main`:

| Job | Runner | Steps |
| --- | --- | --- |
| `checks` | `vars.CORTEX_LINUX_X64_RUNNER` — a CodeBuild label gets `-<run_id>-<run_attempt>` appended; falls back to `ubuntu-latest` | lint, typecheck, test, audit:i18n |
| `e2e` | `blacksmith-4vcpu-ubuntu-2404` | build, serial `test:e2e` under `xvfb-run` (shared clipboard/focus) |
| `macos` | `blacksmith-6vcpu-macos-26` | build, E2E, unsigned arm64 `dir zip` package, `node scripts/smoke.mjs mac` |

There is no release, publish or signing workflow in this tree. A red check is your
problem, including when it looks unrelated.

## 7.8 Review and merge

Maintainers squash-merge. Do not merge your own agent PR unless asked. Do not enable
auto-merge.
