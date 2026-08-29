# 07 — Git and pull requests

## 7.1 Branches

`feat/…`, `fix/…`, `docs/…`, `test/…`, `refactor/…`. Cloud-agent branches follow
`cursor/<descriptive-name>-<id>` and are managed by that workflow.

Branch descriptions follow the same naming rules as everything else: the product
is Cortex, and no other assistant brand or internal codename appears in a branch
name (`06-product.md` § 6.5).

Never force-push a branch someone else may have pulled, and never amend a pushed
commit unless you were asked to.

## 7.2 Commits

One logical change per commit. A commit message says what changed and why, not
what file you edited.

**Bad**:

```
fix stuff
wip
address review
update 3 files
```

**Good**:

```
fix(plugins): stop naming the integration vendor in user-facing copy

The Plugins subtitle, unavailable state and connect button all said which
middleware we install through. Replaced with capability copy per .rules/02-errors.md.
```

No secrets in a commit message, a branch name, or a commit body. If you committed
one, rotate it first (`01-security.md`).

## 7.3 PR title

`type: short description`, where type is `feat`, `fix`, `docs`, `test`, or
`refactor`. Imperative, lower case after the colon, no trailing period.

## 7.4 PR body

State what changed, how to try it **on desktop and on the web**, which honest
states you added, and what you verified. No secrets in the body, and no
screenshots with a key on screen.

## 7.5 Attestation is required

Every PR ends with the attestation block from
[`.github/pull_request_template.md`](../.github/pull_request_template.md). It is
not a formality and it is not decoration — a reviewer reads it first, and an
unticked or deleted block is grounds to close the PR without review.

The rules:

- **Tick a box only if it is true.** An untrue tick is worse than an unticked box,
  because it spends someone else's trust.
- **If a line does not apply, say why on the line** rather than deleting it — for
  example "no user-facing copy in this PR" next to the copy box.
- **Do not remove the block**, do not reword it into something weaker, and do not
  replace it with a link.
- **The last box is the real one.** "I verified this carefully" means you ran the
  thing, at the widths and in the themes you touched, and read your own diff. It
  does not mean the code compiled.

The filled block is what the reviewer holds you to. Fill it honestly and the
review is quick.

## 7.6 Before you open it

```bash
bun run typecheck
npx eslint packages
bun run test
bun run test:discovery
```

Then read your own diff, top to bottom, as if it were someone else's. Most review
comments are things the author would have caught on that read.

## 7.7 What CI checks

`test-suite.yml` runs on PRs to `main`, `develop` and `staging`: per-package unit
coverage, integration, E2E in four Playwright shards, performance budgets, visual
regression, and the test-discovery guard. `security-audit.yml` runs a dependency
audit and a secret scan. `continuous-monitoring.yml` builds, typechecks and lints.

A red check is your problem, including when it looks unrelated. One documented
exception: running `electron-builder` locally rebuilds `better-sqlite3` for
Electron's ABI and breaks the Vitest DB tests — re-run
`bun run build:native-dual-abi` and `bun run verify:native-abi`, and do not commit
around it.

## 7.8 Review and merge

Maintainers squash-merge. Do not merge your own cloud-agent PR unless you were
asked to. Do not enable auto-merge.
