# Notifications

Cortex has one inbox and two OS adapters. A notification is a real event,
not a restatement of a list that already has its own screen — except where
the event *is* a Code run changing state.

## Kinds

| Kind | When |
| --- | --- |
| `scheduled-task` | A Planning job finished and has a result. |
| `mention` | Someone mentioned you in Chat or a project. |
| `code-run-done` | A Code session reached review / completed. |
| `code-run-blocked` | A session is waiting on Allow / Always / Deny. |
| `bot-ask-user` | A mascot needs an answer before it can continue. |
| `farm-wake-fail` | A Bot computer failed to wake. |

## Surfaces

1. **In-app center** — command palette → Notifications, and the
   `/code/notifications` page. Shared store: `packages/app/src/state/inbox.ts`.
2. **Electron** — `Notification` from the main process (`notify:show`).
   Shown when the window is unfocused or the user allowed banners.
3. **Web** — `Notification.requestPermission()` then `new Notification()`.
   Denied permission is remembered; the in-app center still works.

## Implementation notes

- Opening an item navigates to the object it is about (session, task,
  mascot). Items with nowhere to go stay in the list without a dead link.
- Mark-as-read is offered only when something is unread.
- Main never logs the notification body if it might contain user content
  from a private repo. Titles are enough for the OS banner.
