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

## Correction review — approved, 2026-10-03

**Historical P2 closed. Signature correction and canonical Cloud fallback approved; no remaining blocker in this bounded review.**

- `remote-chat.ts:362`: `latin1` preserves magic bytes exactly. Unchanged independent probes now reject both high-bit GIF/WebP payloads with `invalid_request`, **zero Library calls**. Author regression additionally checks normal GIF/WebP magic acceptance and absence of owned IDs after refusal.
- `remote-chat.ts:160-161,244-253`: fallback requires the private marker created exclusively by actual HTTP404 on `GET /v1/instance`, plus exact `origin === CLOUD_URL`. Origin/redirect checks precede the marker; active-identity guard precedes fallback catalogue fetch. Body-supplied status, malformed200,403/500, arbitrary self-host404 and models404 cannot trigger it. `remote-session.ts:164` supplies the validated normalized origin; no caller-selected endpoint or unauthenticated binding is introduced.
- `remote-chat.test.ts:43-54,120-160`: injected transport asserts canonical origin/redirect/cookie policy, routes only the socket to loopback, restores canonical response URL. Positive/negative fallback tests exercise actual SDK/native HTTP; this establishes policy, not hosted authentication/inference.
- Retained 25-case source/receipt includes real PNG fixture, equal-ID delivery and observer-failure replay retaining original path/body/key plus acknowledged cursor. No new source logic for those replay behaviors. Eight original auth tests remain unchanged.

Independent rerun: **3/3 PASS**, Node **v22.23.3**, exit **0**. Real expiry timer still aborts an idle reader; logout still settles held Fetch/open-stream delivery before revocation completes despite never-settling raw cancellation. New files: `/tmp/opencode/remote-chat-security-review/corrected-probes.{json,log}` and `corrected-provenance.json`. Historical `current-probes.{json,log}`, `current-provenance.json`, and probe source retain identical before/after hashes.

Stable source SHA-256 during independent rerun:

| File | SHA-256 |
| --- | --- |
| `packages/desktop/src/remote-chat.ts` | `4b2674007b8e634b371bf30322b713c8ab9e00ba2309b6b833783a39fe1d8b12` |
| `packages/desktop/src/remote-session.ts` | `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6` |
| `packages/desktop/test/remote-chat.test.ts` | `e65fb3817a36dbff50703a3182910f1c347d36bcfdb77c4e1c2c7db9a855160d` |

The author's 25/25 + typecheck/lint receipt was inspected, not rerun. It pins `remote-chat.ts` to `036fd37f065c996ecc107200904ff27b37428908172e7c729572083a3c9180ac` and its test to `ba1815e856e56c5397de03cf97c1ed1368adcbe5de60c32f281d6de9f33478ad`. Concurrent HTTP403 classification/test edits landed before the independent run; signature/fallback code remains as reviewed. This approval does not extend the old 25-pass receipt to later edits or replace the pending DTO review.
