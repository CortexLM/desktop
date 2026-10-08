# Troubleshooting

> [!WARNING]
> **Alpha software.** Cortex Desktop is not recommended for production use. Features can change or break between commits, nothing is guaranteed to be stable, and builds are **unsigned** (no code signing, no notarization). Back up anything you care about and expect rough edges.

**Electron fails to start after `bun install`.** Run `node node_modules/electron/install.js`. Bun skips the postinstall.

**Blank window or sandbox error on Linux.** Run with `--no-sandbox` and a `DISPLAY`: `DISPLAY=:1 bun run start -- --no-sandbox`.

**macOS says the app can't be opened.** Builds are unsigned. Right-click, choose Open, or clear quarantine with `xattr -dr com.apple.quarantine /path/to/Cortex.app`.

**Windows SmartScreen warning.** Installers are unsigned. Choose More info, then Run anyway.

**Model list is empty.** The catalog loads from models.dev, then falls back to a cache. Offline with no cache, the engine reports `catalog_unavailable`. Reconnect and refresh.

**A send is refused.** A missing, disabled or unsupported model refuses the send and keeps your draft. Pick another model in the chooser.

**Cloud sign-in doesn't persist on Linux.** Persistence needs OS encryption (a keyring). Without it the session stays in memory.

**Tests fail with a stale build.** Run `bun run build` before `bun run test:e2e`.

Still stuck? Open an [issue](https://github.com/CortexLM/desktop/issues/new/choose) with your OS, app commit and steps. Never paste keys or tokens.
