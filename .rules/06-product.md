# 06 — Product

The product is Cortex. This file says what each surface is, what is live, and what is not
built yet. If a change moves a line in this file, update `AGENTS.md` too.

## 6.1 Two modes, one shell

The sidebar switcher has two modes: **Cortex** and **Cortex Code** (`Mode` in
`packages/app/src/kit/ui.tsx`). On Chat/Work home the title bar adds a **Chat | Work**
segmented control. The rail holds Home, Library, History, Bots, Activity, More, theme,
Settings.

| Surface | Area folder | What it is |
| --- | --- | --- |
| **Chat** | `screens/chat` | Conversations with a model the user configured. Live: home composer, transcript streaming, errors mapped to copy, recents in the sidebar |
| **Work** | `screens/work` | Tasks handed to bots, approvals, automations, inbox, activity. Live: task board from bot sessions, permission approvals, automations on `/api/tasks`, latest finished turns from up to 40 recently updated root Bot conversations in Activity |
| **Bots** | `screens/bots` | Teammates with a mascot (shape, colour, eyes, mouth, accessories), persona, memory and routines. Live: CRUD, memory, routines |
| **Files** | `screens/files` | Saved local Chat static PNG/JPEG/WebP viewing, Fit/zoom and original download; UTF-8 plain text/Markdown source, Copy and original download. Remaining formats are preview-only; unbound live routes show `upload` |
| **Cortex Code** | `screens/code` | Coding agent on a local folder. Live: home picks a folder with the native dialog and starts a `code` session with the `build` agent; session transcript |
| **System** | `screens/system` | Settings, search, command palette, projects, memory, onboarding, login, about, offline/error/update states. Projects persist locally; creation, instructions, Chat membership and discovery are wired. Project files/sharing/Bot/archive/metadata editing remain unavailable. |

Settings sections (`screens/system/settings.tsx`): General, Appearance, **Providers &
models** (live), **Connection** (live), Bot, Notifications, Privacy, Shortcuts, Account.
Privacy Memory and System Memory share the persisted engine preference for future use
of saved Bot notes; manual note management remains available while paused. Other execution
toggles in General, Bot, Notifications and Privacy remain unwired. See `docs/engine.md`,
`docs/providers.md`, `docs/connection-modes.md`.

## 6.2 Blocked on design — say so, build nothing

These have engine routes but no approved integration package, so the app has **no screen** for them:

| Surface | Engine | Design request |
| --- | --- | --- |
| **Space** (pages, sites, images, recents) | `/api/space` | filed |
| **Scheduled** (standalone list, suggestions, run history) | `/api/tasks` | filed |
| **Plugins & skills** (installed/public/personal, MCP add) | `/api/plugins`, `/api/skills`, `/api/mcp` | filed |

Requests and draft-delivery dispositions live in the design reference's `DESIGN-REQUESTS.md`
(outside this repo). Scoped defect confirmations do not approve an entire page or its live
engine contract. The local-contract gaps are recorded in
[`evidence/recovery-followup/productivity-contract-map.md`](../evidence/recovery-followup/productivity-contract-map.md).
**Bad**: a quick unstyled list at `#/space`. **Good**: nothing until the design lands; the
rail's "More" entry stays as it is.

Email-code sign-in now uses main-only process-lifetime authentication through the existing
login UI. Local-password/email-verification/MFA continuation screens remain unavailable
pending approved integration. Chats still use local providers; sign-in does not imply remote
model routing or inference. See [`docs/connection-modes.md`](../docs/connection-modes.md).

## 6.3 Local first

A new install opens on Chat home in **local** mode with no account. Without a provider
key, Chat shows a banner pointing to Settings → Providers & models — never a hang. Code
runs against the folder the user picked; there is no working-directory fallback.

## 6.4 Honest preview

Every screen state can be rendered with fixtures in preview (`#/gallery`, `?preview`,
`?shot`), and the title bar shows a state picker there. Live routes never read fixtures
(`04-structure.md`). A screen whose live state is unwired must not reuse its preview content.

## 6.5 Naming

The product is **Cortex**; modes are **Cortex** and **Cortex Code**; the cloud is
**Cortex Cloud** at `cortex.foundation`. No other assistant brand and no internal codename
in code, docs, copy, branches, commits or PR titles. Translators must not translate these
names (`scripts/translate-locales.mjs`).
