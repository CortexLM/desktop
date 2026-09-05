# 06 — Product

The product is **Cortex**. This desktop app is Chat + Code, one renderer. This
file is the boundary between them. Anything here is locked: do not reopen it in a
drive-by PR, and do not "simplify" one product into another.

## 6.1 Chat is not Code is not Bot

Chat and Code share this shell, the tokens, the sidebar and the theme. They do
not share purpose, and they do not share screens. Bot is a separate desktop app
(`CortexLM/bot-desktop`). This repo keeps Bot API clients and `/bot` routes so
the service contract stays intact; they are not a third tab in the chrome.

| | Chat | Code | Bot |
| --- | --- | --- | --- |
| Purpose | Conversation, research, planning, a library | A coding-agent cloud workbench | A persistent mascot with its own computer |
| Paths | `/`, `/chat/:id`, `/research`, `/planning`, `/projects*`, `/library`, `/plugins`, `/settings` | everything under `/code` | everything under `/bot` (not in this shell's switcher) |
| Unit of work | a conversation | a **session** (repo, branch, plan, permissions, diff) | a **mascot** |
| Shape | transcript + composer | dashboard: inbox, detail, review, automations, usage | leftover roster + conversation workbench + computer rail |
| Sidebar | `ChatSections` | `CodeSections` | not in this desktop chrome |

The switch is by URL prefix through `productForPath()` in
`packages/app/src/routes.ts`. Sidebar sections come from
`packages/app/src/shell/sidebar-sections.tsx`. Code's rail is **New session**,
**Routines** (automations), **Personalize** (settings), then Workspace
destinations, then **Recents** of Code sessions — not Chat transcripts.

The Chat | Code | Bot switcher is in the sidebar and, on desktop, also in the
custom title bar (`packages/app/src/shell/title-bar-chrome.tsx`).

**Bad** — Code implemented as a second Chat:

```tsx
// packages/app/src/route-tree.tsx
<Route path="/code" component={ChatHomeScreen} />
<Route path="/code/:sessionId" component={ConversationScreen} />
```

That renders a message list where the user expects to see which sessions are
running, on which branch, waiting for which permission. It is not a smaller Code
— it is a missing Code with a route in front of it.

**Good** — each Code destination is its own screen:

```tsx
<Route path="/code" component={HomeRoute} />
<Route path="/code/sessions" component={SessionsRoute} />
<Route path="/code/sessions/:sessionId" component={SessionDetailRoute} />
<Route path="/code/review" component={ReviewRoute} />
<Route path="/code/automations" component={AutomationsRoute} />
<Route path="/code/usage" component={UsageRoute} />
```

## 6.2 Code is a real cloud dashboard (Paper Concept 03)

Code is drawn on Paper page **Concept 03** of the Paper file *Cortex FF1 v1*
(`01M0WGA7TGHQFZ2H22QFE3YZ9C`, group `C3`). The manifest is
`design/paper/screens.json`; `packages/app/src/routes.ts` is asserted against it
by a test. If your change adds a screen, it belongs on the artboard first.

The destinations, and what each one must actually do:

| Route | Must show |
| --- | --- |
| `/code` | Empty home (TUI preview + host picker) when no session has run; composer, recents and harness once there is history |
| `/welcome` | First-launch splash (desktop). Get started → sign-in; skip → workspace |
| `/code/sessions` | The inbox — sessions grouped by repository, with real state |
| `/code/sessions/:id` | Plan, permissions, terminal, changes; `/focus` variant |
| `/code/automations` | Scheduled cloud runs (account) |
| `/code/review` | Review queue (account) |
| `/code/usage` | Usage and limits (account) |
| `/code/settings`, `/code/settings/integrations` | Providers, workspace defaults, remote host |
| `/code/notifications` | Notable events |
| `/code/runtimes`, `/code/runtimes/ssh` | Runtimes; connect a server |
| `/code/tickets*` | Tickets |

Behaviour that is part of the product, not an implementation detail:

- **Permissions are Allow / Always / Deny on the session.** File writes and shell
  commands are never silent.
- **The harness is the only thing that touches disk, a PTY, and Git.** Desktop may
  run it locally; status is Connected (this machine's hostname), Connecting,
  Disconnected, permission blocked, or failed wake.
- **Web never runs the harness in the tab.** Web status starts at *Cloud only*, or
  connects to a **named** Cortex Code host the user already runs. There is no HTTP
  fallback that runs tools in the browser. Starts and permission decisions go over
  `/v1/realtime`.
- **A cloud session shows *Cloud session running*** even when the local harness is
  down. The two are independent.
- **A connected host is paired with a one-time code** — the service stores a hash,
  the client never does. Heartbeats carry a device token, never SSH or provider
  keys. SSH and host keys are not downloaded to the client.
- **Signed out on desktop**, Home / Sessions / Session detail / Settings work
  with **This PC** or BYO providers. Automations, Review, Usage and SSH connect
  are shown and locked (`01-security.md` § 1.3). Creating a Bot on leftover
  `/bot` routes needs an account.
- **This PC Code sessions** start only after the native folder picker. The
  coding agent runs against that tree via the desktop harness. Cloud and SSH
  go through the control plane and never silently run locally.
- **There is no in-app Benchmarks screen.** Provider benches live in
  `packages/test-harness` (`cortex-test`).
- **Cortex Code has no Secrets page.** See § 6.2.1.

### 6.2.1 Cortex Code has no Secrets page

Code is not a vault. There is no `/code/secrets` route, no Secrets screen, no
Secrets entry in the sidebar, on Home, in Settings or in the command palette, and
no board for one in the manifest — `paper-sync` filters the retired `Code /
Secrets` artboard out. The one place a credential is entered is **Settings →
Providers**, where the user is naming their own account and the key goes
main → keychain.

**Bad** — the page comes back under a new name, and asks the user to paste a
credential into the renderer:

```tsx
<Route path="/code/vault" component={VaultRoute} />
…
<TextField label="Personal access token" type="password" placeholder="Paste the value" />
```

**Good** — the route does not exist, and nothing offers to hold a value:

```tsx
<Route path="/code/settings" component={SettingsRoute} />
<Route path="/code/settings/integrations" component={IntegrationsRoute} />
```

A reintroduction is a product decision, not a refactor: neither Cursor nor any
comparable coding agent ships this surface, and re-adding it needs the rule
changed first. Renaming it — Vault, Environment, Variables, Tokens — is the same
page. `/v1/code/secrets` may stay in `packages/cortex-api` for other callers, but
no screen in Code reaches it.

**Bot's secret-request card is a different surface.** A mascot runtime may ask for
one named value in the transcript and the composer blocks until it is answered
(`POST /v1/mascots/:id/secrets`, `docs/bot-runtime.md`). That is a reply to a
question the runtime asked, not a page for managing a list. This rule does not
touch it.

## 6.3 The switcher is Chat | Code

This desktop app's switcher is a two-option segmented control in
`packages/app/src/shell/sidebar.tsx` and the desktop title bar
(`packages/app/src/shell/title-bar-chrome.tsx`), in this order, with these labels:

```tsx
<Segmented
  class="cx-sidebar__products"
  label="Product"
  value={props.product}
  onChange={(id) => props.onSwitchProduct(id as Product)}
  options={SHELL_PRODUCTS}
/>
```

`SHELL_PRODUCTS` is Chat then Code. Do not add Bot back to the chrome.

**Bad** — Bot restored as a third tab in this app:

```tsx
options={[
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'bot', label: 'Bot', icon: 'bot' },
]}
```

**Good** — Chat and Code only; Bot lives in its own app:

```tsx
options={[
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'code', label: 'Code', icon: 'code' },
]}
```

Bot rules (service and leftover `/bot` screens; the dedicated Bot desktop app owns chrome):

- **Exactly one computer per mascot.** Not zero, not a pool.
- **The API is the source of truth for mascots.** `localStorage` caches the last
  successful list and nothing else; `reconcile()` is the only cache writer.
- **No seeded mascots.** A new account has an empty roster and sees an honest empty
  state that explains how to create one. Never ship starter mascots, sample
  mascots, or a demo roster — see `04-structure.md` § 4.2 for the exact
  anti-pattern.
- **Leftover `/bot` screens still have a Bot sidebar** when those routes are
  opened (including first-bot setup at `/bot/new`). It is not in this app's
  Chat | Code switcher. The list is the live roster (honest empty, no Sprite /
  Finch / Pebble), plus Studio: Routines, Memory, Approvals (`/bot/approvals`).
- **Conversation is a teammate workbench.** The header is the mascot / session
  name, never a user first name, never “Running”, never “View PR”. Messages are
  employee-style bubbles; tool dumps stay off the thread. The right rail is the
  **cloud** computer: a noVNC stream (screenshot fallback) and Take control /
  Release. This PC and SSH belong to Cortex Code, never to Bot.
- An offline computer says it is offline. It does not pretend to be thinking.
- **The computer is a cloud farm box.** Cortex Bot never offers This PC, This
  desktop, or SSH as a host. This PC is Cortex Code on the desktop app. SSH
  stays SSH, on Code (`/code/runtimes/ssh`). A Bot host picker with those
  options is a defect, not a simplification.

## 6.4 Chat is locked too

- Sidebar order: **Search, Research, Planning, Projects, Library, Plugins last.**
- **Planning is scheduled tasks**, not a project plan.
- Planning, Projects, Library and chat preferences are service-backed. They are
  not device-local lists (`04-structure.md`).

### Plugins list services, never our installer

Plugin cards name the service the user is connecting to, from the live catalogue
(`packages/app/src/state/plugins.ts`). The middleware we install through is
internal plumbing: it is a field on the catalogue envelope, never a card, never a
label, never a subtitle, never in an error body.

**Bad** — our integration vendor rendered as though it were an app the user wants,
in three places on one screen (real copy, since fixed, in
`packages/app/src/screens/chat/plugins-screen.tsx`):

```tsx
subtitle="Connect the services you already use. Install path is Composio."
…
body={props.error || 'Composio is not configured on this backend. Drive and Slack are not connected.'}
…
<Button variant="primary">Connect with Composio</Button>
```

**Good** — the user sees the four services and one honest failure state:

```tsx
subtitle="Connect the services you already use."
…
body={props.error || 'Plugins are not available on this workspace yet. Nothing is connected.'}
…
<Button variant="primary">Connect</Button>
```

A 503 from the plugin catalogue means "plugins are not available on this
workspace". It does not mean an empty list, and no card is ever shown as
connected unless the API says so.

### A plugin is assigned to Chat, Bot, or both

The account decides which product may use a connected plugin's tools. That is the
connection's `surfaces` — `chat`, `bot`, or both — chosen on the card before
Connect and changed on the card afterwards. Locked behaviour:

- **At least one surface, always.** A connection on neither is reachable from
  neither product; the way to have that is Disconnect, and the card says so
  rather than sending a change the service would refuse.
- **The switches describe the account, not the click.** A change on a connected
  plugin is a write, and the switch moves when the service has agreed. A failed
  write leaves it where it was and says nothing was changed — a switch that
  moved locally would claim a filter no turn is applying.
- **Silence is not "off".** A connection the service describes without
  `surfaces` is not filtered, so it reads as both. Drawing two empty switches
  over a connection whose tools both products can reach is the lie this rule
  exists to prevent.

## 6.5 Naming

- The product is **Cortex**. Cortex Code and Cortex Chat are this desktop app.
  Cortex Bot is a separate app. No other assistant brand and no internal
  codename appears in code, copy, docs, branch names, commit messages, or PR titles.
- The domain is **`cortex.foundation`** (`api.cortex.foundation` for the service).
- UI copy is **English**, sentence case.
- Model providers the user brings a key for may be named in Settings, because the
  user is naming their own account (`02-errors.md` § 2.1). Nothing else in the
  supply chain gets named.
