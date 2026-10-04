# 04 — Code structure

## 4.1 Which package owns what

| Package | Owns | Must not |
| --- | --- | --- |
| `packages/schema` | zod contracts, ids, `ErrorCode` | import Node or Electron |
| `packages/core` | engine services, storage, tools, permissions | import Electron or React |
| `packages/protocol` | route table, validation, error shape | hold logic |
| `packages/server` | binds routes to core (`createServer`) | open a socket in the app (`listen` is dev/test only) |
| `packages/client` | typed fetch client, SSE parser | import Node |
| `packages/i18n` | catalogs, translator, loaders | contain UI code |
| `packages/app` | screens, shell, kit, renderer state | call the network directly, hold keys |
| `packages/desktop` | Electron main, preload, credentials, menu, remote probe | put product logic in main that belongs in core |

New engine capability: schema type → core service → protocol route → server handler →
client method → screen. The renderer reaches the engine only through `api` in
`packages/app/src/api.ts`.

**Bad** — renderer calls a backend directly (blocked by CSP anyway):

```ts
await fetch("https://api.cortex.foundation/v1/models")
```

**Good** — main probes the backend, the renderer asks the engine:

```ts
await api.connection.probe()
```

## 4.2 The engine is the source of truth; `localStorage` is not

`localStorage` holds UI preferences only (`cortex.theme`, `cortex.locale`,
`cortex.onboarding.done`). Sessions, bots, providers, tasks and connection live in the engine.

## 4.3 No seeded data, fixtures only in preview

A fresh install has no chats, no bots, no sessions, and each screen says so. Fixture
content lives in `packages/i18n/locales/<locale>/fixtures/<area>.json` and is read only via
`useFixtures()` when `isPreview()` is true (`packages/app/src/preview.tsx`). Packaged
builds exclude `fixtures/` from `resources/locales` (`electron-builder.yml`).

**Bad**:

```tsx
const bots = useBots();
const list = bots.state === "ready" && bots.data.length ? bots.data : fx.team;   // invents rows
```

**Good** — `packages/app/src/shell/shell.tsx`:

```tsx
{sessions.state === "ready" && !sessions.data.length && <div className="sb-empty">{t("shell.nav.noChats")}</div>}
```

## 4.4 No screen standing in for another

A screen that has no live wiring renders its preview only in preview, and an honest
state in live mode (e.g. unwired file formats fall back to `upload`). Surfaces blocked on design
(Space, Scheduled, Plugins & skills) get **no** placeholder screen (`06-product.md`).

## 4.5 Screens and module hygiene

- One area per folder: `packages/app/src/screens/<area>/index.tsx` exports `SCREENS:
  ScreenDef[]`; `registry.tsx` globs them. Variants (`?v=`) model states.
- TypeScript `strict`; `@typescript-eslint/no-explicit-any` is an error outside tests.
- `react-hooks/rules-of-hooks` is an error. Do not disable lint rules to pass.
- Vitest only for unit tests (`vitest.config.ts`).
- Mark deliberate simplifications with a `ponytail:` comment naming the limit.
