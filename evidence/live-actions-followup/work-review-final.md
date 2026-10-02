# Work routine source — P2 follow-up

**P2 closed at source-review level. No new concrete blocker in this delta.**
- Reversing the four focused changes reconstructs prior `routines.tsx` SHA-256 `bdb49242544fd79f87c41df4cc21848767e9bca58b737f598a5d37df91546ad2`; preceding test content also matches its prior hash.
- `routines.tsx:223,253`: Create now requires the actual selected Bot in a ready list; loading/error yields no Bot and disables it.
- `routines.tsx:271`: list failure renders localized `role="alert"` plus Retry wired to `bots.reload`; draft state remains mounted/editable.
- `routines.tsx:230`: missing-Bot source save defensively reports neutral localized failure instead of silently returning.
- New test `work-routine-source.spec.ts:332–410` exercises a real missing-record response for the list, disabled Create, error/Retry, edited draft retention while retry parsing is held, original Bot selection, then exactly one persisted routine with source context.
- `/tmp/opencode/work-routine-list-before.log` confirms pre-fix regression: expected disabled, received enabled at line 369. No assertion weakened.
- Current hashes: `routines.tsx` `7cb53f717dae1271d0ac0346ec33124734a61ba26dfba9c581dd0c5415bb3e48`; test `280651afb980c6de939b33865e4d4ec17ea4fc7362420761a66d9044baf43f55`.

## Limits
- Corrected 13-case run/build/Linux packaged smoke remain coordinator-owned; no passing result inferred here. No checks/tests/builds/CI/Mac actions executed.
- Added list-failure/retry case covers light theme only; earlier conversion cases cover both themes.
- Existing edit-reassignment PATCH semantics retained: omitted optional agent/directory are not cleared. Source-new reassignment behavior remains separately scoped.
- Earlier review findings/evidence preserved. This closes the bounded P2 source defect, not whole-product or full visual/native acceptance.
