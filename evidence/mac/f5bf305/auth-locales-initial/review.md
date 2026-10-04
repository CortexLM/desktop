# Native locale harness correction — prepared, unexecuted

## Concrete failure

The retained failure digest exactly matches this neutral protocol message, computed
offline without a trailing newline:

```text
cdpSession.send: Protocol error (Browser.getWindowForTarget): 'Browser.getWindowForTarget' wasn't found
70037f2fdb56c2ff07870443aeea8c3c8ce1c4200b32c54cfe5030907a44ef33
```

The initial script reaches this call at line 134, before the first locale loop.
Its earlier identity call runs while `dom` is unset, so line 57 cannot be the initial
failure. The hash match identifies the refused method and explains the stale
`installed-identity` label: setup never updated `stage` between lines 83 and 136.
This was a harness protocol failure, not evidence of a product layout defect.

The local Playwright protocol declares `targetId` optional when a session supplies
its associated target (`playwright-core/types/protocol.d.ts`,
`Browser.getWindowForTargetParameters`). Playwright itself also attempts this call
on a page session, catching unsupported implementations. Therefore omission of
`targetId` is not, by itself, a protocol-contract error. A browser-scoped call with
an explicit target was not tested; no claim that it works on this Electron build.

## Bounded correction

- Both unsupported Browser-window calls are removed. Native sizing uses the exact
  AppleScript operation in the existing `/tmp/opencode/remote-auth-native.mjs:207`:
  `tell application "System Events" to tell process "Cortex" to set size of window 1 to {960,640}`.
  That script's bytes match the retained six-English passing receipt at
  `/tmp/opencode/native-auth-f5bf305/manifest.json`.
- Browser CDP still establishes main PID. Page CDP still enables DOM/CSS and reads
  native font glyph records. CGWindow still establishes foreground window/PID and
  960×640 bounds. The former CDP normal-window check becomes native accessibility
  assertions that `AXFullScreen` and `AXMinimized` are false. That added accessibility
  read is prepared, not runtime-verified.
- Saved, timestamped phases distinguish imports, CDP connection/browser session,
  native identity, renderer selection/bridge, original preferences, fixture selection/
  logout, page session, `DOM.enable`, `CSS.enable`, native theme/foreground, window
  resize/verification, locale setup, each view and cleanup operations.
- `failure` and cleanup failures retain original message SHA-256 plus error name,
  redacted message and stack. Patterns remove the fixture's complete
  `test-only-native-*` values, Bearer/JWT tokens and credential-named values. Safe
  protocol errors retain their diagnostic text. Output is bounded after redaction;
  error objects, wire bodies and renderer HTML are not serialized into diagnostics.
- Exact 48-view/144-Tab/16-PNG assertions, locale/theme loops, Range geometry,
  control reachability/overlap assertions, font checks, private-state inspection,
  counter deltas and restoration assertions are unchanged. No browser/context close.

## Preserved initial evidence

The first execution remains failed: zero views/captures, zero backend counter delta,
empty recorded page/console/HTTP errors, successful signed-out connection and
route/locale/theme restoration. Recorded 90-member/source pins, installed ASAR and
PID agree before/after. This review reads those retained observations; it does not
repeat the native checks.

Original script copied before editing; copy hash equals the initial manifest:

```text
50948d030e3577698323c978252e38545b88d79e31c0bc13c8ef756e70162494  /tmp/opencode/native-auth-locales-f5bf305/script-initial.mjs
754aff12455550c825ee3c019cff2697f117849b313ad8049f7a5a36caa6a0af  /tmp/opencode/native-auth-locales-f5bf305/manifest.json
fd4c1f0d7f83063583ea7b6d60be7bdbcc7bc0926863906dfdf99044402007f4  /tmp/opencode/native-auth-locales-f5bf305.log
de1b96a4897d81f51ab6faf3f014835e41688a433959ccded8e302a41f77ae11  /tmp/opencode/remote-auth-native.mjs
25e6481613780096505e6b3970b36cc0290c1d1ac4a156aefa57829cb32faefe  /tmp/opencode/native-auth-locales-final.mjs
```

## Checks and coordinator handoff

`node --check /tmp/opencode/native-auth-locales-final.mjs` passed (exit 0), using
`/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node`. Local byte hashes and
the original/corrected diff were inspected. No harness execution, network, Mac,
SSH, CDP, build, test suite, repository write or delegation occurred.

Coordinator owns the fresh output run, current lease and existing fixture/helpers.
Same positional arguments; preserve the initial output directory. Example:

```sh
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/native-auth-locales-final.mjs \
  /tmp/opencode/native-auth-locales-f5bf305-native-window \
  /tmp/opencode/desktop-remote-auth-f5bf305 \
  d34d6d8609045f56851a6004f5c7bb185108cd743732ff8b79d6e3689df7f14c \
  f5bf305473db12fddfddcda890a01794f02f578f
```

Use another fresh output name if that directory exists. Existing fixture counts are
already nonzero; the original before/after delta contract remains required. This
review supersedes `/tmp/opencode/README.md` only for native window control and
failure diagnostics; that file was outside this correction's write scope.
