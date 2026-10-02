# Reference status at the 0e63f87 follow-up

Read-only reconciliation of `/root/cortex-ui` and application revision
`0e63f876bbe3d0fe893c6c698ff3fadb6dcec702`, 2026-10-02. The design checkout is actively
changing; this records observed source, not owner approval.

## Registry counts

Both have the same 61 routes. The other 60 routes contain 204 matching states and design
variant IDs. Reference Settings registers one state; the app registers nine. Therefore
205 reference states versus 213 app states is entirely explained by Settings:

| App Settings variant | Reference evidence |
| --- | --- |
| `general` | Registered `settings` route |
| `appearance` | Clicked section; `settings-apparence-{light,dark}.png` |
| `shortcuts` | Clicked section; `settings-raccourcis-{light,dark}.png` |
| `account` | Clicked section; `settings-compte-{light,dark}.png` |
| `bot`, `notifications`, `privacy` | Existing clicked sections; no dedicated shots |
| `providers`, `connection` | App controls; design requests unanswered |

Source: reference `src/screens/pages.tsx:141–227`; app
`packages/app/src/screens/system/index.tsx:27–30`. Counts do not establish live functionality.

## Confirmed current-source drift

- Reference Activity icon is `mentions`; app uses `bell`.
- Reference Home suggestion glyphs are 16 px, gap 16 px, horizontal padding 5 px;
  app uses 20 px, 12 px and 3 px. The refreshed Home screenshots show these differences.
- Reference composer gained a separate capsule, typed-state contraction and detached send
  button. App keeps the earlier composer treatment.
- Reference sidebar/theme/focus changes include bottom fade/padding, a theme ring,
  arrow-key navigation and `inert` hidden regions. App carries the earlier behavior.
- Reference Undo uses `Toast.Action`; app uses the earlier `Toast.Close` primitive.
- Reference Components now has 12 sections, 30 motion entries and 31 family definitions
  observed in source; the app has 14 earlier static blocks and 12 motion entries. Its old
  reference PNG matching 0.00% does not establish current-source parity.
- Reference's 610 ms segmented-navigation delay remains under review. It is not recorded
  as an approved timing requirement.

Reference paths: `src/App.tsx`, `src/styles.css`, `src/ui.tsx`,
`src/screens/{chat,components}.tsx`; acceptance notes in `review/acceptance-status.md`.

## Missing acceptance inputs

The design owner records A5 = 6/10, B5 = 8/10; A6/B6 pending, no page approved. Its
205-state coverage distinguishes 61 motif references and 144 shell-only references,
all `unproven`; this is not certification of full-screen content. That coverage already
predates refreshed Home/Notifications image hashes and current source fingerprints.

Needed: frozen reference source fingerprint, matching regenerated shots/coverage, A6/B6
decisions, completed Components scope, delivered route/state IDs for Space, standalone
Scheduled, Plugins & skills and the open provider/connection/auth/composer/approval requests.
Until then, `report.json` remains a mixed-revision pixel comparison with explicit provenance,
not complete visual or interaction acceptance.
