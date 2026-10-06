// Main-only, process-lifetime Chat. These narrow consumer contracts are not canonical backend DTOs.
import { randomUUID } from "node:crypto";
import { PRODUCTION_CLOUD_URL, CortexError } from "@cortex/core";
import type { CortexClient } from "@cortex/sdk";
import { isId, type StreamEvent } from "@cortex/api-types";
import { z } from "zod";

const Name = z.string().trim().min(1).max(1024);
const Count = z.number().int().nonnegative().safe();
const ConversationID = z.string().refine((v): boolean => isId("cnv", v));
const MessageID = z.string().refine((v): boolean => isId("msg", v));
const FileID = z.string().refine((v): boolean => isId("lbf", v));
const Effort = z.enum(["low", "medium", "high"]);
const Finish = z.enum(["stop", "length", "tool_calls", "interrupted", "error"]);
const ImageType = z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const IMAGE_BYTES = 8 * 1024 * 1024;
const Instance = z.object({
  mode: z.enum(["cloud", "self_host"]),
  auth: z.object({ mode: z.enum(["cortex", "local", "none"]), required: z.boolean() }),
}).refine((i) => i.auth.required === (i.auth.mode !== "none") && (i.mode !== "cloud" || i.auth.mode === "cortex"));
const CloudPage = z.object({
  items: z.array(z.object({
    slug: Name, display_name: Name, description: z.string(), context_tokens: Count, max_output_tokens: Count,
    supports_reasoning: z.boolean(), supports_tools: z.boolean(), supports_vision: z.boolean(),
    kind: z.enum(["chat", "image"]).optional(),
  })).max(10000),
  has_more: z.literal(false),
});
const RegistryPage = z.object({
  items: z.array(z.object({
    id: Name, name: Name, configured: z.literal(true),
    capabilities: z.object({ reasoning: z.boolean(), image: z.boolean(), tools: z.boolean(), context_tokens: Count, output_tokens: Count }),
  })).max(500),
  has_more: z.boolean(), next_cursor: Name.optional(),
  source: z.enum(["models.dev", "cache", "cache_stale", "unavailable"]),
});
const ImageInput = z.object({ body: z.instanceof(Blob).refine((b) => b.size > 0 && b.size <= IMAGE_BYTES), filename: Name, conversationID: ConversationID.optional() }).strict();
const Uploaded = z.object({
  id: FileID, filename: Name, content_type: ImageType, byte_size: Count.positive().max(IMAGE_BYTES),
  access: z.literal("owner"), kind: z.literal("image"), source: z.literal("upload"),
  conversation_id: ConversationID.optional(), project_id: z.never().optional(),
});
const TurnInput = z.object({
  message: z.string().max(100000).trim().refine((v) => [...v].length <= 50000),
  modelSlug: Name, effort: Effort.optional(), attachmentIDs: z.array(FileID).max(20), conversationID: ConversationID.optional(),
  oneOffModelSlug: Name.optional(),
}).strict().refine((v) => !!v.message || v.attachmentIDs.length > 0)
  .refine((v) => new Set(v.attachmentIDs).size === v.attachmentIDs.length);
const Admission = z.object({ conversationID: ConversationID, assistantID: MessageID });
const HistoryMessage = z.object({
  id: MessageID, role: z.enum(["user", "assistant", "system", "tool"]), text: z.string(), created_at: z.iso.datetime({ offset: true }),
  version_index: Count, version_count: Count.positive(), is_active_version: z.literal(true),
  finish_reason: Finish.optional(), model_name: Name.optional(),
  attachments: z.array(z.object({ file_id: FileID, filename: Name, content_type: Name, byte_size: Count })).max(20).optional(),
});
const HistoryPage = z.object({ items: z.array(HistoryMessage).max(100), has_more: z.literal(false) })
  .refine((p) => new Set(p.items.map((m) => m.id)).size === p.items.length);
const Detail = z.object({ id: ConversationID, title: z.string(), model_slug: Name, message_count: Count });

export type MainRemoteModel = {
  slug: string; name: string; reasoning: boolean | "unknown"; vision: boolean | "unknown"; tools: boolean | "unknown";
  contextTokens?: number; outputTokens?: number; source: "cloud" | z.infer<typeof RegistryPage>["source"];
};
export type MainRemoteImage = z.infer<typeof ImageInput>;
export type MainRemoteFile = { id: string; filename: string; contentType: string; byteSize: number; conversationID?: string };
export type MainRemoteTurn = z.infer<typeof TurnInput>;
export type MainRemoteAdmission = z.infer<typeof Admission>;
export type MainRemoteEvent =
  | Exclude<StreamEvent, { type: "error" }>
  | { type: "error"; code: "provider_error" | "provider_auth_failed" | "provider_rate_limited"; recovery: "history" | "none" };
export type MainRemoteObserver = {
  /** Idempotent header admission on each delivery attempt, before its events. */
  admitted(ids: MainRemoteAdmission): void;
  event(event: MainRemoteEvent): void;
  cursor?(id: string): void;
};
export type MainRemoteResult = { admission: MainRemoteAdmission; terminal: Extract<MainRemoteEvent, { type: "done" | "error" }>; projection: "limited" };
export type MainRemoteDelivery = {
  /** Recovery disposition, not success: validated IDs win; refused releases pre-admission retry. Check epoch first. */
  readonly admissionState: "pending" | "refused" | "uncertain" | "admitted";
  readonly completion: Promise<MainRemoteResult>;
  /** Detaches delivery only; generation continues on the backend. */
  detach(): void;
  /** Same private path, body, idempotency key and acknowledged cursor. */
  resume(observer: MainRemoteObserver, signal?: AbortSignal): Promise<MainRemoteResult>;
};
export type MainRemoteHistory = {
  conversationID: string; title: string; modelSlug: string; items: z.infer<typeof HistoryMessage>[];
  limit: 100; limited: true; projection: "text-and-attachments"; reasoningAndTools: "omitted";
};
export interface MainRemoteChatBinding {
  readonly epoch: string;
  readonly signal: AbortSignal;
  models(signal?: AbortSignal): Promise<MainRemoteModel[]>;
  upload(input: MainRemoteImage, signal?: AbortSignal): Promise<MainRemoteFile>;
  turn(input: MainRemoteTurn, observer: MainRemoteObserver, signal?: AbortSignal): MainRemoteDelivery;
  history(conversationID: string, signal?: AbortSignal): Promise<MainRemoteHistory>;
}

const failed = () => new CortexError("provider_error", "Could not complete the remote request");
// A definitive pre-admission refusal can release a draft; a transport failure cannot.
class Refused extends CortexError {}
class InstanceNotFound extends Refused {}
const aborted = () => new CortexError("aborted", "Remote delivery was detached");
const invalid = () => new CortexError("invalid_request", "Invalid remote request");
const neutral = (error: unknown) => error instanceof CortexError ? error : failed();
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalid();
  return parsed.data;
}

/** Private SDK Fetch policy. Only named Chat operations reach this path; auth keeps its existing policy. */
export async function remoteChatFetch(request: Request, owner: {
  origin: string; fetch: typeof fetch; signal: AbortSignal; check(): void; unauthorized(): void;
}): Promise<Response> {
  owner.check();
  const url = new URL(request.url);
  const stream = request.method === "POST" && /^\/v1\/conversations(?:\/cnv_[\da-zA-Z]{26})?\/turns$/.test(url.pathname);
  const json = (request.method === "GET" && (/^\/v1\/(?:instance|models|registry\/models)$/.test(url.pathname)
    || /^\/v1\/conversations\/cnv_[\da-zA-Z]{26}(?:\/messages)?$/.test(url.pathname)))
    || (request.method === "POST" && url.pathname === "/v1/library");
  if (url.origin !== owner.origin || (!stream && !json)) throw invalid();
  const lifetime = new AbortController();
  const signal = AbortSignal.any([request.signal, owner.signal, lifetime.signal]);
  let timer: ReturnType<typeof setTimeout>;
  const deadline = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => lifetime.abort(failed()), ms);
    timer.unref();
  };
  deadline(10000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let ended = false;
  const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", stop); };
  let reject!: (reason: unknown) => void;
  const stopped = new Promise<never>((_resolve, no) => { reject = no; });
  // A late custom Fetch/body must settle even when it ignores its AbortSignal.
  const stop = () => {
    const error = signal.reason instanceof CortexError ? signal.reason : aborted();
    reject(error);
    void reader?.cancel().catch(() => undefined);
    if (controller && !ended) { ended = true; controller.error(error); cleanup(); }
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  try {
    response = await Promise.race([stopped, owner.fetch(new Request(request, { redirect: "error", credentials: "omit", signal })).then((res) => {
      if (signal.aborted) { void res.body?.cancel().catch(() => undefined); throw aborted(); }
      return res;
    })]);
    owner.check();
    if (response.redirected || (response.url && new URL(response.url).origin !== owner.origin)) {
      void response.body?.cancel().catch(() => undefined);
      throw failed();
    }
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => undefined);
      if (response.status === 401) { owner.unauthorized(); throw new CortexError("provider_auth_failed", "Remote sign-in is required"); }
      if (response.status === 403) throw new Refused("provider_error", "Remote access was not accepted");
      if (response.status === 429) throw new Refused("provider_rate_limited", "Too many remote requests");
      if (response.status === 404 && request.method === "GET" && url.pathname === "/v1/instance")
        throw new InstanceNotFound("invalid_request", "The remote instance is not available");
      if ([400, 404, 413, 415, 422].includes(response.status)) throw new Refused("invalid_request", "The remote request was not accepted");
      throw failed();
    }
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim();
    if (!response.body || contentType !== (stream ? "text/event-stream" : "application/json")) {
      void response.body?.cancel().catch(() => undefined);
      throw failed();
    }
    reader = response.body.getReader();
    let bytes = 0;
    const read = async () => {
      const chunk = await Promise.race([reader!.read(), stopped]);
      owner.check();
      if (signal.aborted) throw neutral(signal.reason);
      bytes += chunk.value?.byteLength ?? 0;
      // ponytail: 4 MiB JSON / 16 MiB per stream connection; larger transcripts need a paginated contract.
      if (bytes > (stream ? 16 : 4) * 1024 * 1024) throw failed();
      return chunk;
    };
    if (!stream) {
      const chunks: Uint8Array[] = [];
      for (;;) { const chunk = await read(); if (chunk.done) break; chunks.push(chunk.value); }
      cleanup();
      return new Response(Buffer.concat(chunks), { status: 200, headers: response.headers });
    }
    // Header deadline ends here. Each native read gets an idle bound, never a whole-turn auth deadline.
    deadline(60000);
    return new Response(new ReadableStream<Uint8Array>({
      start(ctrl) { controller = ctrl; },
      async pull(ctrl) {
        try {
          const chunk = await read();
          if (ended) return;
          if (chunk.done) { ended = true; cleanup(); ctrl.close(); }
          else { deadline(60000); ctrl.enqueue(chunk.value); }
        } catch (error) {
          if (!ended) { ended = true; ctrl.error(neutral(error)); }
          cleanup();
          void reader?.cancel().catch(() => undefined);
        }
      },
      cancel() { ended = true; cleanup(); lifetime.abort(aborted()); void reader?.cancel().catch(() => undefined); },
    }), { status: 200, headers: response.headers });
  } catch (error) {
    cleanup();
    void reader?.cancel().catch(() => undefined);
    if (!reader) void response?.body?.cancel().catch(() => undefined);
    throw neutral(error);
  }
}

/** Called only by RemoteSession after successful promotion; no client, token or Fetch escapes. */
export function createRemoteChatBinding(client: CortexClient, origin: string, epoch: string, signal: AbortSignal, check: () => void): MainRemoteChatBinding {
  let catalog: Map<string, MainRemoteModel> | undefined;
  let catalogRead = 0;
  const files = new Map<string, MainRemoteFile>();
  const conversations = new Map<string, { modelSlug: string; effort?: z.infer<typeof Effort>; needsVision: boolean }>();
  type Ledger = {
    input: MainRemoteTurn; key: string; admission?: MainRemoteAdmission; cursor?: string;
    terminal?: MainRemoteResult["terminal"]; pendingImages: Set<string>; running: boolean; closed: boolean;
    requested: boolean; delivery: AbortController;
  };
  let current: Ledger | undefined;
  const guard = (operation?: AbortSignal) => {
    check();
    if (signal.aborted || operation?.aborted) {
      const reason: unknown = signal.aborted ? signal.reason : operation?.reason;
      throw reason instanceof CortexError ? reason : aborted();
    }
  };
  const run = async <T>(work: (s: AbortSignal) => Promise<T>, operation?: AbortSignal): Promise<T> => {
    try {
      guard(operation);
      const value = await work(AbortSignal.any([signal, ...(operation ? [operation] : [])]));
      guard(operation);
      return value;
    } catch (error) { guard(operation); throw neutral(error); }
  };
  signal.addEventListener("abort", () => { catalog = undefined; files.clear(); conversations.clear(); current = undefined; }, { once: true });
  const known = (id: string) => { if (!conversations.has(id)) throw invalid(); };
  const models = (operation?: AbortSignal) => run(async (s) => {
    const read = ++catalogRead;
    catalog = undefined;
    let instance: z.infer<typeof Instance> | undefined;
    try { instance = Instance.parse(await client.instance.list({ signal: s })); }
    catch (error) {
      // Only the canonical Cloud origin has an admitted legacy deployment without instance discovery.
      if (origin !== PRODUCTION_CLOUD_URL || !(error instanceof InstanceNotFound)) throw error;
    }
    guard(s);
    if (instance?.auth.mode === "none") throw new CortexError("provider_unsupported", "Remote operator mode is not available");
    const list: MainRemoteModel[] = [];
    if (!instance || instance.mode === "cloud") {
      const page = CloudPage.parse(await client.models.list({ signal: s }));
      for (const m of page.items.filter((m) => m.kind === "chat")) list.push({
        slug: m.slug, name: m.display_name, reasoning: m.supports_reasoning, vision: m.supports_vision, tools: m.supports_tools,
        contextTokens: m.context_tokens || undefined, outputTokens: m.max_output_tokens || undefined, source: "cloud",
      });
    } else {
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (;;) {
        guard(s);
        const page = RegistryPage.parse(await client.registry.models.list({ query: { configured: true, limit: 500, cursor }, signal: s }));
        for (const m of page.items) {
          const c = m.capabilities;
          const unknown = !c.reasoning && !c.image && !c.tools && !c.context_tokens && !c.output_tokens;
          list.push({ slug: m.id, name: m.name, reasoning: unknown ? "unknown" : c.reasoning, vision: unknown ? "unknown" : c.image,
            tools: unknown ? "unknown" : c.tools, contextTokens: c.context_tokens || undefined, outputTokens: c.output_tokens || undefined, source: page.source });
        }
        if (!page.has_more) break;
        if (!page.next_cursor || cursors.has(page.next_cursor) || cursors.size >= 19) throw failed();
        cursor = page.next_cursor; cursors.add(cursor);
      }
    }
    guard(s);
    if (read !== catalogRead) throw aborted();
    if (new Set(list.map((m) => m.slug)).size !== list.length) throw failed();
    catalog = new Map(list.map((m) => [m.slug, m]));
    return structuredClone(list);
  }, operation);

  const execute = (ledger: Ledger, observer: MainRemoteObserver, operation?: AbortSignal): Promise<MainRemoteResult> => run(async (s) => {
    if (ledger.running || ledger.closed || (ledger.terminal && ledger.requested)) throw new CortexError("conflict", "Remote delivery cannot be resumed");
    ledger.running = true;
    ledger.delivery = new AbortController();
    const delivery = AbortSignal.any([s, ledger.delivery.signal]);
    try {
      if (!ledger.requested) {
        if (!catalog) await models(delivery);
        guard(delivery);
        const model = catalog?.get(ledger.input.modelSlug);
        if (!model) throw new CortexError("model_not_found", "The remote model is not available");
        const effective = catalog?.get(ledger.input.oneOffModelSlug ?? ledger.input.modelSlug);
        if (!effective) throw new CortexError("model_not_found", "The remote model is not available");
        const historyImages = !!ledger.input.conversationID && conversations.get(ledger.input.conversationID)?.needsVision;
        if ((ledger.input.attachmentIDs.length || historyImages) && effective.vision !== true) throw new CortexError("model_no_image_input", "The remote model cannot accept images");
        // ponytail: pinned backend omits historical pixels; allow follow-ups after verified image hydration.
        if (historyImages) throw new CortexError("provider_unsupported", "Remote image history is not available");
        if ((model.reasoning === true) !== (ledger.input.effort !== undefined)) throw invalid();
      }
      ledger.requested = true;
      const body = { message: ledger.input.message, model_slug: ledger.input.modelSlug, reasoning_effort: ledger.input.effort, attachment_ids: [...ledger.input.attachmentIDs],
        ...(ledger.input.oneOffModelSlug ? { one_off_model_slug: ledger.input.oneOffModelSlug } : {}) };
      for await (const event of client.streamTurn({ conversationId: ledger.input.conversationID, body, idempotencyKey: ledger.key }, {
        signal: delivery, maxReconnects: 0, lastEventId: ledger.cursor,
        onResponse(response) {
          try {
            guard(delivery);
            const ids = Admission.parse({ conversationID: response.headers.get("x-conversation-id"), assistantID: response.headers.get("x-message-id") });
            if ((ledger.input.conversationID && ledger.input.conversationID !== ids.conversationID)
              || (!ledger.input.conversationID && !ledger.admission && conversations.has(ids.conversationID))
              || (ledger.admission && (ledger.admission.conversationID !== ids.conversationID || ledger.admission.assistantID !== ids.assistantID))) throw failed();
            ledger.admission = ids;
            conversations.set(ids.conversationID, { modelSlug: ledger.input.modelSlug, effort: ledger.input.effort,
              needsVision: !!conversations.get(ids.conversationID)?.needsVision || ledger.input.attachmentIDs.length > 0 });
            observer.admitted({ ...ids });
          } catch {
            ledger.delivery.abort(failed());
            void response.body?.cancel().catch(() => undefined);
            throw failed();
          }
        },
        onEventId(id) {
          try {
            guard(delivery);
            // SDK 0.4.0 resumes only from complete Redis stream IDs (ms-seq, each u64).
            if (!/^(0|[1-9]\d{0,19})-(0|[1-9]\d{0,19})$/.test(id) || id.split("-").some((part) => BigInt(part) > 18446744073709551615n)) throw failed();
            observer.cursor?.(id);
            guard(delivery);
            ledger.cursor = id;
          } catch (error) { ledger.delivery.abort(neutral(error)); throw neutral(error); }
        },
      })) {
        guard(delivery);
        if (!ledger.admission || ("message_id" in event && event.message_id !== ledger.admission.assistantID)
          || ("conversation_id" in event && event.conversation_id !== ledger.admission.conversationID)) throw failed();
        if (event.type === "image_generation") {
          if (event.status === "queued" || event.status === "generating") ledger.pendingImages.add(event.generation_id);
          else ledger.pendingImages.delete(event.generation_id);
        }
        const safe: MainRemoteEvent = event.type === "error" ? {
          type: "error", code: event.code === "unauthenticated" ? "provider_auth_failed" : event.code === "rate_limited" ? "provider_rate_limited" : "provider_error",
          recovery: event.code === "stream_expired" ? "history" : "none",
        } : structuredClone(event);
        observer.event(structuredClone(safe));
        guard(delivery);
        if (safe.type === "done" || safe.type === "error") ledger.terminal = safe;
        if (safe.type === "error") ledger.pendingImages.clear();
      }
      guard(delivery);
      if (!ledger.admission || !ledger.terminal || ledger.pendingImages.size) throw failed();
      if (ledger.terminal.type !== "error" || ledger.terminal.recovery !== "history") { ledger.closed = true; if (current === ledger) current = undefined; }
      // ponytail: SDK 0.3.5 hides discarded frames; full projection requires its discard callback.
      return { admission: { ...ledger.admission }, terminal: structuredClone(ledger.terminal), projection: "limited" };
    } catch (error) {
      // Before a request, releasing a reservation cannot duplicate an admitted turn.
      if (!ledger.requested || (!ledger.admission && error instanceof Refused)) { ledger.closed = true; if (current === ledger) current = undefined; }
      if (delivery.aborted) guard(delivery);
      throw error;
    } finally { ledger.running = false; }
  }, operation);

  return Object.freeze({
    epoch, signal, models,
    upload: (value: MainRemoteImage, operation?: AbortSignal) => run(async (s) => {
      const i = input(ImageInput, value);
      if (i.conversationID) known(i.conversationID);
      const type = input(ImageType, i.body.type);
      const header = new Uint8Array(await i.body.slice(0, 12).arrayBuffer());
      guard(s);
      const text = Buffer.from(header).toString("latin1");
      const matches = type === "image/png" ? Buffer.from(header.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === "image/jpeg" ? header[0] === 255 && header[1] === 216 && header[2] === 255
          : type === "image/gif" ? /^(GIF87a|GIF89a)/.test(text) : text.startsWith("RIFF") && text.slice(8) === "WEBP";
      if (!matches) throw invalid();
      if (!catalog) await models(s);
      guard(s);
      const file = Uploaded.parse(await client.library.create({ body: i.body, query: { filename: i.filename, conversation_id: i.conversationID }, signal: s }));
      guard(s);
      if (file.conversation_id !== i.conversationID) throw failed();
      const result: MainRemoteFile = { id: file.id, filename: file.filename, contentType: file.content_type, byteSize: file.byte_size, conversationID: file.conversation_id };
      files.set(file.id, result);
      return { ...result };
    }, operation),
    turn(value: MainRemoteTurn, observer: MainRemoteObserver, operation?: AbortSignal): MainRemoteDelivery {
      guard(operation);
      const i = input(TurnInput, value);
      if (current) throw new CortexError("conflict", "A remote turn needs completion or history recovery");
      if (i.conversationID) {
        known(i.conversationID);
        const stored = conversations.get(i.conversationID)!;
        if (stored.modelSlug !== i.modelSlug || stored.effort !== i.effort) throw invalid();
      }
      for (const id of i.attachmentIDs) {
        const file = files.get(id);
        if (!file || (file.conversationID && file.conversationID !== i.conversationID)) throw invalid();
      }
      // ponytail: one unresolved turn per binding; per-conversation parallelism belongs in the future core adapter.
      const ledger: Ledger = { input: i, key: randomUUID(), pendingImages: new Set(), running: false, closed: false, requested: false, delivery: new AbortController() };
      current = ledger;
      return Object.freeze({
        get admissionState(): MainRemoteDelivery["admissionState"] {
          return ledger.admission ? "admitted" : ledger.closed ? "refused" : ledger.running ? "pending" : "uncertain";
        },
        completion: execute(ledger, observer, operation), detach: () => ledger.delivery.abort(aborted()),
        resume: (next: MainRemoteObserver, nextSignal?: AbortSignal) => execute(ledger, next, nextSignal) });
    },
    history: (value: string, operation?: AbortSignal) => run(async (s): Promise<MainRemoteHistory> => {
      const id = input(ConversationID, value); known(id);
      const detail = Detail.parse(await client.conversations.get({ path: { id }, signal: s }));
      guard(s);
      // The precise generated query is absent; the pinned handler defaults to the latest 100.
      const page = HistoryPage.parse(await client.conversations.messages.list({ path: { id }, signal: s }));
      guard(s);
      if (detail.id !== id || detail.model_slug !== conversations.get(id)?.modelSlug) throw failed();
      if (current && !current.running && current.admission?.conversationID === id
        && page.items.some((m) => m.role === "assistant" && m.id === current?.admission?.assistantID && m.finish_reason !== undefined)) {
        current.closed = true; current = undefined;
      }
      return { conversationID: id, title: detail.title, modelSlug: detail.model_slug, items: page.items,
        limit: 100, limited: true, projection: "text-and-attachments", reasoningAndTools: "omitted" };
    }, operation),
  });
}
