# Architecture

## Processes

```
┌──────────── Electron main (packages/desktop/src/main.ts) ────────────┐
│ createCore({ dataDir, credentials, remoteProbe, skills, plugins })    │
│ createServer(core)  → Hono app, called as app.fetch(Request)          │
│ ipcMain "cortex:fetch"  ─ request/response for /api/*                 │
│ ipcMain "cortex:events" ─ SSE body pumped as "cortex:events:chunk"    │
│ ipcMain "cortex:pick-directory", "cortex:open-external"               │
│ protocol cortex://app   ─ serves packages/app/dist                    │
│ native menu (i18n) → "cortex:menu" commands                           │
└──────────────────────────────▲───────────────────────────────────────┘
                               │ contextBridge (plain data only)
┌───────────── Renderer (sandboxed, packages/app) ─────────────────────┐
│ window.cortex (packages/desktop/src/preload.ts)                       │
│ api.ts: bridgeFetch() rebuilds Response objects → @cortex/client      │
│ state/live.ts: one SSE subscription, queries refetch on events        │
└───────────────────────────────────────────────────────────────────────┘
```

There is no listening socket in the app. `listen()` in `packages/server` is used only by
`scripts/dev-api.ts` and tests.

Connection selection does not change this data path: all prompts still reach the local
`SessionService`, models.dev catalog and provider settings. The vendored SDK is used only
by the main-process remote probe; no remote session/auth transport is wired.
See [connection-modes.md](./connection-modes.md).

## Packages

| Package | Depends on | Notes |
| --- | --- | --- |
| `@cortex/schema` | zod | Contracts, ids, `ErrorCode`, events. Browser-safe |
| `@cortex/core` | schema, AI SDK, MCP SDK | Engine. Node only. [`packages/core/README.md`](../packages/core/README.md), [engine.md](./engine.md) |
| `@cortex/protocol` | schema, hono | Route table (`packages/protocol/src/index.ts`) |
| `@cortex/server` | core, protocol | `createServer(core)` binds each route to a core call |
| `@cortex/client` | schema | `createClient({ fetch, baseUrl })`, `subscribe()` SSE |
| `@cortex/i18n` | — | Translator + `vite`/`node` catalog loaders ([i18n.md](./i18n.md)) |
| `@cortex/app` | client, schema, i18n | Renderer |
| `@cortex/desktop` | core, server, schema, i18n, vendored `@cortex/sdk` | Main + preload |

## Build

- `bun run build:app` — Vite → `packages/app/dist`.
- `bun run build:desktop` — `packages/desktop/build.mjs`, esbuild bundles
  `dist/main.cjs` and `dist/preload.cjs` (CJS, node22, workspace packages inlined,
  `electron` external).
- electron-builder (`electron-builder.yml`) packs both `dist` folders and `package.json`
  into the asar, excludes `node_modules`, and copies `packages/i18n/locales` to
  `resources/locales` with `!**/*.source.json` and `!**/fixtures/**` filters. Preview fixtures
  remain bundled by Vite; catalog/preview loaders exclude source stamps ([i18n.md](./i18n.md)).
  `skills/` is copied to `resources/skills`. `appId` `foundation.cortex.desktop`, product
  name `Cortex`, `cortex` URL scheme declared. No publish configuration remains.

## Renderer

- Hash routing: `#/<screen-id>?v=<variant>&theme=…&preview|shot` (`shell/nav.tsx`).
- Screens: `packages/app/src/screens/<area>/index.tsx` export `SCREENS: ScreenDef[]`;
  `registry.tsx` globs them. Unknown ids render `shell/not-found.tsx`.
- `#/gallery` (`shell/gallery.tsx`) renders every screen × variant × theme in iframes.
- Preview mode (`preview.tsx`) loads fixtures from
  `packages/i18n/locales/<locale>/fixtures/*.json`; live mode never does.
- Kit: `kit/ui.tsx` (components over `@base-ui/react`), `kit/styles.css` (theme variables).

## Data

`<dataDir>` = `CORTEX_DATA_DIR` or `<userData>/engine`:

| Path | Contents |
| --- | --- |
| `cortex.db` | SQLite (WAL): event log, session/message/part projections, docs |
| `cache/models.json` | Last good models.dev catalog |
| `credentials.json` | Provider keys, `0600`, `safeStorage`-encrypted when available |

Skills are discovered under `<resources>/skills` (builtin), `~/.cortex/skills` (personal) and
`<project>/.cortex/skills`; plugins under `~/.cortex/plugins`. The builtin
[`skills/summarize/SKILL.md`](../skills/summarize/SKILL.md) ships in packaged resources;
development Electron builds read the repository's `skills/` directory. The standalone
`scripts/dev-api.ts` does not configure skill directories.

## Security boundary

See [`.rules/01-security.md`](../.rules/01-security.md). Summary: sandboxed renderer,
navigation locked to `cortex://app`, `https://` only for external links, CSP in
`packages/app/index.html`, keys write-only from the renderer.
