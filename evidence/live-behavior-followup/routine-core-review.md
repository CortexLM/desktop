# Final routine core review

**PASS — scoped.** Both reported P2 paths corrected; no scoped critical issue found.

- `packages/core/src/scheduler.ts:110–122`: startup recovers persisted `running` rows as `error`/`aborted`, records end time, preserves run identity/start ordering, publishes the recovered outcome. Terminal rows remain unchanged; repeated startup is idempotent for recovered rows.
- `scheduler.ts:118`: active task reservations bypass recovery; starting the timer during a live run preserves Running.
- `scheduler.ts:73–76,95–98`: task existence is checked synchronously before run persistence/event emission. Late finalization after deletion recreates neither history nor task; final task update remains existence-guarded.
- `scheduler.ts:63–67`: duplicate admission throws synchronously before session creation. Reservation lasts through final persistence, releases on resolution/rejection.
- `packages/core/src/session.ts:166–171`: persisted assistant cancellation propagates; scheduler records an aborted error instead of success.
- `packages/server/src/index.ts:133–136`: synchronous conflict reaches the API; background rejection has a handler.

## Evidence reviewed
- `/tmp/opencode/routine-restart-before.log`: recovery regression failed before correction.
- `/tmp/opencode/routine-delete-before.log`: late finalization recreated deleted history before correction.
- `/tmp/opencode/routine-lifecycle-final.log`: four scheduler plus seven server tests passed (11 total).
- Current tests cover seeded abandoned-run recovery, active-run preservation during start, abort persistence, duplicate admission, deletion without late events, route-level 202/409.
- Restart test uses seeded in-memory storage. Sufficient for this recovery-logic verdict; an actual file reopen would strengthen disk-restart evidence, not a blocking source correction.

Static review only. No tests/builds executed; only this report written.
