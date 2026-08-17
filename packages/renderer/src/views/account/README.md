# `views/account/` — status: unfinished interface, no backend

**These three views are not a working feature.** They are UI built against
invented data. They are reachable in the app (Workbench → Account → Profile /
Team / Billing), so they are written to say so on screen rather than to imply an
account exists.

## What was here, and what was measured

An earlier version of this directory shipped four views described as "✅
COMPLÉTÉE" and "entièrement implémentées". They rendered fabricated account
state as though it were the user's own:

| View | Invented data it presented as real |
| --- | --- |
| `BillingView` | 3 "paid" $29.00 invoices with Download buttons; 2 saved cards (Visa •••• 4242, Mastercard •••• 5555); quotas 127/200 sessions, $18.45/$50; 3 charts filled by `Math.random()` |
| `TeamView` | 4 named teammates with roles (John Doe, Jane Smith, Bob Wilson, Alice Johnson); a pending invite to `newcomer@example.com`; a 6×4 permission matrix |
| `ProfileView` | "John Doe" / `john.doe@example.com` as the signed-in user; avatar uploader; duplicate theme/language controls |
| `PlansView` | $29/mo Pro and $99/mo Enterprise tiers with "Save 17%" yearly pricing and checkout CTAs |

Measured on 2026-08-17, not assumed:

- **Zero** `account:`, `billing:`, `team:`, `subscription:` or `payment:` IPC
  channels exist in `packages/main/src/` .
- **Zero** such entries exist in the preload allowlist.
- **Zero** `window.cortex` calls were made by any file in this directory. The
  previous README's claim that it reused "les mêmes patterns de requêtes DB
  (`window.cortex.db.query`)" was false — no query was ever issued.
- There is **no auth, user, or team backend** anywhere in the repo.
- Every action handler was a `console.log` (`handleSave`, `handleInvite`,
  `handleUpgrade`) or absent entirely (Upload, Remove, Download, Resend,
  Revoke, Set Default, shortcut Edit).

So the charts, the invoice totals and the "Unsaved changes → Save" cycle were
not "not yet connected" — they were self-contained fiction. A fabricated `paid
$29.00` row is indistinguishable from a real charge to whoever reads it, which
makes this a correctness problem rather than a missing-tests problem.

## What was done

- **`PlansView` deleted.** Nothing imported it (the `plans` destination in
  `Workbench.tsx` resolves to `views/workspace/PlansView.tsx`, an unrelated
  task-planning view). It was dead code selling a subscription that does not
  exist.
- **Fabricated data removed** from the three reachable views. No invented
  people, invoices, cards, quotas, or random chart points remain.
- **Each empty section states why it is empty.** A panel left blank because its
  source was never wired reads identically to one that is blank because there is
  nothing to show; that ambiguity has hidden real bugs in this repo.
- **A `DemoNotice` banner** marks each view as non-functional on screen.
- **`ProfileView` no longer shadows real settings.** Its theme and language
  pickers duplicated `views/settings/SettingsView.tsx` — which does persist, to
  `localStorage['cortex:settings']` — but wrote to component state only, so
  changing the theme here looked like it worked and did nothing. It now points
  at Settings.

## The real usage feature

Per-provider and per-model token and cost usage, read from the local database,
is a feature that genuinely works: `views/agents/UsageTracking.tsx`, which
queries `window.cortex.db`. `BillingView` is not that view and does not
duplicate it.

## If billing is ever built

The views are not the starting point; the missing pieces are, in order:

1. An account/auth backend. Nothing here can be per-user until one exists.
2. IPC channels in `packages/main/src/ipc/handlers/`, split by domain and
   registered, with Zod validation and the `{ success, data }` envelope.
3. Preload allowlist entries — an unlisted channel is rejected, and the
   allowlist is mutation-tested.
4. Only then, views that render what those channels return, plus their
   loading/empty/error states.

Until step 1 exists, the honest version of this directory is the one that says
it does not work.
