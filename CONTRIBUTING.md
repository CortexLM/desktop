# Contributing to Cortex

Thank you for helping. This is a Bun workspaces monorepo. The UI is SolidJS.
The desktop host is Electron. Please keep changes small, typed, and tested.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Before you start

1. Search existing issues and pull requests.
2. For a large feature, open an issue first.
3. Do not commit secrets, `.env` files, cookies, or private tunnel URLs.
4. Do not invent API keys in fixtures. Use obvious placeholders (`sk-…`).

## Setup

```bash
git clone https://github.com/CortexLM/desktop.git
cd desktop
bun install
bun run build:native-dual-abi   # if native addons are missing
bun run build
```

Desktop:

```bash
bun run start
# or, with the Vite dev server:
# terminal 1: bun run --filter @cortex-ide/app dev
# terminal 2: VITE_DEV_SERVER_URL=http://localhost:5173 bun run start
```

Web (same UI, no local harness):

```bash
bun run --filter @cortex-ide/app dev
```

Copy `.env.example` to `.env` only on your machine. Settings in the app
override environment keys. Keys typed in Settings go to the OS keychain.

## Branch names

`feat/…`, `fix/…`, `docs/…`, `test/…`, `refactor/…`. Cloud-agent branches
follow `cursor/<name>-<id>` and are managed by that workflow.

## What to change

- **UI / routes:** `packages/app`. One screen module per destination. Honest
  empty, loading, error, and signed-out states — never a fake success.
- **Desktop services:** `packages/main` + IPC types in `packages/shared`.
- **Bridge:** `packages/preload`. New namespaces must be added to the
  exposure-surface test on purpose.
- **Design tokens / kit:** regenerate from Paper (`bun run paper:sync`) rather
  than hand-editing generated files.
- **Live API client:** `packages/cortex-api`. Do not require cloning
  `CortexLM/backend`.

Product lock (do not reopen in a drive-by PR):

- One shell: Chat | Code. Bot is a separate app.
- Chat sidebar order: Search, Research, Planning, Projects, Library, Plugins last.
- Planning = scheduled tasks, not a project plan.
- Plugin cards use official brand marks (Google Drive, Slack, GitHub, Paper).
- Bot: exactly one computer per mascot, and that computer is a cloud farm box
  (never This PC, never SSH).
- This PC is Cortex Code on the desktop app. SSH stays SSH.
- Web Code never runs the harness in the browser.
- SSH / host keys stay server-side.

## Quality bar

```bash
bun run typecheck
npx eslint packages
bun run test
bun run test:discovery
```

E2E (needs Playwright Chromium and, in CI, xvfb):

```bash
bunx playwright install chromium
bun run test:e2e
```

Rules that actually fail the build:

- TypeScript `strict`.
- ESLint `max-lines` 300 and `max-lines-per-function` 50 (blank lines and
  comments skipped). Split modules instead of disabling the rule.
- Vitest only for unit tests. Do not import `bun:test`.
- New behaviour gets tests. Screens get empty / error / signed-out coverage.
- No dead mocks presented as live data.

## Pull requests

Title: `type: short description` (`feat`, `fix`, `docs`, `test`, `refactor`).

Describe what changed, how to try it on desktop and web, and which honest
states you added. Do not dump secrets into the PR body or screenshots.

Maintainers squash-merge. Do not merge your own cloud-agent PR unless asked.

## Security

See [SECURITY.md](./SECURITY.md). Never paste keys, tokens, or session
cookies into issues, PRs, or logs.

## Questions

GitHub Issues for bugs. GitHub Discussions for design questions when enabled.
