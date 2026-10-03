# Persistent Memory pause — G1 contract

Base application `f82a648`; existing Memory and Settings Privacy controls only.
One global engine preference controls existing Bot saved-note injection. It does not
create personal cross-Chat memory or automatic learning. Saved notes remain intact.

- Shared strict `RuntimeSettings { memoryEnabled: boolean }`, default true only if the
  `settings/runtime` document is absent. Existing SQLite document storage; no new class,
  table, dependency or generic arbitrary-key settings bag.
- `GET/PUT /api/settings`; `api.settings.get/update`. PUT body is strict
  `{ memoryEnabled: boolean, initializeOnly?: true }`. The optional flag performs an
  atomic synchronous initialize-if-absent; existing stored values win. Return actual
  settings in every successful response; do not persist request flags.
- Invalid inputs return existing invalid_request. Malformed stored value is internal,
  never silently defaulted. Storage refusal preserves the old settings/notes.
- Publish live `settings.changed {}` after an accepted changed write. Read/migrate/PUT
  stay in main/core; renderer uses existing IPC client only.
- Legacy Privacy preference: on first live settings load, if localStorage literal
  `cortex.pref.privacy.memory` is `false`, call PUT false/initializeOnly true before
  presenting a settled state. Remove that key only after success and only if its captured
  value is unchanged. If an engine value already exists, it wins. Initialization failure
  displays error/Retry; no misleading enabled banner. Other values need no migration.
  Mount the existing settings hook once in the live shell so import begins on startup.
  Bot send entry points wait for that hook's settled setting if legacy false remains;
  a pre-renderer scheduled admission is outside this renderer preference import. Preserve
  this limitation explicitly; do not pretend main could read browser localStorage.
- Snapshot BotContext inside reserved prompt admission before async catalog/key work;
  reuse it in the runner, admission and incremental-output budgets. Global off skips
  stored memory lookup/injection but keeps persona/tool/permission restrictions.
  Each Bot retains its own notes; children/routines inherit that Bot identity. Ordinary
  Chat gains no first-Bot memory. Toggle affects future turns only; existing history
  may contain previously shared notes.
- Both live switches bind to one engine-backed state with shared settings events.
  Loading/error offers existing copy and Retry instead of inventing on/off state.
  Controlled state changes only on accepted PUT/authoritative refresh; synchronous
  pending guard, duplicate refusal, stale GET/write/unmount ownership. No new framework.
- Manual Add/list/export/Forget remain available while paused; entries/IDs/times stay
  unchanged across off/on/restart. Existing deletion/draft safety remains. Preview
  controls keep temporary variants and never migrate/write live settings.
- Reuse existing component geometry/Base UI. Switch wrapper receives optional disabled
  capability where needed. Pointer and keyboard access to paused live records match;
  preview fading/geometry remains as recorded.
- Add only necessary English-source localized live copy across all eight catalogs:
  state scope is saved Bot notes, no automatic learning claim. Existing preview copy
  stays preview-only; no first-Bot context is represented as personal global memory.

Exact new catalog keys (all eight locales; placeholders preserved):
- `system.memory.liveOnTitle`: `Saved Bot memory`
- `system.memory.liveOnText`: `Bots use the notes you add in Bot settings. Each Bot keeps its own notes.`
- `system.memory.liveOffText`: `Saved notes stay on this device. Bots stop using them in future turns; previous messages are unchanged.`
- `system.memory.liveEmptyText`: `Add notes in a Bot’s Memory settings. Notes are saved only when you add them.`
- `system.memory.livePausedText`: `Saved notes remain available to review, export or delete.`
- `system.settings.t.privacy.memoryLiveDesc`: `Allow Bots to use their saved notes in future turns.`
- `bots.set.memEmptyLiveText`: `Add a note for {name} to use in future turns when memory is on.`
Existing locale loaders use flat namespace keys without the namespace prefix in JSON.

Proof: real protocol/client strict writes, corruption/refusal, reopen, legacy initialize
race, two-Bot isolation, off/on actual system payload, ordinary Chat, child/routine,
reserved snapshot plus memory token budgets; Electron both-switch sync/restart and
legacy false, refused PUT/Retry/late response/no-Bot; existing memory safety cases.
Current Projects CI/native evidence is not evidence for this new behavior.
