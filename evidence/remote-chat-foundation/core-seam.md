# Minimal core seam — internal remote Chat

Implement one `RemoteSessionService`; inject the existing main object structurally. Keep local `SessionService` authoritative. This replaces the older routing draft's duplicated core replay ledger and Promise-returning host `turn`.
Readback: `/tmp/opencode/remote-chat-main-implementation.md`; `packages/desktop/src/remote-chat.ts` exports; `remote-session.ts:bind`; current `core/{index,connection,bus,session}.ts`. In-flight Cloud-404 correction stays main-owned; freeze these exported shapes before integration. No runtime execution or compatibility compilation performed here.

## Core-owned boundary: `packages/core/src/remote-sessions.ts`
```ts
type Effort = "low" | "medium" | "high";
type Admission = { conversationID: string; assistantID: string };
type RemoteModel = {
  slug: string; name: string; reasoning: boolean | "unknown";
  vision: boolean | "unknown"; tools: boolean | "unknown";
  contextTokens?: number; outputTokens?: number;
  source: "cloud" | "models.dev" | "cache" | "cache_stale" | "unavailable";
};
type RemoteImage = { body: Blob; filename: string; conversationID?: string };
type RemoteFile = { id: string; filename: string; contentType: string; byteSize: number; conversationID?: string };
type RemoteTurn = { message: string; modelSlug: string; effort?: Effort; attachmentIDs: string[]; conversationID?: string };
type Observer = { admitted(ids: Admission): void; event(event: unknown): void; cursor?(id: string): void };
type HostResult = { admission: Admission; terminal: unknown };
type Delivery = {
  readonly completion: Promise<HostResult>; detach(): void;
  resume(observer: Observer, signal?: AbortSignal): Promise<HostResult>;
};
type HistoryWindow = {
  conversationID: string; title: string; modelSlug: string; items: unknown[];
  limit: 100; limited: true; projection: "text-and-attachments"; reasoningAndTools: "omitted";
};
interface CoreRemoteBinding {
  readonly epoch: string; readonly signal: AbortSignal;
  models(signal?: AbortSignal): Promise<RemoteModel[]>;
  upload(input: RemoteImage, signal?: AbortSignal): Promise<RemoteFile>;
  turn(input: RemoteTurn, observer: Observer, signal?: AbortSignal): Delivery;
  history(conversationID: string, signal?: AbortSignal): Promise<HistoryWindow>;
}
export interface CoreRemoteHost { bind(origin: string): CoreRemoteBinding }
```
These signatures accept `MainRemoteChatBinding`: inputs match, main results narrow `unknown`, core observers accept every main event. Keep methods/callbacks synchronous where shown. No SDK/API-types import, type relocation, casts, generic factory or second production adapter. Main retains catalogue transport/Cloud-404 policy, upload ownership, IDs, keys and replay cursors.

## Small schema change; no fictional local sessions
- `packages/schema/src/index.ts`: add remote-only zod views/inputs, leaving `Session`, `Message`, `Usage`, `SessionCreateInput` and `PromptInput` unchanged. Their required agent/model/numeric usage cannot honestly represent this source.
- `RemoteSessionView`: local `id`, `source:"remote"`, `epoch`, `conversationID?`, title, modelSlug, effort?, process scope, timestamps, delivery state (`ready|admitting|streaming|detached|uncertain|history_required|settled`). No invented provider or agent. `settled` says delivery ended, not success.
- `RemoteMessageView`: local id/sessionID, optional remote message ID, role, text/reasoning parts, safe notices/tool-status markers, optional finish reason and reported usage fields. Omit unknown cost/counts/timing; never apply local `zeroUsage()`. Keep projection-partial reasons explicit; return normalized outcome, never raw `HostResult`.
- Add identifier-only `remote.session.changed` / `remote.session.removed` events `{sessionID,epoch}`. Core snapshots provide content; existing renderer handlers ignore these names. Every publish uses **`bus.publish(type, properties, "remote")`**, after Map mutation. No changes to storage or the completed bus/plugin filtering seam.

## Exact integration points
- `CoreOptions`/`createCore` in `packages/core/src/index.ts`: add `remoteChat?: CoreRemoteHost`; instantiate/return `remoteSessions` beside `connection`; export its class/type. `ConnectionService.remoteOrigin()` reuses existing `origin(this.selection())`, refusing local mode; renderer never supplies origin.
- `packages/desktop/src/main.ts:boot`: create one `const remote = new RemoteSession()`; pass `remoteAuth: remote, remoteChat: remote`. Contextual assignment checks compatibility. Constructing core performs no bind/network request.
- Internal calls: `core.remoteSessions.models()` returns `{epoch,models}`; `create({epoch,modelSlug,effort?})`, `upload(id,{body,filename})`, `prompt(id,{message,attachmentIDs})`, `resume(id)`, `detach(id)`, `history(id)`, `get/list/messages`, `close()`. Create verifies the supplied epoch against the active binding. Conversation IDs and locked follow-up choices come from the stored view, never caller overrides.
- `createCore.close()`: synchronously close remote service before awaiting shutdown/storage close; existing auth clear remains. No `SessionService`, protocol/server/client or renderer activation in this phase. Existing IDs, Code/Bot/routine calls remain local regardless of connection mode.

## Admission, lifecycle and projection
- Use process-only Maps for records, files and backend-to-local aliases. Capture binding+epoch, subscribe to its abort signal before awaits, recheck already-aborted state, allocate local IDs with `newId`. Reserve **one unresolved turn across the binding** before prompt preparation awaits; standalone uploads stay epoch/session-owned. Main has this ceiling, not per-conversation parallelism.
- Validate strict core input, selected capability/effort and returned narrow fields with zod; use main's bounded Blob upload, retaining acknowledged file IDs. No arbitrary URL fetching, new local tools, permissions or plugin hooks.
- `prompt` returns `Promise<{messageID:string; done:Promise<RemoteOutcome>}>`. Create the deferred admission and private provisional user/assistant records before calling `turn`; catch synchronous refusal, attach both completion handlers immediately. Expose messages/emit change and resolve admission only inside validated, current-epoch `admitted`. `done` settles to a normalized outcome with delivery state, optional finish/error code and partial flag.
- Resolve `messageID` with the **local user ID**; header `assistantID` maps only to the assistant. Pre-admission rejection/detach/epoch loss rejects the deferred and retains caller draft/files; post-admission failure changes transcript state. Snapshot getters return clones.
- Keep the original `Delivery`. `resume()` uses its returned promise, not its old `.completion`; provide a new admission waiter only if still unadmitted. Serialize attempts, suppress older-attempt settlements. Never call `turn` or upload again as retry; no copied key/body/path/cursor ledger. Equal SSE IDs may contain distinct frames: do not deduplicate by cursor alone.
- Observer callbacks validate the entire projected event and admitted IDs synchronously before mutation; no async observer. Parse only needed text/reasoning deltas, duration, usage, done and normalized error fields; finite nonnegative counts, bounded strings, dropped extra keys. Invalid shapes fail the attempt. Usage is reported snapshot data, not added repeatedly on replay; absent reasoning/cost stays unknown.
- Preserve bounded disclosure/safety notice semantics and ordering in safe notice records. Tool start/end become remote status markers; strip labels/error_detail and never serialize raw `tool_result.payload`, permission prompts or terminal metadata. Unsupported structured/media/action output sets a typed partial/blocking marker; no silent successful full-projection claim or local action.
- `done` is provisional until main completion resolves: image tails can still fail. Validate result admission/terminal again; preserve `stop|length|tool_calls|interrupted|error`, never default unknown finish to success. Only confirmed `stop` supports success with partial state explicit. Error `recovery:"history"` becomes `history_required`, never fresh resend. Use existing `ErrorCode` values/neutral developer messages; no new product copy.
- Binding abort/`close()` immediately rejects admission, aborts service operations/detaches readers, clears all owned maps/listeners, then emits remote removals. Every await/callback checks captured epoch and record identity; late work cannot recreate content. Pending/refused replacement preserves the old binding; successful replacement removes it.
- `history` only uses admitted IDs. Validate and retain `limit:100,limited:true,projection:"text-and-attachments",reasoningAndTools:"omitted"`; maintain a separate recovery window, preserving richer live parts. Preserve original roles and attachment metadata; no invented image URL or system/tool-to-assistant conversion. No account import/completeness claim or guessed user-ID match by text/order. Matching admitted assistant finish can settle recovery; completion time/usage remain unknown.

## One host gap, bounded proof, activation gate
- **No failure-disposition field exists:** private `Refused` can release main's ledger, but public codes do not uniquely expose that fact. After asynchronous pre-admission failure, core conservatively marks `uncertain` and forbids fresh-key retry. Before usable fresh-send recovery, main must expose a tiny typed reservation/disposition result; never inspect exception names/messages or probe by creating another turn. Known history may recover only an admitted conversation.
- One focused `packages/core/test/remote-sessions.test.ts`: controlled structural host; admission/local-user-ID ordering, equal-ID deltas, truncated/error/partial completion, detach/resume same handle, immutable draft/file inputs, known-only history, immediate epoch/close removal, late-callback suppression. Assert SQLite event/session/message/part counts and local provider/tool/plugin calls unchanged; preserve ordinary local calls. Add a desktop compile-time assignment to the actual main object when integrating.
- Internal service/projection tests can ship now. Public routes/remote UI require named design permission for effort, detach/resume, limited/partial history and unsupported states, plus source-aware renderer reset/recovery. Current `useMessages` ignores deletion and can overwrite live state with late reads. Main's reported 19 cases prove neither this core service nor Cloud integration; no tests were run for this plan.
