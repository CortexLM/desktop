# Memory native appearance-probe correction — prepared, unexecuted

Corrected driver: `/tmp/opencode/memory-native-corrected.mjs` (111 lines; original 104).
SHA-256: `d1eaeea3ae44d0b32fc0903e67c860a0d8c2444b93ab23a0a997f4c1f17c4b8e`.
Original `/tmp/opencode/memory-native.mjs` remains byte-identical:
`370b06ee1628b3e88e17104562da077b22f70da859947baa4990dd555ee44aa9`.

The first `96df66c-a1` run remains failed: 20.330 s, zero requested/retained images,
eight successful cleanup checks. Its joint native-window assertion retained no sample;
the failed predicate cannot be identified retrospectively.
`light-diagnostic.json` separately reproduces Swift UserDefaults reporting dark while
System Events reports `false` and `defaults` reports absence/exit 1. This supports probe
ambiguity; it does not establish the exact original failure. Later readback is separate evidence.

Correction removes Swift UserDefaults appearance lookup. One existing SSH invocation runs
a Python wrapper: CoreGraphics/AppKit window JSON, then System Events via `/usr/bin/osascript`.
Swift timeout 10 s, appearance timeout 3 s, existing outer SSH timeout 15 s.
Before native assertions, `report.nativeChecks` stores stage/theme/time, window rows,
appearance exit status and exact stdout; capped at 12 samples (eight expected).
Appearance requires exit 0 and exactly `true\n` or `false\n`; native OS/theme, foreground,
PID, single window, 960×640, window continuity and independent renderer-media checks stay enforced.
Self-hash reads the actual `import.meta.url` bytes, keyed by its basename; corrected execution
cannot inherit the adjacent original's hash. Invocation label names the corrected driver.
API guards, helper/package pins, cleanup, four captures, twenty targets, 120-second flow
and image/manifest byte budgets are unchanged. No application or original collector changes.

`node --check /tmp/opencode/memory-native-corrected.mjs` passed after the final edit; imports/probes unexecuted.
Only local reads/diff/hash/syntax check performed; no Mac/network/CI/build/application tests.
Run the corrected filename only after independent approval, with fresh root/output and the
admitted Memory revision/ASAR/member arguments. Preserve original failure and diagnostic receipts.
