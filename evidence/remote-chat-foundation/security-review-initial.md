# Main remote Chat security review

**One concrete blocker: GIF/WebP signature validation loses high bits.** Remaining reviewed identity/transport paths have no identified blocker.

## P2 — invalid raster magic reaches authenticated upload

`packages/desktop/src/remote-chat.ts:360-369` (initial receipt: `352-361`) decodes magic bytes using `Buffer.toString("ascii")`. Node clears each byte's high bit. Invalid binary prefixes therefore become valid GIF/WebP text:

- `c7c9c6b8b9e1` becomes `GIF89a`.
- `d2c9c6c6b0b0b0b0d7c5c2d0` becomes `RIFF0000WEBP`.

Both invalid Blobs passed `binding.upload`, reached the actual SDK Library request, and entered the private owned-file map after the fixture response. This bypasses the stated MIME/signature admission check; no forged SDK/client object is involved.

Minimal correction, `remote-chat.ts:362`:

```diff
- const text = Buffer.from(header).toString("ascii");
+ const text = Buffer.from(header).toString("latin1");
```

Retain a regression asserting high-bit GIF/WebP magic rejects `invalid_request` before any Library request; preserve valid magic acceptance.

## Verified boundaries

- `remote-session.ts:58-85,155-166,258,262-281`: normalized origin, identity object/epoch ownership, replacement abort, bounded expiry scheduling, timer cleanup, immediate Chat abort before local logout revocation. Refused candidates leave active identity intact. Old HTTP401 cannot invalidate the replacement.
- `remote-chat.ts:110-209`: named methods/path allowlist, pinned origin, redirect refusal, final-origin check, exact 200/media type, 4 MiB JSON / 16 MiB stream cap, 10s headers/JSON deadline, 60s stream idle deadline. Request/identity cancellation races Fetch and reads; cancellation cleanup does not await an uncooperative source.
- `remote-session.ts:201-211`: the same private SDK client/cookie jar handles auth and Chat. Platform cookies remain omitted. Bound API exposes no client, credentials, arbitrary URL/header/path or Fetch access.
- `remote-chat.ts:37-47,356-388`: Blob-only positive-size input, 8 MiB cap, strict caller metadata, PNG/JPEG byte checks, owned ID lookup and conversation restrictions. Response metadata is parsed before ownership registration. Signature bug above is the identified exception; malformed response/inference DTO review remains assigned separately.
- Main observer API remains process-only. HTTP/SDK failures and in-band `error.detail/request_id` are normalized; no logger/storage/IPC write path introduced. Broader typed stream payloads remain main-only, requiring later core/UI interpretation. The explicit one-unresolved-turn ledger ceiling is present at `remote-chat.ts:389`.

## Evidence / adequacy

Original `/tmp/opencode/remote-chat-main-implementation/` receipt: **11 transport + 8 unchanged auth tests passed**; strict typecheck/focused lint exit 0. Initial source hashes matched that receipt. `remote-session.test.ts` still has eight cases, zero diff, SHA-256 `29c8e4a175495f1ee2c87a70d489f68167911d333aa9200114f59cb9fc50c0f4`.

New isolated Node **v22.23.3** probes use current source plus real SDK with controlled Fetch/Response streams; no hosted calls. Result: **1 failing signature regression, 2 passing cancellation probes**:

1. Both high-bit signature payloads are incorrectly uploaded.
2. A real 200ms local-expiry timer aborts an already-idle stream without calling `state`, `bind` or another operation; raw `cancel()` deliberately never settles. Result: `provider_auth_failed`, raw reader canceled.
3. Local logout settles an open stream and a pending Fetch that ignores abort **before** held server revocation returns. Result: both `aborted`, raw reader canceled.

Files: `/tmp/opencode/remote-chat-security-review/{probes.test.ts,vitest.config.mjs,current-probes.log,current-probes.json,current-provenance.json}`. Re-run:

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run --config /tmp/opencode/remote-chat-security-review/vitest.config.mjs
```

Concurrent Cloud compatibility edits landed during review. The three probes were rerun against stable before/after hashes recorded in `current-provenance.json`: `remote-chat.ts` `6d58248c5e1546b20de74cc001d1c8f4eeb17ecff4259c619507b9c6069f49bc`; `remote-session.ts` `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6`. Signature finding remains present. Original 19-pass receipt is not claimed as coverage of those later compatibility edits.

Only review report/probes written. No repository edits, builds, full-suite runs, Mac/CI operations or commits. Core/IPC/UI routing and real Cloud inference remain unaccepted by this bounded review.
