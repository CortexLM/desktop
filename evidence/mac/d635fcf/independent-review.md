# Installed-Mac evidence review

**PASS — scoped. No critical false claim or blocker found.**
Scope: `evidence/mac/d635fcf/` receipts/images/README; test correction `ea1c54b`.

## Artifact integrity
- ZIP `85192b7fef863e3d3c638d72e44d528ad392e1000bf1a91c46dfb53104b4958d` verified locally.
- Embedded ASAR, `/tmp/opencode/live-behavior-mac.asar`, manifest and cleanup agree:
  `aa11177040f5fd1e2367fad84575b23e85416bfdd64572e16e1686b0f166ee08`.
- All 90 listed build members match ASAR bytes, local build bytes, declared sizes/hashes.
- Eight packaged locales × 13 catalogs match current and `d635fcf` source bytes;
  locale fixture/source-stamp resources absent. All native README local links resolve.
- All 12 PNG hashes/dimensions verified: 960×640. Ten initial plus two supplemental captures
  reconcile; 12 PNGs and four native JSON receipts match retained `/tmp` originals byte-for-byte.

## Images inspected
- `code-attachment-toast-light.png`, `code-attachment-toast-dark.png`.
- `routine-running-light.png`, `routine-running-dark.png`.
- `routine-interrupted-light.png`, `routine-interrupted-dark.png`.
- Also `code-attachment-refused-light.png`, `code-attachment-refused-dark.png`.
- Native traffic lights/chrome and sidebar visible; text/control layout readable in both themes.
  Running/Failed history agrees with captures; supplemental toasts clear attachment recovery controls.
- Initial attachment images contain no toast; README explicitly discloses expiry during capture.
  Supplemental receipts record ordinary hover, toast bottom 489/dock top 501, reachable controls,
  zero messages. Images corroborate visible toasts; no fake-clock or initial-toast proof claimed.

## Claims and correction
- `codeModelRequests` contains six persisted message models per theme, not six requests;
  README states this. Provider receipt has eight actual records: six Code, two routine.
- Cleanup JSON records only remote ports 9444/9445/9456 closed and installed ASAR hash.
  Forward shutdown, ordinary-app restore and lease release remain labeled operator observations.
- `ea1c54b` changes one executable file, `tests/unit/runtime-copy.test.ts`, plus docs/evidence.
  Adds browser preferences/translator/query fixtures and cleanup; every test case/assertion retained.
  No application/build/package input delta. Retained Node 22 full-unit log: 178 pass, one optional skip.
- README preserves overall CI `37074187552` failure despite 61-case-per-OS/package success.
  `37075722150` status remains coordinator-owned; no fresh CI query or success attestation here.
- Native routines prove renderer reload, not process restart; controlled provider, folder test hook,
  targeted native scope, real-inference/remote/full-objective exclusions are correctly disclosed.

Only this report written. No delegation, Mac actions, CI queries, tests/builds or source edits.
