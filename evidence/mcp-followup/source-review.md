# Final bounded MCP re-review

Verdict: APPROVE — scoped read-only source review. No remaining blocker found in the final fixes reviewed.
Reviewed current 203-line `packages/core/src/mcp.ts`, the admitted-save regression, and its supplied pre-fix failure log.

## Final closures
- `add():87–92`: reads current metadata after credential persistence, checks connectionID, returns the current view when enabled changed. The newer disable survives without status reset or automatic connection. No asynchronous gap exists between this check and starting connect.
- `packages/core/test/mcp.test.ts:161–187`: deterministic held-write/microtask regression asserts disabled status, enabled false, no tools, zero transports. `/tmp/opencode/desktop-mcp-disable-before.log` confirms this failed as connected before the fix.
- `connectAll():166–176`: compares the current metadata snapshot before connection/status changes and before migration-failure publication. Removed/replaced/retoggled records no longer receive stale migration status.
- `connect():128–134`, `disconnect():156–162`: the caller supplies its own version object before synchronous status publication. Listener invalidation cannot be recaptured as the caller's valid generation; pending ownership is also conditional on that original token.
- Earlier closed findings remain closed for this scoped sign-off; no repeated full audit performed.

## Evidence limits
- No tests/builds executed; no source/test edits. Only this review document updated.
- Earlier supplied after-log records 34 passing tests for the preceding revision, not the latest final changes.
- Final unit/type/lint, IPC/package verification remain coordinator-owned; their completion is not attested here.
- Sign-off covers the specified MCP fixes only. Cipher-file implementation, UI/design, SDK/backend delivery, native Mac behavior remain outside scope.
