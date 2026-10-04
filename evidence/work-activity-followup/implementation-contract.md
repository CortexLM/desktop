# Work Activity — next bounded local delivery

Base `96df66c`; implement after Memory's matching proof closes.
Use incumbent `#/activity` timeline, Bot picker, chips, loading/empty states and kit.
No new server route. Read latest completed outcomes from existing root Bot sessions.

- Split existing live/preview components; preserve preview geometry/copy/interactions.
- Read sessions and Bots, subscribe before reads. Select at most 40 root Bot sessions
  with nonempty botID by updated timestamp/ID. From each ascending message list, select
  its last assistant with a finite persisted completion time. Omit only roots lacking one.
- Success has no error; `aborted` means Interrupted; other errors mean Failed. Derive from
  persisted message, never idle status. Retain the earlier finished turn during a follow-up;
  replace only when a newer assistant completes. A hard process loss without completion
  supplies no new row. Labels describe past turns, never current task/business success.
- Sort/group rows by assistant completion timestamp, then stable session/message IDs.
  Routine-created Bot sessions qualify once; do not also append routine-run rows.
- Show title, exact Bot metadata, localized outcome/time only. Never render transcript,
  tool arguments/output or raw error.message. Missing Bot uses neutral fallback;
  duplicate names remain separate ID-filter options.
- Reuse All/Errors chips; show only classifications backed by these records. Both failed
  and interrupted belong to Errors. Date formatting uses existing locale hooks.
- Native buttons open exact `work-task?id=<sessionID>`; keyboard/pointer work at 960×640
  and 1440×900, light/dark. Keep disabled export until an export contract exists.
  Verify this destination does not borrow another Bot's mascot/name for a missing ID;
  a narrow existing-target correction is in scope if required.
- Loading/error/Retry reflects session/Bot/history reads. Missing history 404 removes
  only that record after an authoritative list refresh; later responses cannot resurrect
  deleted sessions. Failure to refresh must surface failure instead of apparent success.
- Refresh on session creation/update/delete and completed `message.updated`, not tokens.
  Sequence/unmount guards; canceled preview navigation preserves the outgoing tree and
  does not strand re-entry. Failed source Retry reloads real data.
- State the recent-40-root scope honestly. Root selection is bounded, transcripts are
  fully read per selected root. `ponytail:` names ceiling and eventual server summaries.
- Full Inbox and notifications need durable read/handled/archive/retention contracts;
  their preview actions do not imply live delivery. Separate later correction must stop
  Inbox claiming All handled while decisions are pending.

Verification: persisted success/failure/interruption and process restart; earlier completion
survives a later user/in-progress turn; two same-name Bots, missing Bot, exact session links;
failed list/history Retry, late response after delete/filter changes, 40-root ceiling,
no transcript/raw-error leak; preview state comparison and native theme/keyboard capture.
English live scope/outcome copy localized across eight catalogs. Same-change AGENTS,
product/engine/testing docs. Existing Memory evidence remains bound to its own revision.

New English live keys, `work` namespace:
- `act.recentScope`: `The latest finished turn from each of up to 40 recently updated Bot conversations.`
- `act.completed`: `Completed`
- `act.failed`: `Failed`
- `act.interrupted`: `Interrupted`
- `act.missingBot`: `Unavailable Bot`
- `act.recentEmptyTitle`: `No finished turns here`
- `act.recentEmptyText`: `Finished Bot turns from these recent conversations will appear here.`
Reuse existing loading, Retry, All/Errors and conversation-title fallback keys when true.
Missing Bot metadata must not fabricate deletion or mask a failed Bot list; such failures
use the retryable source-error state. Lists are unpaginated: 40 limits history-request
fan-out, not list size or bytes per transcript. Bot CRUD has no event; reread on remount
and Retry. All filters apply within the same 40-root selection; never expand per Bot.
