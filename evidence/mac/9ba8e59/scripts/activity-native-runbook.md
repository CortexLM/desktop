# Activity native — preparation only

Driver: `/tmp/opencode/activity-native.mjs`; `node --check` passed; runtime/imports remain unexecuted.
Driver SHA-256: `82b24a9417597ab6c9ba6f0754b36b1fa2ef7dc723118e03037e3cc642f04ac5`.
Reconcile selectors/copy against the final Activity source; obtain independent source approval.
Admit a future tested full 40-hex revision, exact production CI macOS ASAR SHA-256 and complete
member JSON: `{ "revision": "<40 hex>", "members": [{ "path": "packages/app/dist/...", "sha256": "<64 hex>" }] }`.
Include every app/desktop distribution member; launcher checks exact membership, not a fixed count.
Memory `96df66c` and Projects `f82a648` are rejected as Activity admission. Prior evidence stays scoped.

## Reserved scope
- Four originals only: `activity-all-light.png`, `activity-errors-light.png`, then dark equivalents.
- Native 960×640, sidebar shown, actual OS light/dark, shell System; CDP media overrides released.
- Initial empty feed checked without capture; one controlled Bot, exactly two root Bot sessions.
- Existing backend v1 has no control route. Reuse its first three steps: light fail/recover on
  root 1, dark fail on root 2. HTTP outcomes 401/200/401; final feed Completed + Failed.
  Fixture theme words name protocol steps; both histories are reused in both display themes.
- Real IPC plus local fake inference only; catalog `fake/reasoner`, no tools/files or user account.
- Set explicit loopback provider baseURL via PATCH; write only the obvious fixture key via PUT.
  Packaged `CORTEX_TEST_PROVIDER_BASEURL` is ignored and prohibited by the unchanged launcher.
- Bot picker ArrowDown/End/Enter, All/Errors Space and Tab, failed row Enter, completed row click;
  exact Work session URL/title/Bot composer placeholder checked, browser history returns to Activity.
- All capture shows both outcomes with the sole Bot selected; Errors capture shows only Failed.
  Five geometry targets/capture: scope/picker/All/two rows; scope/picker/All/Errors/failed row.
  Descendant text ranges use their own ancestor clips; element bounds start at the parent.
  Both sides of each capture retain geometry, focus, native PID/bounds/foreground/OS samples.
- Full histories/Bot/session/provider equality checks establish read-only navigation; transcript,
  fixture response, raw error and key are forbidden in Activity. Export must remain disabled.
- Strict IPC allowlist: seven initial list reads; connection/catalog/fake-provider reads;
  one exact Bot, two exact owned roots, three exact prompt bodies; owned cleanup only.
  No Project/routine/permission/settings/auth writes; IPC report records metadata, never bodies/key.

## Budgets and helper pins
- 120-second stage/IPC flow guard; cleanup may extend total time. Unmeasured; no timing promise.
  No automatic rerun, extra capture, fourth inference or budget extension after a failure.
- 4 capture requests, 8 native samples, 8 MiB/image, 32 MiB total, 400 KiB manifest, 180 IPC calls
  (20 reserved for cleanup), 10-second UI waits, 15-second SSH/capture limits.
- System Events exact boolean/status and Swift window rows share each SSH invocation; samples
  are saved before assertions. Only initial/final full-ASAR inspections; executed URL self-hashed.
Unchanged helpers from `evidence/mac/f82a648/scripts/`, adjacent to driver and inside fresh Mac root:
- `terminal-state-native-backend.mjs`: `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d`
- `launch-terminal-state-native.py`: `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257`
- `cleanup-terminal-state-native.py`: `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a`

## Coordinator execution after admission
1. Acquire the lease; inspect the screen. Record actual pre-lease OS dark value **before quit/install**.
   Preserve prior app; install only the admitted future Activity package. Use an already-authorized GUI host.
2. Reserve Mac ports 9444/9445/9456 and local 19444/19445; preserve unknown owners. Create fresh paths:
   `RUN_ROOT=/tmp/opencode/desktop-terminal-state-activity-<revision>-<attempt>`;
   `OUTPUT=/tmp/opencode/activity-native-<revision>-<attempt>`. Stage helpers/member JSON; no reused profile.
3. In the GUI host run `/usr/bin/python3 "$RUN_ROOT/launch-terminal-state-native.py" "$RUN_ROOT" "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"`.
4. Own one tunnel: `ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live`.
5. From repository root with Node 22+ and installed Playwright, run once:
   `node /tmp/opencode/activity-native.mjs "$OUTPUT" "$RUN_ROOT" "$ASAR_SHA256" "$REVISION" "$MEMBERS"`.
   Retain exit status, manifest, sources/hashes, launch/binding/backend receipts and original PNGs; review all four full-size.
6. Driver deletes owned sessions before Bot, removes fixture key, restores provider defaults/theme/OS/route,
   verifies original empty lists except providers. No provider-delete API: the sanitized default record
   `{providerID:"fake",enabled:true,hasKey:false}` remains in the isolated profile, without baseURL/keyHint.
   Failed runs retain their status and downloaded originals; unknown accepted IDs require explicit recovery.
7. Run `/usr/bin/python3 "$RUN_ROOT/cleanup-terminal-state-native.py" "$RUN_ROOT" "$REVISION"` in the GUI host.
   Shared cleanup forces dark. Afterwards restore/read back the exact pre-lease OS value, verify ordinary
   PID/window/theme and absent isolated arguments, stop owned tunnel, verify five ports closed, release lease.

No runtime acceptance yet. Native scope excludes restart, interruption, in-progress retention, duplicate/missing
Bots, Retry/races/40-root ceiling, 1440×900, other locales and preview parity; engine/Electron suites own those.
