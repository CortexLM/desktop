# Cortex

Cortex desktop: Chat, Work, Bots, Files and Cortex Code on a local agent engine.

One Electron 44 app. The engine runs inside the app's main process, stores sessions and
settings in local SQLite (`node:sqlite`), and talks to the model providers you configure.
Provider keys use a separate main-process credential store. No account is needed.
Cortex Cloud (`cortex.foundation`) and self-hosted settings save a preference, probe servers
and support email-code sign-in through main. Sign-in lasts until Cortex closes; prompts
still use the local engine and configured providers.

## Quick start

```bash
bun install
node node_modules/electron/install.js   # Bun skips Electron's postinstall
bun run build
bun run start                           # headless Linux: DISPLAY=:1 bun run start -- --no-sandbox
```

Then Settings → Providers & models: pick a provider, paste your key.

Renderer-only loop in a browser:

```bash
bun run dev:api    # engine on :5298, in-memory keys
bun run dev:app    # Vite on :5299, proxies /api
```

## Layout

```
packages/
  schema/     zod contracts (browser-safe)
  core/       local engine: storage, bus, catalog, providers, sessions, tools,
              permissions, agents, skills, plugins, MCP, bots, scheduler, space,
              connection, computer use
  protocol/   Hono route table + validation
  server/     createServer(core) → app.fetch
  client/     typed fetch client + SSE parser
  i18n/       catalogs (locales/<locale>/<namespace>.json) and loaders
  app/        renderer: React 19, @base-ui/react, Vite 8
  desktop/    Electron main + preload, credentials, menu, remote probe and sign-in
vendor/       @cortex/sdk and @cortex/api-types tarballs
tests/        unit/ and e2e/ (Playwright + Electron)
scripts/      i18n audit, translation, smoke test, design comparison, Mac capture
```

## Checks

```bash
bun run lint
bun run typecheck
bun run test
bun run audit:i18n
bun run build && bun run test:e2e
```

## Status

- Live: Chat, Work tasks and approvals, Bots, Cortex Code on a local folder, Settings →
  Providers & models; Connection selection, probing and process-lifetime email-code sign-in.
- Preview only: file viewers and other screens without engine wiring (see `#/gallery`).
- Not built yet (waiting on design): Space, Scheduled, Plugins & skills, additional sign-in
  continuation screens. Remote prompt routing remains pending.
- Catalogs and preview fixtures exist for `en fr es de ja zh-Hans pt-BR ko`; builtin
  `summarize` ships in `skills/`.
- E2E covers 426 registered theme/state renders and UI streaming through a **local fake
  provider**. Separate [real image/reasoning evidence](evidence/real-provider.json) and
  [native Mac captures](evidence/mac/README.md) exist; [full acceptance remains incomplete](evidence/STATUS.md).
- Release and code signing are not configured; CI builds unsigned packages only.

## Documentation

- [AGENTS.md](./AGENTS.md) and [`.rules/`](./.rules/) — read before contributing
- [CONTRIBUTING.md](./CONTRIBUTING.md) · [SECURITY.md](./SECURITY.md) · [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/architecture.md](./docs/architecture.md) · [docs/engine.md](./docs/engine.md) · [docs/providers.md](./docs/providers.md)
- [docs/connection-modes.md](./docs/connection-modes.md) · [docs/i18n.md](./docs/i18n.md) · [docs/testing.md](./docs/testing.md) · [docs/computer-use.md](./docs/computer-use.md)
- [packages/core/README.md](./packages/core/README.md) · [vendor/README.md](./vendor/README.md)

## License

Copyright 2026 Cortex Foundation / CortexLM. Licensed under the
[Apache License, Version 2.0](./LICENSE). Third-party notices are in [NOTICE](./NOTICE).
