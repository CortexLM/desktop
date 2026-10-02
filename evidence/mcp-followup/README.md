# Main-only MCP connection storage

Local contract correction after `f2754be`; no new product page is introduced.

- `McpConfig` is write-only. Complete command/arguments/environment/URL/headers live in main's
  separate `mcp-credentials.json`; SQLite holds name/type/enabled and an opaque reference.
  `McpServer` responses allowlist metadata, status, tool metadata and neutral errors only.
- Legacy inline records are redacted immediately and migrated only after credential persistence.
  Failure preserves the old record; persistent hosts without a credential store refuse writes.
- Replacement stages a fresh credential before switching the metadata reference. Failed writes
  preserve prior configuration. Removed/replaced pending connections cannot publish stale tools
  or overwrite newer status; remote redirects are refused before forwarding custom headers.
- Credential files use exclusive `0600` temporary files plus same-directory rename. Invalid or
  unreadable files reject operations instead of silently overwriting other credentials.

## Regression evidence

`before.log` preserves four failures against the original contract: plaintext config returned,
credential-write refusal ignored, legacy values exposed and server responses leaking config.
`race-before.log` preserves removed-server tool resurrection in the initial correction.
`review-before.log` preserves three review failures: reconnect overwrites disable, delayed removal
deletes a new replacement and cross-origin redirect reaches its target. `disable-before.log`
preserves a later save continuation overriding a newer disable. All nine are corrected.
Filtered tests in these logs are unselected, not conditional acceptance skips.

The credential worker separately reproduced 17/22 failures before its patch; that output was
not saved as a file and is not claimed as retained evidence. Its final 23 cases cover corrupt
stores, read/write/rename/encryption failures, mode, existing readers and prototype-like keys.
Core adds eleven lifecycle/storage cases; the server verifies sanitized responses and URL validation.
Electron IPC verifies save/list/reload/remove plus absence of sentinel plaintext in a fresh
SQLite/WAL and credential file. These checks do not assert historical page erasure.

## Verification scope

Local integrated checks reached **173 unit passes**, one optional backend skip; lint/types and
i18n audit pass. Initial full Electron run: **51/51**, 426 registered renders; review corrections
pass seven targeted engine/provider UI cases and Linux package/smoke. The final startup-migration
status/disable guards pass targeted MCP, IPC and packaged checks. Subsequent
[CI 37063183382](https://github.com/CortexLM/desktop/actions/runs/37063183382) passes 51/51 per OS
and macOS package/smoke after the serial-GUI test configuration change.
[Final source review](source-review.md) approves the bounded correction; retained final logs
show 173 unit passes, lint/types, MCP IPC and packaged smoke success.

### First CI and native-window contention investigation

[CI 37061251022](https://github.com/CortexLM/desktop/actions/runs/37061251022) at `ca08282`
passes static checks and **51/51 Linux E2Es**; macOS passes **50/51**, including the MCP case.
Navigation's `locator.click` waits 30s for frame stability after returning from Gallery.
The target resolves, but no click dispatches. The earlier documentation-only run separately
stalled at a screenshot after fonts loaded. Both negatives are retained; neither is a proven
MCP regression or a proven infrastructure fault.

macOS test execution defaults to one worker to reduce contention among this suite's Electron apps.
No assertion, timeout or screenshot is removed. A bounded Linux-only probe
records 2 hidden-window frames/1.2s, 3 after disabling throttling, 72 after showing the window;
the attempted throttling override was discarded. Earlier frame loops remain during later phases;
this is a frame-availability observation, not an isolated rate benchmark or macOS reproduction.
Neither CI stall's cause is established. Later macOS CI/package success is retained separately.
Six navigation/keyboard cases pass locally with one worker (`serial-local.log`); this is Linux
evidence, distinct from the later macOS result. The earlier capture has a separate source-bound
[trace adjudication](ci-1e91a43/README.md).

Installed exact `de623fd` [credential checks](../mac/de623fd/README.md) prove encrypted MCP save,
quit/relaunch, successful decrypted connection and removal, plus provider key redaction. Two
native captures use the hidden sidebar. Normal-sidebar verification found a zero-width key
label/hint, addressed separately by the [provider-row correction](provider-layout.md).

Credential cipher unit tests use a test cipher; Electron exercises the actual host credential path.
When safeStorage is unavailable, the existing `p:` base64 fallback remains explicit: encoding is
not encryption. Migration does not erase historical SQLite pages/WAL/backups. Superseded-secret
cleanup is best effort; a failed cleanup may retain an unreferenced secret. There is no new
cross-process locking, power-loss durability, MCP sandbox, validation-only probe, or MCP screen.
Tools/server-returned content is not covered by configuration redaction.

Complete combined design candidate `3e99a045` / `45839` and double scoped attachment closure
remain [separate documentary delivery](../recovery-followup/scoped-design-closures.md). Source/state
imports and remote authentication/inference still require their owner handoffs. Existing native
and frozen evidence retains its revisions; no UI redesign or wholesale reference update occurs.
