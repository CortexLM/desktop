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
| **Work** | `screens/work` | Tasks handed to bots, approvals, automations, inbox, activity. Live: task board from bot sessions, permission approvals, automations on `/api/tasks` |
| **Bots** | `screens/bots` | Teammates with a mascot (shape, colour, eyes, mouth, accessories), persona, memory and routines. Live: CRUD, memory, routines |
| **Files** | `screens/files` | Document, media and code viewers. Viewers are preview-only; live mode shows `upload` |
| **Cortex Code** | `screens/code` | Coding agent on a local folder. Live: home picks a folder with the native dialog and starts a `code` session with the `build` agent; session transcript |
| **System** | `screens/system` | Settings, search, command palette, projects, memory, onboarding, login, about, offline/error/update states |

Settings sections (`screens/system/settings.tsx`): General, Appearance, **Providers &
models** (live), **Connection** (live), Bot, Notifications, Privacy, Shortcuts, Account. See `docs/providers.md`, `docs/connection-modes.md`.

## 6.2 Blocked on design — say so, build nothing

These have engine routes but no design, so the app has **no screen** for them:

| Surface | Engine | Design request |
| --- | --- | --- |
| **Space** (pages, sites, images, recents) | `/api/space` | filed |
| **Scheduled** (standalone list, suggestions, run history) | `/api/tasks` | filed |
| **Plugins & skills** (installed/public/personal, MCP add) | `/api/plugins`, `/api/skills`, `/api/mcp` | filed |

Requests live in the design reference's `DESIGN-REQUESTS.md` (outside this repo).
**Bad**: a quick unstyled list at `#/space`. **Good**: nothing until the design lands; the
rail's "More" entry stays as it is.

Also not built: Cortex Cloud sign-in (no engine route; the live login submit shows
"unavailable" — `screens/system/account.tsx`).

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
