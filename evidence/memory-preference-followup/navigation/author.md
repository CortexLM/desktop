# Cancelled preview settings regression — author handoff

- File: `tests/e2e/runtime-settings.spec.ts`.
- Exactly one appended registered case, 60 added lines (lines 219–278): `Cancelled preview navigation recovers held Memory reads and Privacy writes`.
- New complete-file SHA-256: `a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8`.
- Existing 24,715-byte prefix remains byte-identical to `/tmp/opencode/memory-preference/baseline-test.ts`; its SHA-256 remains `47b4b17adc8222565e8513db3880cf49fdbdec1be35f743816662a77e7d03580`. The baseline copy was read only. No edits to the five previous registered cases or shared helpers.

## Interleavings

1. Start Home, arm existing IPC helper for one real GET, mount live Memory. Assert actual held 200/true snapshot, settled no-Bot empty copy, loading status, no fabricated switch. Hold `document.startViewTransition` callbacks using the pattern already used in `navigation.spec.ts`. Push preview Home; URL changes while the Memory row remains connected. Deliver the real GET while the URL is preview. Back returns to the exact original live URL. Release the newer Back callback, then the older preview callback; both read the restored live entry. Require Memory enabled/checked true within two seconds.
2. Reload once between phases to isolate the PUT reproduction from a soft GET failure. Mount Privacy, hold its off PUT before engine admission; assert true/disabled. Defer preview Home, release real PUT during preview URL, verify engine actually false. Back before either route commit; release callbacks newest first. Require Privacy enabled/checked false within two seconds. Exactly one settings PUT exists throughout this phase; no preview mutation.

The two recovery assertions are separately named `expect.soft.poll` assertions. A reproduced GET defect therefore does not prevent the PUT phase. Required setup/real-response assertions stay hard. Evidence records both control states, accepted engine state, deferred callback URLs and IPC calls in `cancelled-preview-settings`. No successful response is synthesized. IPC release still fences an actual returned callback, `/api/health`, two animation frames. Connected row/panel checks ensure recovery does not rely on a preview commit or remount.

## Selectors

- Memory: existing `memory(page)`, role switch + exact catalog `memory.toggle` (`Turn on memory`).
- Privacy: existing `privacy(page)`, `[role="switch"][aria-label="Memory"]`.
- Retained owner: `.systeme-memoff` or `.pg-panel`.
- Preview commit detection: `.home` remains absent.
- GET setup: `main [role=status]` plus exact `memory.liveEmptyText`.

## Checks actually executed

- `./node_modules/.bin/eslint tests/e2e/runtime-settings.spec.ts`: exit 0.
- Read-only Node assertion: old prefix equals baseline bytes; baseline hash matches; exactly one appended `test(` declaration; 60 lines added.
- No app/test execution, build, product changes, CI, native/Mac actions or network activity. Regression is authored, not an executed reproduction. Prior 14/14 passing results and the current `30ec7` renderer baseline are coordinator-supplied context.

Coordinator can select only the appended case with `--grep 'Cancelled preview navigation'` against the existing renderer before applying its lifecycle correction. Source is frozen at the new hash for that baseline; preserve original negative results before any justified collector correction.
