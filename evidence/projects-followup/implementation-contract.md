# Projects implementation contract — G1

Application base: `99e3d04`. Existing frozen Projects/Project, Chat move selector,
Library cards, Search results and sidebar rows supply the UI. No new design import.

- `Project`: `{id,name,icon,color,instructions,time:{created,updated}}`.
- Name trimmed 1–48; instructions at most 4000; exact existing eight icons/six hex
  identity swatches; strict writable create/update schemas. Defaults calendar/violet/empty.
- Routes `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`;
  `api.projects.list/create/get/update/delete`. Existing error/status vocabulary.
- `Session.projectID?: string`; create optional, update string/null; list optional
  `projectID`. Only root Chat sessions may hold membership; null detaches. Children
  resolve their root's current project. Reject unknown projects, non-Chat/child assignment,
  membership changes while root or descendants are admitting/running.
- Snapshot project instructions during reserved admission, before asynchronous lookups;
  include in model system context and token budgeting. Edits affect later turns only.
- Optional `PromptInput.expectedProjectID` (ID or null) guards the caller's captured
  membership synchronously before admission. A mismatch refuses with no message/inference;
  absent preserves existing callers. Home supplies its route project or null, preventing
  deletion/move races from silently sending outside the requested project.
- SQLite document kind `project`; no new table or dependency. `project.changed`
  live event after committed create/update. **Delete preserves conversations**: one durable
  `project.deleted {projectID}` event atomically removes the project document and detaches
  every linked session in its projection; messages/models/times remain unchanged. Refuse
  while any linked root/descendant is busy. No nested transaction or sequential partial
  detach. Session lists refresh on `project.deleted` as well as `session.*`.
- UI: create/list/detail/instructions, delete, project-scoped Home send, Chat move/detach,
  sidebar discovery, Search/command, Library and filtered History. Accepted writes only;
  refusal retains drafts; pending actions reject duplicates; stale owners cannot navigate
  or apply saved text to another project. Home reuses the first created session after an
  admission refusal. Missing project never falls back to an ungrouped conversation.
- `useProjects()` uses existing `useQuery` and `project.*` events; ID-keyed live detail.
  Existing `useSessions` API remains compatible. Reuse all existing catalogs/Base UI.
- Rename UI, archive, files, sharing and assigned Bot remain their existing unavailable
  scope pending exact design/lifecycle work. Report them honestly; no fixture rows in live.
- Preview geometry/interactions retained. Any necessary CSS adjustment follows measured
  minimum-window failure. No new framework, package, provider/authentication behavior.

Verification: real protocol/client persistence across reopen; validation; duplicate names;
atomic delete/detach retention including forced rollback; busy root/child/admission refusal;
instruction snapshot/budget/next-turn/detach; Electron create/instructions/Chat/move/discovery,
two process restarts, stale-owner/read/save/refused-send behavior, both themes and window
sizes. Existing mandatory lint/types/units/i18n/build/Electron/package/native proofs apply.
