# 00 — Overview

These rules bind every contributor, human or agent. Read [`AGENTS.md`](../AGENTS.md)
first, then the rule file for the surface you touch. Every pull request carries the
attestation in [`.github/pull_request_template.md`](../.github/pull_request_template.md).

## The rule files

| File | Covers |
| --- | --- |
| `00-overview.md` | This map, the non-negotiables, what was retired |
| [`01-security.md`](./01-security.md) | Keys stay in main, sandboxed renderer, no secrets in git |
| [`02-errors.md`](./02-errors.md) | Error codes → Cortex copy, no vendor names |
| [`03-responsive.md`](./03-responsive.md) | Window sizes, dark + light, CSS variables |
| [`04-structure.md`](./04-structure.md) | Package boundaries, no seeded data |
| [`05-documentation.md`](./05-documentation.md) | What to update and when |
| [`06-product.md`](./06-product.md) | Surfaces, live vs preview vs blocked |
| [`07-git-and-prs.md`](./07-git-and-prs.md) | Branches, commits, attestation |
| [`08-testing.md`](./08-testing.md) | Which suite proves which claim |

## What this product is

Cortex desktop is one Electron 44 app in a Bun workspaces monorepo. The agent engine
(`packages/core`) runs in the Electron main process and is served to the React renderer
(`packages/app`) over IPC — no socket, no external database. Local mode needs no account;
Cortex Cloud (`https://api.cortex.foundation`) and self-hosted servers are optional
connection modes. See [`docs/architecture.md`](../docs/architecture.md).

## Non-negotiables

1. **The product is Cortex.** No other assistant brand, vendor brand or codename in code,
   docs, UI copy, commits, branches or PR titles.
2. **The domain is `cortex.foundation`.** The cloud URL is `CLOUD_URL` in
   `packages/core/src/connection.ts`; do not hardcode another host.
3. **English is the source copy.** Every user-facing string is a key in
   `packages/i18n/locales/en/*.json`, read through `t()`. `bun run audit:i18n` enforces it.
4. **Honest states.** Empty, loading, error and unavailable are real states with real copy.
   Live mode never shows fixture rows and never fakes success (`04-structure.md`).
5. **Never show a vendor name or raw error to a user** (`02-errors.md`).
6. **Theme values are CSS variables** from `packages/app/src/kit/styles.css` (`03-responsive.md`).
7. **Provider keys never reach the renderer** (`01-security.md`).

## Retired rules, and why

The rewrite removed the systems these rules policed. They are deleted, not kept as dead letters:

| Retired | Why |
| --- | --- |
| Paper *Cortex FF1 v1* sync, `paper:*` scripts, `design/paper/screens.json`, `routes.ts` manifest test | The UI is now ported from a local design reference; screens register through `packages/app/src/registry.tsx` and are compared with `scripts/compare-shots.mjs` |
| SolidJS renderer, `@cortex-ide/tokens` / `@cortex-ide/ui` | Renderer is React 19 + `@base-ui/react`; theme variables live in `kit/styles.css` |
| `better-sqlite3` / `node-pty` dual-ABI builds | No native addons; storage is `node:sqlite` |
| `packages/main`, `packages/preload`, `packages/shared`, `packages/cortex-api`, `packages/ai-engine` | Replaced by `packages/desktop`, `packages/schema`, `packages/core`, `packages/protocol`, `packages/server`, `packages/client` |
| Auto-update feeds, R2 publishing, CodeBuild-only dist, signing gates | Release workflows were removed; release and signing are not configured (`AGENTS.md` § CI) |
| `/welcome`, Chat \| Code \| Bot switcher, sign-in-locked Code | The app opens on Chat home; the switcher is Cortex \| Cortex Code; local Code needs no account |
| `max-lines` / `complexity` ESLint limits, `test:discovery`, `quality:*` | Not in the current `eslint.config.mjs` or `package.json` |

## How to read a rule

Each rule states what to do, with a **Bad** and **Good** example drawn from this tree. If a
rule and the code disagree, the code is the bug: fix it or open an issue.

## Where the ground truth lives

| Question | Answer lives in |
| --- | --- |
| Which screens exist? | `packages/app/src/screens/*/index.tsx` (`SCREENS`), `#/gallery` |
| Which engine routes exist? | `packages/protocol/src/index.ts` |
| What crosses IPC? | `packages/desktop/src/preload.ts`, `packages/desktop/src/main.ts` |
| Engine guarantees | `packages/core/README.md`, `docs/engine.md` |
| How do I run it? | `AGENTS.md`, `README.md`, `CONTRIBUTING.md` |
