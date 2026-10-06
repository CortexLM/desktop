# Connection modes

## Task8 bounded Work/Bot

Work/Bot -> Channels uses the exact e5e-approved SDK pair for owned group metadata.
List/filter/create/get/rename/member replacement/delete project only id/name/members.
Rename-only PATCH omits members. Null/omission preserves, [] clears; edited selections
replace the entire set, including stored members absent from the loaded roster until
explicitly removed. Failures preserve drafts with neutral distinct refusal copy;
reconnect rechecks ownership, replacement epoch clears drafts and fences late responses.
Delete requires confirmation, returns200 deleted:true, cascades group history but not
delivered Bot inbox messages. No transcript/send or runtime/provider-delivery toggle.
Seven non-English channel catalogs retain English copy; translation quality unclaimed.

Signed-in Work notifications uses owned home inbox and in-app notification safe DTOs
from main's exact approved SDK. Home ordinary read/unread/read-all returns `{ok:true,
updated}`; pending approval pseudo-items remain unread, no settlement via inbox read.
Notifications list up to100; bodyless item/read-all204, foreign item404. Filters/search
and counts cover the loaded windows (home50 plus pending50), not a durable full activity
feed or unseen account total. Reconnect always reads a fresh owner-bound snapshot;
process-local512 SSE ring resets, IDs are not durable and notification ID is not its
resume cursor. No arbitrary payload projection, action replay, inbox handoff/send or
provider inference occurs. Existing approval/routine/lead/parent/copy/connector seams
remain separate. No notification push, OS delivery or broad preferences completion.

Signed-in Work -> Routines reads exact owned Bot routines through main's typed SDK.
Create/edit/delete and bodyless pause/resume use durable server responses. The editor
sends required name/prompt and an explicit schedule on PATCH, retaining body, quiet
preference and trigger extensions. Refresh reads up to 100 retained runs per routine
without inference. Running, Completed, Failed and Interrupted are server history, not
task promises. Pause affects future occurrences, not an active run; task cancellation
remains a separate Work action. No routine-run cancellation or manual cron tick UI exists.
Scheduling displays the exact cron and fixed UTC offset. Offset stays fixed across DST;
timezone labels are metadata, not conversion. Without an offset, Paris seasonal rules
apply. Explicit event delivery uses saved instructions, a UUID delivery ID, no payload.
Duplicate delivery and concurrent live runs are excluded by the producer, not optimistic
renderer state. Zero completed runs can mean paused/duplicate/busy/offline failure.
Read actual history; no automatic retry/replay. Seven non-English catalogs temporarily
retain English copy for this new namespace; translation quality is not claimed.

The approved pending-approvals pair supplies account `/v1/bot/approvals` and owned-Bot
`/v1/mascots/{id}/approvals/pending` reads. The roster shows account pending requests;
each owned Bot shows its own list and existing policy evaluation audit. Linked widgets
permit explicit Allow once/Deny; unstamped rows cannot be decided. Only safe metadata
crosses IPC, without arguments/secrets or returned tool content. After a successful
decision, the renderer re-reads the actual pending list before confirming removal.
`resumed` reports allowed, not successful tool execution. Deny skips the parked tool
but can resume model inference. A refusal or interrupted request remains unconfirmed;
refresh reads state without automatically resubmitting. Policy run/deny/pause is an
audit, not execution outcome. No outcome GET or approval invalidation event exists.
Late results cannot update a replacement account. Full Task8 remains open.

The exact independently approved copy pair enables sharing from owned Bot
configuration and recipient invitations from the roster. Owner actions enable an
independent copy, invite an existing account, list invitations and revoke future
acceptance. Recipients preview allowlisted configuration and accept once; routine
invitations optionally target an owned Bot. Replay returns refusal with no second copy.
Conversations, memory, secrets, connections, channels and the owner's computer stay
private. Plugin names copy; recipients supply their own credentials. Recipients can
decline from the existing preview. Main sends the approved bodyless POST and validates
the invitation ID, terminal state and server timestamp. Only its successful durable
response clears the preview; failure retains it for reconnect. Sender DTOs retain
optional decision fields. Declined inbox/preview/accept and decline replay are closed.
Reinvitation cannot reset a decision; separately acquired public tokens are not banned.

Signed-in Work and Bot routes read the selected account's actual Bot roster, save
name/instructions/label/look/status/notification configuration, enqueue bounded
`explore` tasks through the existing Task4 async worker and display durable backend
status/results and retained original-channel notices. The task row is durable; this
is not an integration with the separate Jobs queue subsystem. Main admits only the
exact typed Bot paths. Epoch checks fence late requests and account replacements.

Cancel acknowledges only the backend response. Failed requests show unconfirmed;
running cancellation can leave `execution_unknown` external effects. Native restart
and reconnect read stored results/notices without new inference. Earned autonomy
accounting and cloud computers are unavailable; no desktop host fallback runs.

The independently approved Bot-parent SDK supplies precise required text and JSON
message/replies DTOs. Sending an explicit message to the original Bot runs a parent
turn with exact retained terminal child context through migration 0151. Receipt
attachment is durable once per task; reading results or reconnecting does not send
a parent message or replay child effects. Owner notices alone are not parent receipts.
Owned Bot configuration reads the real app catalog and account connections, saves
Chat/Bot consent and always/changes/important preferences, disconnects apps and
toggles exact owned-Bot enables under account grants. Authorization links stay in
main, never in renderer responses, and open only on explicit user action.
Per-Bot tool rules use always_allow/require_approval/deny with tool/connector/category
matches. Organization rules and the separate global ask/always_ask matrix can tighten
access. Upserts re-list durable rule IDs; deletion requires one confirmed deleted row.
Owned hierarchy uses required UUID-or-null `lead_id` from the exact approved successor
SDK. The roster switches between owned cards and stored parent/child relationships;
configuration selects an owned lead or no lead. Create omission/null roots, PATCH
omission preserves, explicit null detaches. Hierarchy saves send only `lead_id`,
preserving unrelated configuration. Cycle/self422 and missing/foreign404 refuse;
serialization failures remain unconfirmed. Reconnect reads durable state; another
save is explicit, never an automatic overwrite/retry. Deleting a lead detaches its
direct children; independent copies are roots. No runtime dispatch, permission
inheritance or earned autonomy follows. Full Task8 remains excluded. The decline fixture
binds the actual approved producer and its migration stack through 0156; acceptance
of the combined Task6 assembled producer migration stack remains unverified.

## Task8 bounded desktop Code

Signed-in remote/self-host connections show explicit LOCAL/Cloud Code selection. LOCAL
means the approved backend's configured, account/session-scoped developer workspace, not
the desktop folder picker or a hidden host fallback. Cloud requires an admitted farm guest;
unavailable capacity refuses and retains the draft. Model tool arguments launch bounded
children through the approved Task3 turn API; no Task HTTP route is invented.

Main owns SDK credentials, refresh and `/v1/me.id` identity. The exact Code allowlist admits
session list/create/get, transcript, permissions/decision, events, turns and cancellation only.
The renderer receives owner epochs and public DTOs, never tokens or arbitrary proxy paths.
Exact write diffs and command actions require Allow once or Deny. Tool results come from the
durable transcript. Stop calls the backend cancellation API; reconnect/restart reads retained
history and parent results, never regenerates or delivers a client-side duplicate result.

This subset does not admit Work/Bot teams/connectors, cloud provisioning success, SSH/pairing,
PR publication, automation, arbitrary folder execution or a new design-supplement import.

## Task7 retained-history consumer

The active immutable dependency pair is recorded in `vendor/README.md`. Main stores complete
opaque Redis IDs without numeric conversion. Empty IDs clear resumability while retaining
their payloads; truncated reset delivery becomes history-only. Neither main nor core retries
that turn without a valid cursor. Exact replay retains original path/body/idempotency key;
repeated meaningful IDs are suppressed by the admitted SDK. Its discarded-frame callback
marks only affected projections limited. Explicit incomplete/blocked/cancelled outcomes and
termination reasons remain visible in core snapshots and never become successful stop.

Known-history reads paginate backward at 200 items per request until `has_older:false`,
returning chronological active-parent order. Duplicate records, repeated/missing cursors,
changed-parent paths and the backend 10,000-message ceiling fail before replacing the renderer
snapshot. All retained DTO fields, ordered parts, reasoning, tool results and retention metadata
remain available. The renderer displays retained part text/metadata as inert text, never HTML
or executable links. Deleted/unavailable/not-retained states are explicit. Image-bearing
follow-ups require confirmed vision and rely on the admitted backend's owned-byte hydration.

Expired replay marks the live message projection partial immediately. Loading complete retained
history releases the pending turn and shows that history separately; it does not rebuild or
replace the live projection, so the live message remains partial and never claims complete.

Explicit device sign-in returns the existing native bearer/refresh pair through
`/v1/auth/device/token`. Main stores one origin-bound pair in `remote-credentials.json`
using OS encryption only, refuses Linux `basic_text`, validates stable `/v1/me.id` after
issuance and rotation, and single-flights refresh. JWT `exp` schedules rotation only;
no refresh expiry or client-supplied SID is invented. Logout erases local credentials,
finishes an in-flight rotation before bearer revocation, then erases again. Failed/revoked
refresh signs out without starting another login. Email-code grants remain process-only.

Verified native accounts persist remote snapshots in the existing SQLite `doc` table,
partitioned by canonical origin and `/me.id`. Restart rebinds snapshots to a new epoch;
unfinished delivery requires retained-history recovery, never a new generation/replay.
Account discovery reads active and archived conversation lists through the approved
Task7 pagination producer, using typed `sort=created`, `limit=100` and owner-bound
cursors until `has_more=false`. Pages are bounded; total records have no artificial cap.
Repeated discovery preserves admitted image hydration requirements.
Local Project Chat and local provider execution are unchanged.
Older receipts and limits below describe the historical pair, not this new consumer admission.

**Today: saved preferences, reachability probes and process-lifetime email-code sign-in.**
All three modes keep chat sessions, prompts, tools and storage on the local engine.
Cortex backend prompt routing is not wired; the local engine still calls configured providers.

`ConnectionMode` (`packages/schema/src/index.ts`) = `{ mode, url?, signedIn }`, stored by
`ConnectionService` (`packages/core/src/connection.ts`).

| Mode | Current behaviour | Probe target |
| --- | --- | --- |
| `local` (default) | No account; probe returns `not_applicable` | none |
| `cloud` | Saves the mode; email-code sign-in runs in main | `https://api.cortex.foundation` (`CLOUD_URL`) |
| `selfhost` | Saves a URL and checks it; email-code sign-in is usable on hosts supporting it | the URL the user enters (required) |

Routes: `GET /api/connection`, `PUT /api/connection`, `GET /api/connection/probe`,
`GET /api/connection/auth`, `POST /api/connection/auth`.

## Prompt routing and authentication

`packages/app/src/api.ts` always uses the local IPC bridge in Electron. Main sends every
`/api/*` request to `createServer(core)`; `session.prompt` calls `core.sessions.prompt`.
`SessionService` resolves models from the models.dev catalog and local provider settings.
It does not read `ConnectionService`. Selecting cloud or self-host therefore changes
neither the provider endpoint nor the model picker, and sends no prompts to that server.

`probeRemote` accepts an optional token, but desktop main calls it without one. Authentication
uses a separate `RemoteSession` (`packages/desktop/src/remote-session.ts`) injected into core's
`RemoteAuth` host contract. Main validates every remote auth result; IPC returns only
`{ status, signedIn, email?, owner, candidate? }`. `owner` is a main-issued origin and
step revision; `candidate` scopes pending cancellation independently of step changes.
Local/unavailable state has `owner: null`. These process-local identifiers are not
backend credentials or durable account IDs. Bearer tokens, cookie jars, pending authentication tokens,
challenge/factor IDs and enrollment secrets stay in main, never SQLite, renderer storage or events.
`signedIn` derives from the active validated main session; persisted/renderer-supplied booleans
cannot establish authentication. A pending account candidate may coexist with an active session.

Ownership binding passes scoped review and 165 local Electron cases. Submissions carry the
displayed step owner; Cancel carries the captured candidate identity, including during
initial email dispatch. Cancel before the first state arrives only leaves the screen,
without cancelling an unseen candidate. Stale forms must not borrow newer authority or
automatically retry old codes. See `evidence/auth-owner-followup/renderer-contract.md`.

Sessions last until Cortex quits. Cloud refresh and persistent account identity remain pending.
Main's private Chat binding implements authenticated models/upload/turn/history transport;
core's process-only projections consume it. Nine JSON routes under `/api/remote`
expose models, sessions and admission/detach/resume/known-history operations through
the typed `remoteSessions` client. A session-owned upload route carries strict base64
JSON with an 8 MiB decoded limit; IPC strings/JSON parsing are not memory-bounded by it.
Optional `oneOffModelSlug` reaches main as `one_off_model_slug`, preserving recorded
model/effort and the original replay request. Renderer dispatch is implemented in
the working tree: unprojected Home selects remote Chat for a signed-in remote
connection; existing untagged Chat and project routes stay local. Explicit remote
links carry source, epoch and session ID. Separate process-only sidebar/History
lists never expose local rename/delete/pin actions on remote records.
Scoped verification is in progress; no native or real-account acceptance is claimed.
See `evidence/auth-owner-followup/remote-api-adapter.md` and
`evidence/auth-owner-followup/remote-renderer-status.md`.
Main's typed actions cover email-code acquisition,
operator local login, email verification and MFA challenge verification. Existing Login now
wires email-code, email verification (1–128 trimmed characters) and six-digit MFA challenge
forms through the checked owner. Local password and MFA enrollment remain unavailable.
The continuation forms pass fourteen targeted Electron cases and scoped source/visual review;
expanded eight-language/two-theme keyboard verification also passes. Full local regression
passes 169 Electron cases; native acceptance remains pending. See
`evidence/auth-owner-followup/continuation-adoption-map.md`.
Operator bearer expiry aborts active transport at its deadline and is checked on state/binding access.
Cloud sign-out discards device-local state;
server-side revocation is not claimed. Local operator logout uses its typed endpoint.

Each auth candidate has a separate origin-pinned SDK client and in-memory cookie jar. A failed
candidate preserves the active account. Successful promotion aborts the previous client;
cancel/logout and accepted mode/origin changes invalidate pending work. Requests refuse redirects
and foreign origins and have ten-second deadlines. Main shutdown clears all session material.

## Private Chat transport

### Staging build routing

Production builds keep `https://api.cortex.foundation`. To build a staging main
bundle, set `CORTEX_RELEASE_CHANNEL=staging` and `CORTEX_STAGING_API_ORIGIN` to an
explicit non-production HTTPS origin. Missing origin, credentials, paths, query or
fragment, production host and unknown channels fail the build. Supplying a staging
origin without the staging channel also fails. The origin is compiled into main,
not read from renderer input or runtime environment; preload is unchanged.
Staging uses `Cortex-staging` as its default user-data directory. An explicit
`CORTEX_DATA_DIR` still selects the engine directory for controlled tests.
Cloud selection uses the compiled origin, while local remains the initial mode.
The production-only legacy discovery fallback is not extended to staging.
These controls configure artifacts; they do not establish a deployed backend,
available feed, signed release or auto-update support.

`RemoteSession.bind(origin)` returns an internal account-epoch binding after validated sign-in.
It exposes named model/upload/turn/history operations; no client, token, cookie or arbitrary
URL/header access. Promotion replaces the epoch; logout, origin changes, local expiry and
HTTP 401 abort its requests. A refused candidate preserves the active binding.

The separate `remote-chat.ts` Fetch policy returns SSE immediately: ten seconds to headers,
60 seconds idle, 16 MiB per delivery. JSON is bounded to ten seconds and 4 MiB; auth retains
its existing ten-second/1 MiB policy. Only canonical Cloud permits an instance-404 legacy
catalogue fallback. Self-host requires validated instance metadata and configured registry
pages; auth-free operator mode remains unsupported. Unknown capabilities never imply vision.

Uploads use raw PNG/JPEG/WebP/GIF bytes, signature/MIME checks and an explicit 8 MiB input/
stored-image ceiling. Returned Library IDs remain private to the epoch. Turns validate
50,000 Unicode code points, 20 owned images and explicit low/medium/high reasoning choices.
An admitted image makes the conversation's vision requirement permanent for that epoch.
Fresh follow-ups refuse lost vision; even with vision they remain unavailable while the
pinned backend omits historical pixels. [G2 hydration request](https://github.com/CortexLM/backend/pull/446#issuecomment-5966488098)
tracks this explicit ceiling. Replaying an existing delivery keeps its original attachments.
Successful headers bind conversation and assistant IDs; missing/mismatched headers retain
an ambiguous request. Reconnect repeats the original POST/body/key and acknowledged cursor.
Admission callbacks repeat idempotently on each validated response, before its events, so
consumer failure before accepting the first headers remains recoverable with the same handle.
The current backend collapses Redis sub-sequences into one numeric SSE cursor, so replay can
repeat a previously delivered same-ID frame. Resumed projections must remain explicitly
partial; exact reconstruction awaits a [unique-cursor/history contract](https://github.com/CortexLM/backend/pull/446#issuecomment-5966307621).
Detach closes delivery only; it does not cancel backend generation. One unresolved turn per
binding is the current ceiling. Completion preserves terminal reasons and unfinished media.
SDK 0.3.5 does not expose its parser's discarded-frame callback. Main therefore returns
`projection:"limited"` on every terminal result; core adds a transport-limit marker and
never certifies complete output from this SDK, including clean `stop` responses. The
[G3 callback request](https://github.com/CortexLM/backend/pull/447#issuecomment-5966461570)
is the upgrade gate. Unknown reasoning-token counts, including backend `null`, stay omitted.

History reads only conversations admitted in that epoch: latest 100 active-path messages,
text/attachments only, explicitly limited with reasoning/tools omitted. No account-wide list,
durable identity, refresh or process-restart replay is claimed. Internal remote bus publication
skips SQLite and local plugin callbacks. Core's internal `remoteSessions` validates epoch,
model/effort, session-owned uploads and header-time admission, exposing cloned process-only
views. Identity loss immediately removes them; late results remain invalid. It preserves
plain safety/disclosure text, neutral tool status and explicit unsupported-output markers,
never raw tool results or local execution. Known-history recovery marks unfinished tools
interrupted without inventing a duration. The `/api/remote` routes now have a scoped
Chat renderer caller. Code, Work, Bot and local/project Chat retain local execution.
Remote admission refusal retains the draft. Detach stops delivery, not backend work;
resume reuses the original request, preserving a separately edited next draft.
Historical-image follow-ups remain refused; an explicit new-chat action transfers
the draft/files/one-off choice to a fresh owned record without altering old history.
Drafts are not persisted across arbitrary navigation or process exit.

## Probe

`probe()` returns `not_applicable` for local. For cloud and self-host, desktop main supplies
`probeRemote` (`packages/desktop/src/remote.ts`), which uses the vendored `@cortex/sdk`:

1. `GET {url}/readyz` — not 2xx or unreachable → `unreachable`.
2. `client.instance.list()` — validate instance/auth/registry metadata. Only HTTP 404 permits
   legacy discovery; malformed replies and other errors do not silently fall back.
3. Cloud/legacy: `client.models.list()`, using `slug` and `display_name`. Self-host:
   `client.registry.models.list({query:{configured:true,limit:500,cursor?}})`, consuming every
   page even when registry enrichment is disabled. Missing registry never falls back to
   Cloud's seeded catalog. Model discovery 401/403 → `reachable`, `authRequired: true`.

The entire probe has a five-second deadline, including model response bodies and pagination.
Backend URLs are HTTP(S) origins; credentials, paths, queries and fragments are rejected
before storage/transport. Every probe request pins that origin, refuses redirects and disables
cookie storage. `reachable` means the probe responded, even if model listing requires auth;
it does not establish a usable chat session
or check a backend version range. The returned models are probe metadata only.

Without a host probe (tests, `scripts/dev-api.ts`), core only checks `GET {url}/readyz`:
2xx is `reachable`, non-2xx is `incompatible`, network failure is `unreachable`.
`packages/desktop/test/remote.test.ts` uses a local stub by default. The optional
`CORTEX_TEST_BACKEND_URL` case asserts `reachable`; the recorded
[`evidence/sdk-real-backend.log`](../evidence/sdk-real-backend.log) shows returned model
metadata. Neither proves authentication or real-provider inference.

## In the app

Settings → **Connection** (`#/settings?section=connection`, in `settings.tsx`):

- Local/cloud selection waits for accepted persistence. Cloud does not automatically probe;
  its sign-in button opens the live email-code flow. Starting email sign-in from local mode
  explicitly selects Cloud on submit. A saved self-host origin is retained for its login.
- Selecting self-host reveals a URL field. **Check** validates the HTTP(S) origin, saves the mode and
  URL, then probes it; a failed probe leaves the saved preference in place.
- The self-host badge displays checking / reachable / unreachable / incompatible / invalid.
  The UI does not display the returned remote models or `authRequired` value.
- Successful sign-in states and Account/Connection settings explain the process lifetime and
  continued local prompt routing. Account/Connection offer device sign-out. Refused email/code
  submissions retain input; duplicate submits are guarded; Cancel can interrupt a pending code.
- Third-party sign-in and company SSO remain unavailable. Backend continuation states use the
  existing unavailable presentation; no simulated countdown, attempt count or lockout is used live.

## Active remote integration

Remote authentication, remote model selection and Cortex inference remain an active delivery
goal. The [current SDK handoff readback](../evidence/recovery-followup/remote-integration-readback.md)
preserves the PM report's 15:05 observation and earlier readbacks. In the
**3 October 2026, 00:32 UTC snapshot**, PR #447 remained at `7633f7e2`, before the canonical
package delivery. The later owner handoff supplies SDK **0.3.1** / api-types **0.2.0** at
`ce05a6040ec05ac479d23dc2f701c8835a529663`, with successful upstream CI `37084973406`.
The [desktop admission readback](../evidence/sdk-031-admission/README.md) verifies its exact
archives, peer, schema and source pins. Precise OTP/MFA/local-login/Library contracts are
admitted; dependency intake `4fea24a` passes 44 probe checks plus one optional backend skip. Media-tail loss and feedback screenshot
corruption reproduce in exact 0.3.1. Password/signup/refresh, stable account identity, Cloud
models and history remain incomplete contracts; generated turn bodies are `never`.
These block full remote-product admission, not the bounded verified paths. Earlier SDK 0.3.0
retains its Node 22 regression HOLD. Bounded sign-in integration is separate from those probe
receipts; full authenticated inference remains unproven. Later SDK corrections are under review.
The [next-pair readback](../evidence/sdk-next-readback/README.md) confirms media/screenshot
corrections at 0.3.2 and usable generic turn bodies in the 0.3.3 candidate. The later 0.3.4
owner release is incomplete after a Node 20.9 verification process failed to exit; no
replacement is adopted from that incomplete handoff.
G3 has since delivered immutable SDK 0.3.5 at `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`,
correcting auth response cloning and retaining the consumer fixes. [Exact-package admission](../evidence/sdk-035-admission/README.md)
passes 34 native Node 22 runtime cases, eight unchanged desktop auth cases and the prior
media/upload/turn consumer reproductions. Dependency intake adopts this pair unmodified;
52 probe/main-auth cases pass with one optional real-backend skip. Password/account/history
precision and real authenticated inference remain separate gates.
A separate SDK 0.3.5 discovery call to the real Cloud origin returns three models;
[its receipt](../evidence/sdk-035-admission/integrated/real-probe.log) establishes reachability
only. No account or inference credentials were supplied.
Consumer adoption is `7885736`; [G3 readback](https://github.com/CortexLM/backend/pull/447#issuecomment-5965633627)
records both archive hashes and the real discovery result. New-pair CI `37097480122` and
eight matching installed sign-in/layout captures pass, separately from `ffc118a`'s SDK 0.3.1
evidence. Neither controlled sign-in run establishes a real Cloud account.
At the later [05:35 UTC public readback](../evidence/sdk-035-admission/public-cloud-readback.json),
Cloud's `/v1/instance` returns 404; `/v1/models` returns two reasoning-capable Chat models,
both declaring `supports_vision:false`, and one image-generation card. The earlier probe uses
its 404-only legacy discovery path. A compatible instance deployment and an eligible
vision-capable Chat model are still needed for real image+reasoning acceptance;
[G2 follow-up](https://github.com/CortexLM/backend/pull/446#issuecomment-5966017500) records this boundary.

G3's [source-backed DTO disposition](https://github.com/CortexLM/backend/pull/447#issuecomment-5964672516)
permits narrow validation of existing Cloud model/turn fields, without claiming generated
precision. `/me` has no public stable account ID; Chat history omits reasoning/tool blocks,
caps list/window results and hardcodes `has_more:false`. Complete pagination/replay and durable
cross-login identity need G2 contracts/server work. Current auth remains process-isolated.
The exact canonical DTO/identity/history follow-up is recorded on
[G2 #446](https://github.com/CortexLM/backend/pull/446#issuecomment-5965315833).
The [bounded next-phase contract](../evidence/remote-auth-followup/routing-contract/README.md)
records explicit session-source/account-epoch isolation, ephemeral projection, authenticated
stream policy, original-request replay and local-plugin exclusion. Its standalone assertions
check examples. The later [foundation implementation](../evidence/remote-chat-foundation/README.md)
implements private transport, event isolation and process-only core projections. That
historical increment predates the public routes and current scoped renderer integration
described above; its evidence does not establish acceptance of those later changes.

The [23:23 UTC owner readback](../evidence/text-live-followup/owner-readback/REPORT.md)
records G2's new hardening delivery `5bb7ff550acec822466853c248bd9bcebe8089a6`:
none-mode VNC Origin gating and restricted media-decoder child environments. Its owner
reports schema blob `e971ba48b421eff329e537884aa87eca36340a97` with a VNC-description
change; reconciliation with G3's later screenshot schema remains pending. These are
retained owner claims, not desktop package admission or deployment proof. Desktop keeps
the admitted SDK0.3.5/API-types0.2.0 pair and `c8f6a7f0` schema pin. No discarded-frame
successor, precise account/history contract, historical-image hydration or exact five-state
import permission appears in that readback. Public instance remains404; model metadata
still supplies zero vision-capable Chat models.

The [00:24 UTC successor readback](../evidence/text-live-followup/owner-readback-final/REPORT.md)
independently verifies G2 `de3b9dd19baa4239ad5aba00da19b7955f053f37`, canonical blob
`232505fc45ba2f506fa891383495592ea7f62de4`. All 422 operation shapes/IDs match the admitted
G3 schema; only the VNC-description text differs. Canonical screenshot-schema reconciliation
is therefore resolved, without a desktop data-shape change. The immutable discarded-frame
SDK successor, precise identity/history, historical pixels and deployed compatibility
remain pending. New named G4 web adoption grants do not authorize G1's five desktop states;
the design owner explicitly retains their final named-source import decision.

The append-only design request dated 3 October, “G1 remote Chat admission controls,” requests
named reuse/import authorization for effort `low|medium|high`, detach/reconnect and honest
bounded-history states. Existing local boolean reasoning and Stop controls cannot silently
stand in for remote semantics. The current Platform package is still a separately pinned draft.
The later user direction and request90 reuse map permit existing effort/replay motifs as
design inputs. The design owner completes five narrow Chat/Settings states: stored-thread
model, one-off model, limited history, image-history refusal and continuation ownership.
Active work uses `/root/cortex-ui` and Base UI; retired board approval is not a dependency.
Exact product-import permission and G1's backend/native verification remain separate.

Delivery order:

1. Consume G3's versioned pair with source commit, canonical schema pin, archive hashes and
   targeted runtime receipts. `vendor/` and `packages/desktop/package.json` must agree on both
   packages. G2's five typed auth/upload bodies are already delivered at `d6d46014`; SDK
    regeneration, public `Problem` reconciliation and runtime receipts are G3-owned;
    the corrected 0.3.5 pair is now admitted and adopted.
2. Implement session acquisition and continuations in Electron main. Keep bearer/cookie/pending
   state origin/account-bound; replace the authenticated client on identity changes rather than
   repointing it. Expose validated, sanitized state through schema/protocol/client contracts;
   renderer metadata cannot establish authentication. Local bearer expiry and Cloud refresh
   remain distinct. Integrate approved continuation states with the existing login/Connection UI.
3. Route model discovery, upload, prompts and transcripts through that selected remote session.
   Preserve unknown capabilities and genuinely empty registries. Local `SessionService.prompt`
   currently resolves providers independently of connection mode; the remote path needs explicit
   conversation identity, remote effort and admission semantics rather than changing a base URL.
   Retain drafts/files on refusal. Raw-byte uploads and reconnect use the owner-verified contracts.
4. Prove authentication plus streamed image/reasoning on the actual Cortex remote path, including
   account/origin changes, refusal, expired auth and reconnect without a duplicate turn. Local
   provider inference and discovery probes are separate evidence. Then package the changed
   revision and capture its modified surfaces natively; retain the earlier Mac baselines.

Each application delta needs its own checks. The installed `7885736` evidence remains
separate from the later remote transport/core implementation.

### Contract boundaries

The current backend supports guest Chat, email OTP and self-host `none`/operator auth.
Desktop transport isolates token/cookie state by origin and account. SDK regeneration
remains owner-controlled: admitted 0.3.5 uses screenshot-only successor schema `c8f6a7f0`,
retaining the typed OTP/MFA/email and raw-upload contracts from `d6d46014`.
The admitted 0.3.5 pair powers bounded process-lifetime sign-in. The existing backend turn input
has reasoning effort `low|medium|high`, no disabled value; omission defaults a new conversation
to `medium`, while ordinary follow-ups retain its stored effort.
Cancelling the stream reader does not cancel backend generation. Supported reasoning-off
and cancel-turn behavior has been requested from the contract owner, who confirmed both
are absent at backend `73b934c7`. A remote UI must distinguish detachment from cancellation;
reconnection repeats the same POST/body, Idempotency-Key and Last-Event-ID. Password/MFA
continuation designs are delivered as Platform drafts in the shared design board. The
eight-route, 94-variant receipt and later scoped corrections have separate source pins;
the complete combined candidate is delivered, while whole-page acceptance and approved
integration disposition remain pending. See the
[verified receipt](../evidence/recovery-followup/platform-receipt.json). Its simulated auth,
diagnostic and stream states establish no backend availability. None of these probes proves
the real-account acceptance or remote inference integration.
The [route contract map](../evidence/recovery-followup/platform-contract-map.md) distinguishes
local provider settings from remote operator routing and records untyped remote turn/approval
payloads. The historical draft's automatic attachment removal conflicts with desktop's retained-file
contract. The **20:01–20:07 UTC readback** records double scoped attachment filename/text-retention
confirmation on `b1b9130`, including refusal/recovery; A's collector negative and offline adjudication
remain preserved. Combined candidate `3e99a045` / `45839` reuses those runtime bytes. Source/state
import authorization remains pending. Exact pins, counts and owner-reported package checks:
[scoped design readback](../evidence/recovery-followup/scoped-design-closures.md).

The backend's `none` mode also validates browser Origin headers on mutations. Main-process
SDK requests are origin-pinned server requests without a browser Origin; a separate browser
client must use its operator-configured allowed origin. The renderer still never talks directly
to the backend or bypasses this boundary.
