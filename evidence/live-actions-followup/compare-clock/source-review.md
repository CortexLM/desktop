# Comparator clock review

**PASS — scoped independent logic review. No concrete blocker found.**
Scope: `scripts/compare-shots.mjs` and `scripts/compare-shots.test.mjs` only.

- CLI clock requires strict UTC ISO seconds/three-digit milliseconds; finite-date round-trip
  rejects normalized invalid dates, 24:00 and missing zones. Timezone-only invocation refuses.
- Timezone is validated/canonicalized with Intl; explicit clock defaults to UTC.
  Invalid input fails before browser launch/output creation.
- `setFixedTime` precedes gallery and every capture navigation. Installed Playwright 1.63
  documentation/implementation confirms fixed Date, running timers and navigation init-script persistence.
- Row/run/root clock policies agree. Host `capturedAt` remains real capture time, separate from
  caller-selected browser Date. Limits explicitly disclaim the reference's original timezone/mount time.
- Merge requires identical clock, source, reference, comparator and render policies; checks historical
  run/row policies plus report/image hashes. Absent clock reads as ambient/null without relabeling;
  older comparator hashes still refuse merging, as before.
- Reference validation, capture source/asset hashes and original-reference image handling retain
  their existing guarantees. No inferred reference clock, raised threshold or rewritten historical image.
- Added assertion cases cover invalid input, UTC default, explicit zone, compatible merges and
  root/run/row clock mismatches. No tests executed here; runtime capture verification remains coordinator-owned.
- Application files match `f9aca44`. Comparator SHA-256:
  `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6`.

Only this report written. No delegation, source edits, builds/tests, CI/Mac or owner actions.
