# Getting started

> [!WARNING]
> **Alpha software.** Cortex Desktop is not recommended for production use. Features can change or break between commits, nothing is guaranteed to be stable, and builds are **unsigned** (no code signing, no notarization). Back up anything you care about and expect rough edges.

## Requirements

- [Bun](https://bun.sh) 1.4 and Node 22 or newer.
- macOS, Windows or Linux. Packages are unsigned.

## Build and run

```bash
git clone https://github.com/CortexLM/desktop.git
cd desktop
bun install
node node_modules/electron/install.js
bun run build
bun run start
```

Bun skips Electron's postinstall script, which is why the `install.js` step exists. On headless Linux, run `DISPLAY=:1 bun run start -- --no-sandbox`.

## Add a provider

1. Open **Settings, Providers and models**.
2. Pick a provider from the catalog. Anthropic, OpenAI, Google and OpenAI-compatible endpoints are supported ([providers](./providers.md)).
3. Paste your key. It goes to the main process and is never shown again, only its last four characters.
4. Pick a model and open a new chat (`Cmd/Ctrl+N`).

The catalog comes from models.dev. Offline, the app falls back to its cached copy.

## Packaging

```bash
bun run pack       # unpacked app in dist/
bun run dist:mac   # dmg and zip
```

## Develop on the renderer only

```bash
bun run dev:api
bun run dev:app    # http://localhost:5299
```

## Next

[Configuration](./configuration.md), [Troubleshooting](./troubleshooting.md), [CONTRIBUTING](../CONTRIBUTING.md).
