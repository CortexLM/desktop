# Native evidence claims review

Independent read-only review verified both native packages and the five retained captures
(two MCP/provider views, one negative, two corrected-provider views). All images are 960×640
with traffic lights. The old provider views hide the sidebar; corrected views show it.

- `de623fd`: 21/21 retained-file hashes; `9d704ee`: 9/9; 87 relative links resolve.
- Actual artifact ZIPs/ASARs match receipts, each names exactly 90 embedded build members.
  Both carry eight locales × 13 catalogs. Corrected members match the local build.
- Real IPC checks cover MCP metadata-only save/list/connect/remove, encrypted mode0600 stores,
  and provider key redaction. Controlled endpoint records six requests across two handshakes,
  only booleans for credential/path matching.
- Corrected provider script checks 270px readable hint, wrapping/nonoverlap, viewport containment,
  redacted key and renderer reload. It does not assert a full-process restart.
- No full native sweep, frozen-reference closure or remote-inference acceptance follows.

One wording defect was corrected: cleanup JSON records remote closed ports and installed ASAR;
SSH forwarding shutdown, ordinary-app restoration and lease release are operator observations.
The reviewer did not re-run tests or use the Mac. Current CI has a separate artifact review.

Raw bounded review: `/tmp/opencode/desktop-mcp-final-claims.md`. Earlier negative captures and
failed CI remain unchanged. This summary records the correction, not a second test execution.
