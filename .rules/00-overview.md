# 00 — Overview

These rules are binding on every contributor, human or agent. Read
[`AGENTS.md`](../AGENTS.md) first, then the rule file that covers the surface you
are about to touch. Every pull request carries the attestation in
[`.github/pull_request_template.md`](../.github/pull_request_template.md).

## The rule files

| File | Covers |
| --- | --- |
| `00-overview.md` | This map, the non-negotiables, how to read the rest |
| [`01-security.md`](./01-security.md) | Tokens, secrets, guest vs signed-in |
| [`02-errors.md`](./02-errors.md) | User-facing error copy, no vendor names |
| [`03-responsive.md`](./03-responsive.md) | 390 / 768 / 1440, dark + light, tokens |
| [`04-structure.md`](./04-structure.md) | `packages/app` vs `packages/cortex-api`, storage, no stand-ins |
| [`05-documentation.md`](./05-documentation.md) | What to update and when |
| [`06-product.md`](./06-product.md) | Chat vs Code vs Bot, Paper Concept 03 |
| [`07-git-and-prs.md`](./07-git-and-prs.md) | Branches, commits, PR attestation |
| [`08-testing.md`](./08-testing.md) | Which suite proves which claim |

## What this product is

Cortex is one Electron 42 desktop app plus the same UI on the web, in a Bun
workspaces monorepo. One shell hosts three products — **Chat**, **Code**, and
**Bot** — and the switcher between them lives in
`packages/app/src/shell/sidebar.tsx`. There is exactly one renderer,
`packages/app`, and it is SolidJS. The live service is
`https://api.cortex.foundation`, reached through `packages/cortex-api`.

## Non-negotiables

1. **The product is Cortex.** The word Cortex is the only product name that
   appears in code, docs, UI copy, commit messages, branch names, or PR titles.
   No other assistant brand, no vendor brand, no internal codename.
2. **The domain is `cortex.foundation`.** Do not introduce another host, and do
   not hardcode one where `packages/cortex-api` already resolves the base URL.
3. **UI copy is English.** One language in the interface. Existing French
   comments in older modules are legacy; new comments and all user-visible
   strings are English.
4. **Honest states, always.** Empty, loading, error, and signed-out are real
   states with real copy. A screen never fakes success, never invents rows, and
   never presents a cache as a live answer. See `04-structure.md`.
5. **Never show a vendor name to a user.** See `02-errors.md`. This is the rule
   most often broken, and it is the one reviewers check first.
6. **Design values come from tokens.** `@cortex-ide/tokens` through
   `@cortex-ide/ui`. Regenerate with `bun run paper:sync`; do not hand-edit
   generated files. See `03-responsive.md`.
7. **Secrets never reach the renderer.** See `01-security.md`.

## How to read a rule

Each file states the rule, then shows a **Bad** and a **Good** example. The bad
examples are taken from real defects in this tree or from real review comments —
they are not strawmen. If a rule and the code disagree, the rule wins and the
code is the bug; fix the code or open an issue, do not copy the defect.

## Where the ground truth lives

| Question | Answer lives in |
| --- | --- |
| Which screens exist? | `packages/app/src/routes.ts` (asserted against `design/paper/screens.json`) |
| What does the service return? | `packages/cortex-api/CONTRACT.md` |
| What crosses the IPC bridge? | `packages/shared/src/types/ipc/*` |
| What is locked product behaviour? | `CONTRIBUTING.md` § Product lock and `06-product.md` |
| How do I run it? | `AGENTS.md`, `README.md`, `CONTRIBUTING.md` |
