# Configuration

> [!WARNING]
> **Alpha software.** Cortex Desktop is not recommended for production use. Features can change or break between commits, nothing is guaranteed to be stable, and builds are **unsigned** (no code signing, no notarization). Back up anything you care about and expect rough edges.

## Providers

Configure providers in **Settings, Providers and models**. Keys are write-only and stored by the main process in `<dataDir>/credentials.json` (mode `0600`, encrypted with the OS keychain when available). Details: [providers.md](./providers.md).

## Connection modes

Settings, Connection chooses where the app connects:

| Mode | What it means |
| --- | --- |
| Local | No Cortex account. Prompts use the local engine and configured providers, which may be remote. |
| Cortex Cloud | Probes the Cloud origin and signs in with an email code. Bots and signed-in Work, Chat and Code screens use the account. |
| Self-hosted | Same flow against a server you provide. |

Prompts still use the local engine and your configured providers. Sign-in lasts until Cortex closes. Full contract: [connection-modes.md](./connection-modes.md).

## Environment variables

| Variable | Effect |
| --- | --- |
| `CORTEX_DATA_DIR` | Data directory (default: `engine` under the app's user data path) |
| `CORTEX_LOCALE` | Locale override, e.g. `fr` |
| `CORTEX_CATALOG_URL` | Override the models.dev catalog URL |
| `CORTEX_RENDERER_URL` | Load the renderer from a dev server |
| `CORTEX_START_HASH` | Open at a route, e.g. `#/gallery` |
| `CUA_DRIVER_PATH` | Path to the computer-use driver ([computer-use.md](./computer-use.md)) |

Locale order: Settings choice, `CORTEX_LOCALE`, a supported system language, then English ([i18n.md](./i18n.md)).
