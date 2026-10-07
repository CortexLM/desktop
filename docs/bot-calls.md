# Bot calls (desktop)

A signed-in user talks to a Bot by voice from Work → Bot. The call is full duplex,
and it survives in-app navigation: the shell shows it minimized as `BotCallDock`.
The server is the Task10 producer (`/v1/live/sessions`); the web client runs the
same protocol.

## Split between main and renderer

Electron main owns the ticket, the media socket and the bearer. The renderer only
moves PCM, and it never sees a credential.

| Side | File | Owns |
| --- | --- | --- |
| Protocol | `@cortex/api-types` `call-session.ts` (vendored pair, `vendor/trunk/`) | `CallSession`: tickets, socket, sequence/epoch/generation, `played` credits, resume, end, malformed-frame handling; `resampleTo16k`, `takeCallFrames` |
| Main clock | `packages/desktop/src/call-session.ts` | `timerEnv`, injected into `CallSession`. Main has no `online` event, so each resume attempt is the connectivity probe |
| Main host | `packages/desktop/src/remote-call.ts` | `createCallHost`: one call per window, HTTP over the remote identity, the Node `WebSocket`, and owner watches |
| IPC | `packages/desktop/src/main.ts`, `preload.ts` | The `cortex:call:*` channels below |
| Renderer | `packages/app/src/screens/work/bot-call.tsx`, `call-owner.ts`, `public/call-tap.js` | Web Audio capture and playback, the window's one call, `BotCall` and `BotCallDock` |

A protocol fix is made once, in the backend's
`packages/api-types/src/call-session.ts`, and arrives with the next vendored pair.
Do not copy `CallSession` or the resampler into this repository.

## IPC (`window.cortex.call`)

| Channel | Kind | Payload | Main validates |
| --- | --- | --- | --- |
| `cortex:call:available` | invoke | none, returns `offer`, `unavailable` or `hidden` | local mode or a signed-out window returns `hidden` |
| `cortex:call:start` | invoke | `botId` | the UUID shape; one call per window; the window becomes the owner |
| `cortex:call:snapshot` | main → renderer | `CallSnapshot` | — |
| `cortex:call:play` | main → renderer | `pcm`, `sequence`, `generation` | — |
| `cortex:call:flush` | main → renderer | none | — |
| `cortex:call:capture` | send | 640-byte `Uint8Array` | anything else is dropped |
| `cortex:call:played` | send | `sequence`, `generation` | coerced to numbers |
| `cortex:call:mute` | send | `boolean` | `=== true` |
| `cortex:call:interrupt` | send | none | — |
| `cortex:call:end` | send | none | — |
| `cortex:call:stats` | invoke | none | registered only in unpackaged builds (test hook) |

`CallSnapshot` crosses as plain data: `phase`, `muted`, `heard`, `partial`,
`streaming`, and optionally `end` and `protocol_error`.

## Ending

- **Owner window.** The call ends with one `DELETE` when its owner window is
  destroyed, crashes (`render-process-gone`) or loads another document. Same-document
  routing keeps the call running.
- **Logout or account switch.** These abort the identity signal, so the call ends
  `auth_revoked`.
- **Microphone loss.** The renderer ends the call through `cortex:call:end`.

## Malformed frames

A binary frame that does not decode is counted in `stats.protocolErrors`. The call
then ends with `end:'failed'` and `protocol_error`, and main sends `{op:'end'}`. The
frame never throws inside `ws.onmessage` in main; before this change it did, and
it became an `uncaughtException`.

## Tests

| File | Covers |
| --- | --- |
| `packages/desktop/test/call-session.test.ts` | Capabilities, partials, malformed frames, lease-bounded resume (fake clock) |
| `packages/desktop/test/remote-call.test.ts` | Host, consent and owner watches |
| `packages/app/src/screens/work/call-owner.test.ts` | Renderer lifetime |
