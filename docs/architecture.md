# Architecture

## Processes

```
┌──────────── Electron main (packages/desktop/src/main.ts) ────────────┐
│ createCore({ dataDir, credentials, mcpCredentials, remoteProbe, … })  │
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
`SessionService`, models.dev catalog and provider settings. The vendored SDK powers the
main-process remote probe and process-lifetime `RemoteSession`. Core's injected `RemoteAuth`
host exposes only validated status, active `signedIn` and email; main owns cookies, tokens
and pending continuations. Its private Chat binding provides model/upload/turn/history
transport under the same account epoch. Core's internal `remoteSessions` service projects
those streams in process-only Maps, with separate remote views and identifier-only events.
Main supplies one shared owner for auth and Chat. Remote publication skips persistence
and local plugin delivery; public routes and renderer dispatch remain pending.
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

Shared zod contracts disable dynamic compilation before schema initialization. This avoids
evaluation probes under the renderer's strict CSP; validation uses the interpreter in every host.

- Hash routing: `#/<screen-id>?v=<variant>&theme=…&preview|shot` (`shell/nav.tsx`).
  The URL is authoritative; native browser history retains session IDs and variant parameters.
  Electron's Navigation API updates React for hash, back/forward and replace-state changes.
  Preview personal requests keep only their initial text/model in the history entry, distinct
  from fixture conversations at the same URL. Theme selection replaces that entry without
  dropping its identity or draft. Live conversations remain engine-owned sessions.
- Menu routing lives above Shell so Help → Design gallery and its return paths work.
  Gallery transitions skip view snapshots because hundreds of iframes block input; ordinary
  screen transitions remain. Native Go entries for undesigned surfaces are disabled.
- Screens: `packages/app/src/screens/<area>/index.tsx` export `SCREENS: ScreenDef[]`;
  `registry.tsx` globs them. Unknown ids render `shell/not-found.tsx`.
- `#/gallery` (`shell/gallery.tsx`) renders every screen × variant × theme in iframes.
  A viewport observer loads visible frames and unloads offscreen ones; iframe visits use
  replacement navigation so preview loading does not pollute the parent history.
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
| `mcp-credentials.json` | Complete MCP connection configurations, same main-only credential storage |

MCP SQLite documents hold name/type/enabled and an opaque connection reference. The host passes
a separate `mcpCredentials` store to `createCore`; in-memory engines default to an in-memory store.
Persistent hosts without one refuse MCP writes/migration instead of losing connection material
on restart. Public MCP reads never include command/arguments/environment/URL/headers.
Credential-file writes use an exclusive `0600` temporary file plus same-directory rename.
Invalid/unreadable stores are refused instead of silently replaced. Failed writes preserve
the previous file; this is not a cross-process locking or power-loss durability guarantee.

Skills are discovered under `<resources>/skills` (builtin), `~/.cortex/skills` (personal) and
`<project>/.cortex/skills`; plugins under `~/.cortex/plugins`. The builtin
[`skills/summarize/SKILL.md`](../skills/summarize/SKILL.md) ships in packaged resources;
development Electron builds read the repository's `skills/` directory. The standalone
`scripts/dev-api.ts` does not configure skill directories.

## Security boundary

See [`.rules/01-security.md`](../.rules/01-security.md). Summary: sandboxed renderer,
navigation locked to `cortex://app`, `https://` only for external links, CSP in
`packages/app/index.html`, keys write-only from the renderer.
