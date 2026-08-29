# 04 — Code structure

## 4.1 Which package owns what

| Package | Owns | Must not |
| --- | --- | --- |
| `packages/app` | The one renderer. SolidJS routes, screens, state hosts, all user-visible copy. | Own HTTP wire details, hold credentials, assume Electron |
| `packages/cortex-api` | The typed client for `https://api.cortex.foundation` — endpoints, cookies, error classification, `PROVIDER_CATALOG`, `CONTRACT.md`. | Import Solid, render UI, touch the DOM |
| `packages/main` | Electron main: windows, harness, PTY, SQLite, keychain, `cortex:*` IPC. | Contain product copy |
| `packages/preload` | The context bridge and nothing else. | Add a namespace without updating the exposure-surface test |
| `packages/shared` | Types crossing the bridge (`types/ipc/*`). | Depend on `app` or `main` |
| `packages/tokens` | Design values. `layout.ts` by hand, the rest generated from Paper. | Be hand-edited where generated |
| `packages/ui` | The presentational kit. | Know about routes or stores |
| `packages/ai-engine` | Provider adapters and the agent loop. | Emit user-facing strings |

**Bad** — the screen knows the wire format, the header, and the host:

```tsx
// packages/app/src/screens/automations/automations-screen.tsx
const res = await fetch('https://api.cortex.foundation/v1/automations', {
  headers: { 'x-cortex-session': token() },
});
const rows = (await res.json()).data.map((r: any) => ({ id: r.automation_id }));
```

**Good** — the client owns the endpoint and the shape; the screen owns the copy:

```tsx
// packages/cortex-api/src/automations.ts
export async function listAutomations(): Promise<Automation[]> { … }

// packages/app/src/state/automations.ts
const automations = createRemoteCollection(listAutomations);

// packages/app/src/screens/automations/automations-screen.tsx
<RemoteStateView state={automations.state} empty={{ title: 'No automations yet', … }}>
  <AutomationList items={automations.items()} />
</RemoteStateView>
```

Two more boundaries worth stating because they are easy to cross by accident:

- **`packages/app` must not require the desktop host.** Both hosts run the same
  screens. Feature-detect with `hasElectronHost()` / `window.cortex`; never
  assume the bridge exists. See `docs/web-vs-electron.md`.
- **`packages/app` must not import `@cortex-ide/tokens` directly.** It consumes
  the design system through `@cortex-ide/ui`, which imports the token
  stylesheets. Reaching past `ui` splits the theme in two.
- **Do not require cloning `CortexLM/backend`** to build or test this repo. The
  contract lives in `packages/cortex-api/CONTRACT.md`.

## 4.2 The service is the source of truth; `localStorage` is not

Planning, Projects, Library and chat preferences all used to be `localStorage`
arrays. They are not any more, and the reason is in the modules themselves: a row
that exists only in the browser is a row the user loses on another device and a
row the service never agreed to.

`localStorage` in `packages/app/src` is limited to these keys, and adding a new
one needs a reviewer to agree in the PR:

| Key | Module | Why it is allowed |
| --- | --- | --- |
| `cortex.theme` | `app.tsx` | A device preference; no server meaning |
| `cortex.inbox.v1` | `state/inbox.ts` | Locally posted notifications |
| `cortex.bots.cache.v2` | `state/bots.ts` | Cache of the last successful list, reconciled on open |
| `cortex.harness.remote-host` | `state/harness.ts` | A host URL this device connects to |

### No fake rosters

The specific defect this rule exists to prevent: seeding a list into
`localStorage` so a screen looks populated. It demos beautifully and it is a lie.
The user cannot delete those rows on the server, they do not appear on their other
device, and the first real API response either duplicates them or silently drops
them.

**Bad** — invented mascots, indistinguishable from real ones:

```ts
// packages/app/src/state/bots.ts
const SEED: Mascot[] = [
  { id: 'seed-1', name: 'Pip',  shape: 'round',  color: 'green' },
  { id: 'seed-2', name: 'Nib',  shape: 'square', color: 'clay'  },
];

export function loadMascots(): void {
  if (!localStorage.getItem(CACHE_KEY)) writeJson(CACHE_KEY, SEED);  // fake roster
  setMascots(readJson(CACHE_KEY, SEED));
}
```

**Good** — the cache is only ever a copy of something the service returned, and
an empty account shows an empty state:

```ts
const CACHE_KEY = 'cortex.bots.cache.v2';

export async function loadMascots(): Promise<void> {
  setLoadState('loading');
  try {
    const list = (await listMascots()).map(mapMascot);
    reconcile(list);                       // the only cache writer
    setLoadState('ready');
  } catch (error) {
    setLoadState(classifyBotError(error).kind);
  }
}
```

Rules that follow from this:

- Writes hit the API **first**. A row appears in the UI after the service accepts
  it, not before. No optimistic row that cannot be rolled back.
- Only one function may write a cache (`reconcile`). Create / update / delete
  never write it.
- A cache read may fill the first frame; it may never be presented as a
  successful load. If the refresh fails, say the connection failed — do not show
  stale rows as current.
- Mock providers are allowed only where they are *honest about being offline*
  (e.g. `provider === 'mock'` in `state/bot-map.ts` renders an offline computer
  state). A mock that renders as live data is the bug.
- Fixtures live under `__tests__`. Production modules do not import them.

## 4.3 No screen standing in for another

Each destination gets its own screen module under `packages/app/src/screens/<area>/`,
wired through a route adapter in `packages/app/src/routes/`, listed in
`packages/app/src/routes.ts`, and mounted in `packages/app/src/route-tree.tsx`.

The specific defect: reusing the Chat conversation view for a Code cloud screen.
Code Cloud is a dashboard — sessions, review, automations, usage — and a chat
transcript is not a dashboard. Pointing `/code/*` at a conversation view makes the
route look implemented while the product is missing. See `06-product.md`.

**Bad**:

```tsx
// packages/app/src/route-tree.tsx
<Route path="/code" component={ConversationScreen} />        {/* chat view as Code */}
<Route path="/code/review" component={ConversationScreen} /> {/* placeholder */}
```

**Good**:

```tsx
<Route path="/code" component={HomeRoute} />
<Route path="/code/sessions" component={SessionsRoute} />
<Route path="/code/sessions/:sessionId" component={SessionDetailRoute} />
<Route path="/code/review" component={ReviewRoute} />
<Route path="/code/automations" component={AutomationsRoute} />
```

If a destination is genuinely not built yet, it renders an honest state naming
what is coming — it does not borrow another product's screen, and it does not
silently redirect.

## 4.4 Module hygiene

These fail the build, so save yourself the round trip:

- TypeScript `strict`. No `any` to get past a compile error; type the boundary.
- ESLint: `max-lines` 300, `max-lines-per-function` 50, `complexity` 10,
  `max-depth` 5, `max-params` 4. Split the module. Do not add an inline disable.
- One screen module per destination; route adapters hold the wiring, screens hold
  the markup and copy, `state/` holds the data.
- Vitest only. Do not import `bun:test` (`bun run test:discovery` enforces this).
- Circular imports are checked by `bun run quality:circular`.
