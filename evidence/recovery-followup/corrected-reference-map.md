# Corrected design reference → desktop crosswalk

Bounded documentary/source comparison; desktop paths are repository-relative. No integration authorization inferred.
Coordinator-provided baseline: desktop `3d3bad8`, app `cc758a6`; 50 E2E tests per OS reported green. Not rerun here; goals remain incomplete.

## Current handoff supersession

Latest disposition: **59 double-confirmed, three B-only, one open P1 M02**, still 63 units.
M02's blank-specialist path is reported to replace the primary Bot; focused owner repair is
underway. The [reconciliation receipt](handoff-correction.json) records the conflicting on-disk
63-closure ledger. Owner-approved pins/counts remain unresolved. The historical table below
is preserved as the original readback, not current integration approval; no per-lot allocation
of the three B-only units is inferred. Static desktop anchors remain bounded observations.

## Historical counts and disposition at the baseline readback

| Original corrective scope | Units | Ledger disposition at the baseline readback |
| --- | ---: | --- |
| Chat/System | 27 | Double scoped confirmation |
| Work/Bots | 10 | Double scoped confirmation; M02 uses later specialist-zero pin |
| Readers/Code | 23 | Double scoped confirmation |
| Coordinator integration | 3 | Double scoped confirmation of original criteria |
| Total | 63 | Defect closures, not whole-page or desktop acceptance |

- `/root/cortex-ui/review/findings-merged.md:3–24` is historical: 60 open, two declared corrections, one divergence; 18 P1 / 40 P2 / five P3; 49 source IDs, 27 overlapping groups. Units are distinct corrective consequences, not newly observed runtime failures.
- `/root/cortex-ui/review/confirmation-status.md:3–28` supersedes those dispositions, not the historical evidence. M02's later `5daa8d29` pin closes only the previously failing blank-specialist path. No hashes independently checked here.
- Earlier author counts remain separate: `fixes-chat-system.md:48` = 48/48 journeys; `fixes-travail.md:40` = 32/32 consolidated cases; `fixes-readers-code.md:57–58` = 47/47 actions, 92 measured renders. None equals the 63-unit matrix.
- M04: latest ledger `:22` preserves eight failures from an invented PR query requirement; original billing/sidebar criterion closed. Do not import that briefing error as a desktop requirement.
- Later A-CS-01 source-title separation is closed-scoped (`confirmation-status.md:34`). Additional product/public/suite corrections and later shared-hook delta have separate revision-bound dispositions (`:36–98`).
- Frozen `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674` remains immutable historical reference. Independent closure does not approve a whole page, connected engine contract, or wholesale replacement.

## Already integrated / equivalent desktop behavior

Source-present behavior below establishes overlap, not corrective-patch ancestry or a new runtime pass.

| Behavior / relevant design unit | Verified current desktop anchors |
| --- | --- |
| Live draft/file retention; related to M21's acceptance principle | `packages/app/src/screens/chat/model-composer.tsx:79–85` clears only after successful admission; `screens/chat/live-chat.tsx:72–78` navigates after admission. Full path for latter: `packages/app/src/screens/chat/live-chat.tsx`; retry `:272–274` includes original text/file parts. |
| Code/Work/Bot refusal retains composer text | `packages/app/src/components/composer.tsx:50–53`; false-return paths in `packages/app/src/screens/code/code.tsx:68–81`, `packages/app/src/screens/work/home.tsx:80–87`, `packages/app/src/screens/bots/bot.tsx:267–273`. Code folder cancellation returns false. |
| History identity: M03 live counterpart; shell history handling | `packages/app/src/screens/chat/pages.tsx:90,125` passes live session ID; `packages/app/src/screens/system/search.tsx:27–28` does likewise. `packages/app/src/shell/nav.tsx:12–31` preserves preview/theme parameters and snapshots entry identity; `packages/app/src/App.tsx:18–29` consumes that snapshot. Preview history still uses a generic chat destination. |
| Bot state/save safeguards; M02 live counterpart only | `packages/app/src/preview.tsx:28–41,59–68` shares temporary appearance/activity/draft state; `packages/app/src/screens/bots/bot.tsx:360–377,422` exits only after successful save. `packages/app/src/screens/bots/team.tsx:111,139` selects live Bots by ID. |
| Work preview activity restoration; live task admission | `packages/app/src/screens/work/home.tsx:293–297` restores prior activity; `:80–87,136–137` retains live composer through admission. This does not close preview M11 below. |
| Routine persistence: M09 live counterpart | `packages/app/src/screens/work/routines.tsx:60,80–87,188–199` uses engine list/update/create; failed save stays in editor. Preview save at `:190` remains toast/navigation only. |
| Reduced motion, hidden controls, pending tab selection | `packages/app/src/kit/styles.css:58–59`; `packages/app/src/shell/shell.tsx:44,91–107,233`; `packages/app/src/kit/ui.tsx:58–63,91–99`. These are desktop safeguards, not additional units in the historical 63. |
| Narrow Work board | `packages/app/src/screens/work/work.css:50` wraps columns using bounded `auto-fit`; not proof that separate M36/M37/M39 layouts are closed. |

## Five remaining candidate integration questions — no approved import

Static source mismatches only. Each asks whether the named prototype behavior belongs in an approved, bounded desktop delivery. M02's earlier specialist-zero pin is subject to the current repair hold above.

| Design unit / delivered correction | Current desktop anchor | Integration question |
| --- | --- | --- |
| M01 / A01+D03 — model choice consumed by editable new-chat prompt (`fixes-chat-system.md:19`) | `packages/app/src/screens/system/search.tsx:127,131–136`: three model commands; selection only changes theme for theme IDs, then reports success. | Should the corrected new-chat model-selection flow replace this toast-only command, with its live engine contract explicitly resolved? |
| M21 / D06 — `Box` clears only on explicit acceptance; image prompt retained (`fixes-chat-system.md:20`) | `packages/app/src/screens/chat/shared.tsx:121,129–135` clears after optional handler; `packages/app/src/screens/chat/extras.tsx:73` supplies no handler; live guard at `:27`. | Should the corrected acceptance/prompt-retention behavior be adopted for preview image generation, preserving existing live draft/file safeguards? |
| M11 / D08 — first task survives Empty→Board and retains identity (`fixes-travail.md:13`) | `packages/app/src/screens/work/home.tsx:61–77`: variant effect reloads fixtures; add prepends task then changes variant; preview open passes no task ID (`:72`). | Should the corrected preview collection/identity behavior replace this reset path, keeping engine-backed live tasks separate? |
| M02 / A02+D04 — distinct specialists; earlier blank-specialist pin now held pending repair reconciliation (`fixes-travail.md:10–11`; `confirmation-status.md:24–28`) | `packages/app/src/screens/bots/team.tsx:78,110,149–150`: preview template opens generic Studio; specialist tiles omit identity; preview settings read primary Bot. | After the owner resolves the repair/pin discrepancy, should approved preview specialist identity be carried through roster/settings/creation without mutating the primary Bot's shared preview state? |
| M05 / A04 — selected Code task opens its own review or identified unavailable preview (`fixes-readers-code.md:14,74,104`) | `packages/app/src/screens/code/lot-code.tsx:86` routes by status without task identity; review uses fixed fixture at `:219–222`; live list passes session ID at `:145`. | Should corrected task-specific preview routing be ported for the supplied task content, retaining identified unavailable results where no content exists? |

## Prototype-only / not applicable to live feature delivery

- PDF demonstration unlock, DOCX local accept/refuse, image retouch, ZIP simulated extraction, media clocks and added diagnostic states (M13–M18, M23–M24, M62) do not establish real decoding, disk extraction or services. `packages/app/src/screens/files/index.tsx:10` sends live viewer routes to Upload; author limits: `fixes-readers-code.md:99–110`.
- M25 checkout, M63 microphone states, M22 image generation and M12 connector success remain local demonstrations. Live guards: `packages/app/src/screens/system/account.tsx:237`, `packages/app/src/screens/chat/voice.tsx:19`, `packages/app/src/screens/chat/extras.tsx:27`, `packages/app/src/screens/work/desk.tsx:373`. Their corrected simulations do not authorize live backend behavior.
- M61's French role-copy requirement maps to locale correctness, not replacing English source copy. `AGENTS.md:28–31,192–196` governs desktop language. Prototype `sessionStorage` collections (`fixes-travail.md:23–26`) are not a substitute for engine persistence.
- Space, standalone Scheduled, Plugins & skills remain blocked pending approved delivery (`AGENTS.md:161–171`; `.rules/06-product.md:25–40`). Later prototype confirmations do not change that contract.

## Reads and limits

- Exactly 15 file reads: desktop `AGENTS.md`; all nine `.rules/00-overview.md` through `.rules/08-testing.md`; five complete design reports: `findings-merged.md`, `fixes-chat-system.md`, `fixes-travail.md`, `fixes-readers-code.md`, `confirmation-status.md` under `/root/cortex-ui/review/`.
- Additional targeted greps: desktop App/navigation/shell/kit/preview/composer; Chat, Work, Bots, Code, Files and System source anchors above. Glob located desktop screen files and confirmed this output did not exist. No design source files or raw evidence opened; design claims attributed to reports only.
- No source edits, builds, tests, GUI/Mac inspection, full 63-unit re-audit, provenance sweep, icon or iOS receipt work. Only this report written. Coordinator retains integration/provenance ownership.
- Retained constraints: refused sends preserve drafts/files; live mode has no seeded rows; provider keys remain main-only (`AGENTS.md:123–126,176–189`). Findings are candidates, not newly confirmed desktop runtime failures.
