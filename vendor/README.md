# Vendored packages

`@cortex/sdk` 0.3.5 and `@cortex/api-types` 0.2.0 are vendored unmodified from the
Cortex SDK workstream (`CortexLM/backend`, `packages/sdk`) because this repository's CI
cannot see that checkout.

The SDK declares `@cortex/api-types` `0.2.0` as an exact optional peer;
`packages/desktop/package.json` depends on both tarballs directly. Re-vendor with
`npm run pack:vendor -- <out>` in the backend's `packages/sdk`.

Source: `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31` ([backend #447](https://github.com/CortexLM/backend/pull/447)).
Canonical schema: Git blob `c8f6a7f0257858306a885c71202c13420f40725f` at backend
`af36085cc96b182950ca4bf15161dcf2c3951da1`, SHA-256
`b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`.
Only the screenshot upload contract changed from the earlier `d6d46014` schema;
all 422 operation IDs remain. The immutable owner release is
`/root/cortex-goals/releases/sdk-0.3.5-5b7e9d1c3fa2/`.

| Archive | SHA-256 |
| --- | --- |
| `cortex-sdk-0.3.5.tgz` | `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |
| `cortex-api-types-0.2.0.tgz` | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |

Only Electron main imports the SDK. `probeRemote` in `packages/desktop/src/remote.ts`
checks readiness/instance metadata, then calls `client.models.list()` for Cloud or
`client.registry.models.list()` with configured-only pagination for self-host. The transport
pins the origin, refuses redirects and cookie storage, and bounds the whole probe to five
seconds. The probe supplies no auth token. Separate `RemoteSession` uses the SDK's typed
email-code/local-login/continuation operations in main; session material lasts until process
exit. An internal account-epoch Chat binding supplies the process-only core service with
models/uploads/streamed turns and bounded history. Public desktop prompts still use local
providers; see [connection-modes.md](../docs/connection-modes.md).

`packages/desktop/test/remote.test.ts` exercises the SDK against a local stub. Its optional
real-backend case (`CORTEX_TEST_BACKEND_URL`) asserts reachability; the recorded
[`evidence/sdk-real-backend.log`](../evidence/sdk-real-backend.log) contains returned model
metadata, not a generated response or authenticated-session proof.

This pair supplies typed email-code/MFA/email-verification, local sign-in, configured registry
queries and raw Library/screenshot uploads. Screenshot upload requires a filename and returns
typed metadata. Five generated turn/edit/regenerate methods accept `body?: unknown`; this is
transport typing, not a validated turn DTO. Password/signup/refresh, Cloud catalogue, account
and history payloads remain generic. History is bounded and omits reasoning/tool replay;
there is no stable public account ID for durable cross-login caching.

The stream helper preserves announced image completions after `done` and their final cursor;
this does not cover arbitrary post-terminal events or cancel backend generation. Successful
auth JSON is read once before identity replacement, removing the native response-clone
shutdown defect. Desktop's bounded auth transport remains necessary. Scoped Node 22 admission
covers discovery, main-only authentication and consumer transport fixtures; real Cloud
authentication/inference and packaged/native acceptance remain separate.

SDK 0.3.5 hides the parser's discarded-frame notifications. Desktop conservatively marks
every remote projection limited, even after `done(stop)`; [owner follow-up](https://github.com/CortexLM/backend/pull/447#issuecomment-5966461570)
requests the existing callback. No archive modification or second consumer parser is used.
The pinned backend also omits historical image pixels; fresh image-history follow-ups
remain refused pending its separate hydration contract.

The old 0.2.0/0.1.0 and 0.3.1 archives remain historical. SDK 0.3.0 remains on adoption hold for
its Node 22 sign-in regression; the original owner artifacts/failures remain preserved, as do
0.3.1's media/screenshot failures and incomplete 0.3.4 shutdown receipts. Earlier desktop
SDK/native evidence, including `ffc118a` with SDK 0.3.1, does not certify this new pair.
