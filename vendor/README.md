# Vendored packages

`@cortex/sdk` 0.3.1 and `@cortex/api-types` 0.2.0 are vendored unmodified from the
Cortex SDK workstream (`CortexLM/backend`, `packages/sdk`) because this repository's CI
cannot see that checkout.

The SDK declares `@cortex/api-types` `0.2.0` as an exact optional peer;
`packages/desktop/package.json` depends on both tarballs directly. Re-vendor with
`npm run pack:vendor -- <out>` in the backend's `packages/sdk`.

Source: `ce05a6040ec05ac479d23dc2f701c8835a529663` ([backend #447](https://github.com/CortexLM/backend/pull/447)).
Canonical schema: Git blob `d6d46014d1c436b96540529dca2a3005556ae920` at backend
`70a3056f7223a7eb9257d984848d4d33fee7ec12`, SHA-256
`93806bd0f31a0499b6bded99a25b319a90cd5afc011b70021ba921ed12107724`.
The immutable owner release is `/root/cortex-goals/releases/sdk-0.3.1-ce05a6040ec0/`.

| Archive | SHA-256 |
| --- | --- |
| `cortex-sdk-0.3.1.tgz` | `d47fb53878385849d74822b22526838aa3f99a3cbccb96ec95324a419838d12e` |
| `cortex-api-types-0.2.0.tgz` | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |

Only Electron main imports the SDK. `probeRemote` in `packages/desktop/src/remote.ts`
checks readiness/instance metadata, then calls `client.models.list()` for Cloud or
`client.registry.models.list()` with configured-only pagination for self-host. The transport
pins the origin, refuses redirects and cookie storage, and bounds the whole probe to five
seconds. Main supplies no auth token. The SDK does not route desktop prompts
or authenticate users; see [connection-modes.md](../docs/connection-modes.md).

`packages/desktop/test/remote.test.ts` exercises the SDK against a local stub. Its optional
real-backend case (`CORTEX_TEST_BACKEND_URL`) asserts reachability; the recorded
[`evidence/sdk-real-backend.log`](../evidence/sdk-real-backend.log) contains returned model
metadata, not a generated response or authenticated-session proof.

This pair supplies typed email-code/MFA/email-verification, local sign-in and raw Library
uploads; registry queries now type `configured`. Password/signup/refresh, Cloud catalogue
and history payloads remain generic; generated Chat turn methods lack request-body types.
The stream helper still truncates post-`done` media events, and generated feedback screenshot
uploads serialize files as JSON. Admission here covers desktop discovery, not those workflows.

The old 0.2.0/0.1.0 archives remain historical. SDK 0.3.0 remains on adoption hold for its
Node 22 sign-in response regression, fixed in 0.3.1; its original owner artifacts and failure
receipts remain preserved. Earlier desktop SDK/native evidence is not proof of this new pair.
