# Contributing to Cortex

Bun workspaces monorepo; Electron 44 desktop app; React 19 renderer; local engine in main.
Read [AGENTS.md](./AGENTS.md) and [`.rules/`](./.rules/) first. Keep changes small, typed,
and tested.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Before you start

1. Search existing issues and pull requests.
2. For a large feature, open an issue first.
3. Do not commit secrets, `.env` files, cookies or private URLs.
4. Test keys are obvious placeholders (`sk-test-…`).

## Setup

Needs Bun 1.4.x and Node 22+.

```bash
git clone https://github.com/CortexLM/desktop.git
cd desktop
bun install
node node_modules/electron/install.js
bun run build
bun run start
```

Renderer in a browser: `bun run dev:api` and `bun run dev:app` (http://localhost:5299).
Electron against the dev renderer: `CORTEX_RENDERER_URL=http://localhost:5299 bun run start`.

## Where changes go

- **Screens:** `packages/app/src/screens/<area>/`, registered by the area's `index.tsx`
  `SCREENS`. Live states read the engine through `packages/app/src/api.ts`; preview states
  read fixtures. See [`.rules/04-structure.md`](./.rules/04-structure.md).
- **Copy:** `packages/i18n/locales/en/<namespace>.json`, read through `t()`. Then
  `node scripts/translate-locales.mjs` for other locales ([docs/i18n.md](./docs/i18n.md)).
- **Engine:** contract in `packages/schema`, service in `packages/core`, route in
  `packages/protocol`, handler in `packages/server`, method in `packages/client`.
- **Desktop host:** `packages/desktop/src` (main, preload, credentials, menu, remote).
  A new preload function is a security review item ([`.rules/01-security.md`](./.rules/01-security.md)).
- **Blocked surfaces** (Space, Scheduled, Plugins & skills) wait for design. Do not add
  stand-in screens.

## Quality bar

```bash
bun run lint
bun run typecheck
bun run test
bun run audit:i18n
bun run build && bun run test:e2e
```

What fails the build: TypeScript `strict`, ESLint errors (`no-explicit-any`,
`rules-of-hooks`, unused vars), Vitest failures, the i18n audit, locale placeholder parity.
New behaviour gets a test. See [docs/testing.md](./docs/testing.md).

## Pull requests

Run `bun run lint` before opening a pull request.

Title `type: short description` (`feat`, `fix`, `docs`, `test`, `refactor`). Fill in the
template and its attestation block honestly ([`.rules/07-git-and-prs.md`](./.rules/07-git-and-prs.md)).
Docs ship in the same PR ([`.rules/05-documentation.md`](./.rules/05-documentation.md)).
Maintainers squash-merge.

## Security

See [SECURITY.md](./SECURITY.md). Never paste keys, tokens or session cookies into
issues, PRs or logs.

## Questions

GitHub Issues for bugs; Discussions for design questions when enabled.
