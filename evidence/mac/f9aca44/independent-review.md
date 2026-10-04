# Installed Work/Search native review

**PASS — scoped visual/context/identity proof; one evidence claim needs qualification.**
No concrete application blocker established. Application `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a`.

## Claim correction
- `README.md:21` claims native persistence of the original prompt; `manifest.json` sets
  `promptPreserved: true`. `/tmp/opencode/desktop-actions-native.mjs:30,35` checks editor input,
  but lines 43–46 assert task/run model, Bot, directory and agent, never `task.prompt` or run text.
  Provider receipt omits prompt bodies. Qualify the native flag as editor prefill preservation;
  attribute persisted-prompt proof to CI, or retain a separate native persisted-value assertion.
  This is an evidence-precision gap, not demonstrated prompt loss.

## Verified artifacts and images
- All ten PNG SHA-256 values/dimensions match `images.json`: 960×640; six primary plus two
  minimum-scroll plus two centered-scroll captures reconcile with their respective JSON receipts.
- Inspected all ten full-size: `bot-search-{light,dark}.png`, `routine-from-task-{light,dark}.png`,
  `routine-source-list-refused-{light,dark}.png`, `routine-source-controls-{light,dark}.png`,
  `routine-source-controls-centered-{light,dark}.png`.
- Original editors cut the selected Bot; minimum-scroll dark retains edge fade, as disclosed.
  Centered follow-ups show the complete selected Bot and reachable Create; script uses ordinary
  scroll plus viewport/trial-click assertions. Native chrome/sidebar and both themes remain readable.
- ZIP `3e63619e9a16589e396eba1f7b2fb10c92010adfa42ad6d032a5ab7bfa21b9fe` verified.
  Embedded ASAR `23decdd0596b89e8e83284b62f6e7f0eb5314b081ccf178f7dde31c8ac04af77`
  matches package/manifest/cleanup. Receipt lists 90 members and eight × 13 locale catalogs;
  prior independent member-level verification was not repeated.
- Four actual provider records; stale `routine:false` heuristic explicitly qualified. Two routine
  successes/context identities are asserted through persisted run sessions. All three error arrays empty.
- Refusal injection changes only list GET URLs to real missing records; engine responses stay real.
- Cleanup JSON covers ports 9444/9445/9456 and ASAR only; forwarding/app restore/lease remain
  separately labeled operator observations. README excludes real inference and full native acceptance.

Only this report written. No delegation, Mac actions, CI queries, tests/builds or source edits.
