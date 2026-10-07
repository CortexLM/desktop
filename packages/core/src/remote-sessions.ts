import { z } from "zod"
import {
  ErrorCode, newId, RemoteEpoch, RemoteFile, RemoteFinish, RemoteHistoryWindow, RemoteMessageView,
  RemoteModel, RemoteNoticeText, RemotePart, RemotePromptInput, RemoteSessionCreateInput, RemoteUploadInput, RemoteTerminalOutcome, RemoteTerminationReason,
  RemoteSessionView, type RemoteOutcome,
} from "@cortex/schema"
import type { Bus } from "./bus"
import type { ConnectionService } from "./connection"
import { CortexError } from "./error"
import type { Storage } from "./storage"

type Admission = { conversationID: string; assistantID: string }
type Observer = { admitted(ids: Admission): void; event(event: unknown): void; cursor?(id: string): void }
type HostResult = { admission: Admission; terminal: unknown; projection?: "limited" }
type HostFile = { id: string; filename: string; contentType: string; byteSize: number; conversationID?: string }
type HostTurn = { message: string; modelSlug: string; oneOffModelSlug?: string; effort?: "low" | "medium" | "high"; attachmentIDs: string[]; conversationID?: string }
export type CoreRemoteDelivery = {
  readonly admissionState: "pending" | "refused" | "uncertain" | "admitted"
  readonly completion: Promise<HostResult>
  detach(): void
  resume(observer: Observer, signal?: AbortSignal): Promise<HostResult>
}
export interface CoreRemoteBinding {
  readonly accountID?: string
  readonly epoch: string
  readonly signal: AbortSignal
  discover?(signal?: AbortSignal): Promise<{ conversationID: string; title: string; modelSlug: string }[]>
  models(signal?: AbortSignal): Promise<RemoteModel[]>
  upload(input: { body: Blob; filename: string; conversationID?: string }, signal?: AbortSignal): Promise<HostFile>
  turn(input: HostTurn, observer: Observer, signal?: AbortSignal): CoreRemoteDelivery
  history(conversationID: string, signal?: AbortSignal): Promise<{
    conversationID: string; title: string; modelSlug: string; items: unknown[]
    limit: 200; limited: false; projection: "retained-parts"; reasoningAndTools: "retained"
  }>
}
export interface CoreRemoteHost { bind(origin: string): CoreRemoteBinding }

const ID = z.string().min(1).max(256)
const AdmissionSchema = z.object({ conversationID: RemoteHistoryWindow.shape.conversationID, assistantID: RemoteMessageView.shape.remoteID.unwrap() })
const Count = z.number().int().nonnegative().safe()
const Duration = z.number().finite().nonnegative()
const Text = z.string().max(16 * 1024 * 1024)
const Upload = z.object({ body: z.instanceof(Blob).refine((b) => b.size > 0 && b.size <= 8 * 1024 * 1024), filename: RemoteFile.shape.filename, oneOffModelSlug: RemoteUploadInput.shape.oneOffModelSlug }).strict()
const Envelope = z.object({ type: z.string().min(1).max(100), message_id: AdmissionSchema.shape.assistantID.optional(), conversation_id: AdmissionSchema.shape.conversationID.optional() })
const Terminal = z.discriminatedUnion("type", [
  z.object({ type: z.literal("done"), message_id: AdmissionSchema.shape.assistantID, finish_reason: RemoteFinish, outcome: RemoteTerminalOutcome.optional(), termination_reason: RemoteTerminationReason.optional() }),
  z.object({ type: z.literal("error"), code: z.enum(["provider_error", "provider_auth_failed", "provider_rate_limited"]), recovery: z.enum(["history", "none"]) }),
])
const Tool = RemotePart.options[5]
const problem = (code: z.infer<typeof ErrorCode> = "provider_error") => new CortexError(code, "Could not complete the remote request")
const neutral = (error: unknown) => problem(error instanceof CortexError && ErrorCode.safeParse(error.code).success ? error.code : "provider_error")
function parse<T>(schema: z.ZodType<T>, value: unknown, code: z.infer<typeof ErrorCode> = "provider_error"): T {
  const result = schema.safeParse(value)
  if (!result.success) throw problem(code)
  return result.data
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
type Owner = { binding: CoreRemoteBinding; origin: string; controller: AbortController; off(): void; catalog?: Map<string, RemoteModel>; catalogRead: number; discovered?: boolean }
type RecordState = { owner: Owner; view: RemoteSessionView; messages: RemoteMessageView[]; files: Map<string, { file: RemoteFile; body: Blob; filename: string }>; uploads: number; historyRead: number; turn?: Turn }
type Accepted = { messageID: string; done: Promise<RemoteOutcome> }
type Attempt = { controller: AbortController; active: boolean; wireSettled: boolean; admission: ReturnType<typeof deferred<Accepted>>; done: ReturnType<typeof deferred<RemoteOutcome>> }
type Turn = { record: RecordState; input: HostTurn; user: RemoteMessageView; assistant: RemoteMessageView; delivery?: CoreRemoteDelivery; ids?: Admission; terminal?: z.infer<typeof Terminal>; attempt?: Attempt; characters: number; reset?: boolean }

/** Owner-scoped remote projections; durable snapshots use the existing doc table, never local execution events. */
export class RemoteSessionService {
  private owner?: Owner
  private records = new Map<string, RecordState>()
  private pending?: Turn
  private closed = false
  constructor(private bus: Bus, private connection: ConnectionService, private host?: CoreRemoteHost, private storage?: Storage) {}

  private binding(): Owner {
    if (this.closed) throw problem("aborted")
    try {
      const origin = this.connection.remoteOrigin()
      if (!this.host) throw problem("provider_unsupported")
      const binding = this.host.bind(origin)
      parse(RemoteEpoch, binding.epoch)
      if (binding.signal.aborted) throw problem("aborted")
      if (this.owner?.binding === binding && this.owner.origin === origin) return this.owner
      this.clear()
      const owner: Owner = { binding, origin, controller: new AbortController(), off: () => {}, catalogRead: 0 }
      const abort = () => { if (this.owner === owner) this.clear() }
      owner.off = () => binding.signal.removeEventListener("abort", abort)
      this.owner = owner
      if (binding.accountID && this.storage) {
        const parent = JSON.stringify([origin, binding.accountID])
        for (const value of this.storage.listDocs<{ view: RemoteSessionView; messages: RemoteMessageView[] }>("remote-record", parent)) {
          const view = parse(RemoteSessionView, value.view), messages = parse(z.array(RemoteMessageView), value.messages)
          view.epoch = binding.epoch
          if (["streaming", "detached", "admitting", "uncertain"].includes(view.state)) {
            view.state = "history_required"
            view.outcome = { state: "history_required", complete: false, partial: true }
            for (const message of messages) if (message.role === "assistant") message.partial = true
          }
          this.records.set(view.id, { owner, view, messages, files: new Map(), uploads: 0, historyRead: 0 })
        }
      }
      binding.signal.addEventListener("abort", abort, { once: true })
      if (binding.signal.aborted) { this.clear(); throw problem("aborted") }
      return owner
    } catch (error) { this.clear(); throw neutral(error) }
  }

  private guard(owner: Owner, record?: RecordState) {
    if (this.owner !== owner || owner.controller.signal.aborted || (record && this.records.get(record.view.id) !== record) || this.binding() !== owner) throw problem("aborted")
  }

  private record(id: string) {
    parse(ID, id, "invalid_request")
    const owner = this.binding(), record = this.records.get(id)
    if (!record || record.owner !== owner) throw problem("not_found")
    return record
  }

  // Streamed deltas publish only; durable transitions (admission, terminal, detach, create, discover) persist the snapshot.
  private changed(record: RecordState, persist = true) {
    this.guard(record.owner, record)
    record.view.time.updated = Date.now()
    if (persist && record.owner.binding.accountID && this.storage) {
      const parent = JSON.stringify([record.owner.origin, record.owner.binding.accountID])
      this.storage.putDoc("remote-record", JSON.stringify([parent, record.view.id]), { view: record.view, messages: record.messages }, parent, record.view.time.updated)
    }
    this.bus.publish("remote.session.changed", { sessionID: record.view.id, epoch: record.view.epoch }, "remote")
  }

  private async wait<T>(owner: Owner, work: () => Promise<T>): Promise<T> {
    const signal = owner.controller.signal
    let abort!: () => void
    const cancelled = new Promise<never>((_yes, no) => { abort = () => no(problem("aborted")); signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort() })
    try { return await Promise.race([new Promise<T>((resolve) => resolve(work())), cancelled]) }
    catch (error) { throw neutral(error) }
    finally { signal.removeEventListener("abort", abort) }
  }

  async models(): Promise<{ epoch: string; models: RemoteModel[] }> {
    const owner = this.binding(), read = ++owner.catalogRead
    owner.catalog = undefined
    const models = parse(z.array(RemoteModel).max(10000), await this.wait(owner, () => owner.binding.models(owner.controller.signal)))
    this.guard(owner)
    if (read !== owner.catalogRead) throw problem("aborted")
    if (new Set(models.map((m) => m.slug)).size !== models.length) throw problem()
    owner.catalog = new Map(models.map((m) => [m.slug, m]))
    return structuredClone({ epoch: owner.binding.epoch, models })
  }

  create(input: unknown): RemoteSessionView {
    const value = parse(RemoteSessionCreateInput, input, "invalid_request"), owner = this.binding()
    if (value.epoch !== owner.binding.epoch) throw problem("aborted")
    if (!owner.catalog) throw problem("catalog_unavailable")
    const model = owner.catalog.get(value.modelSlug)
    if (!model) throw problem("model_not_found")
    if ((model.reasoning === true) !== (value.effort !== undefined)) throw problem("invalid_request")
    const now = Date.now()
    const view: RemoteSessionView = { id: newId("session"), source: "remote", epoch: value.epoch, scope: owner.binding.accountID ? "account" : "process", title: "", modelSlug: value.modelSlug, ...(value.effort ? { effort: value.effort } : {}), state: "ready", time: { created: now, updated: now } }
    const record: RecordState = { owner, view, messages: [], files: new Map(), uploads: 0, historyRead: 0 }
    this.records.set(view.id, record)
    this.changed(record)
    this.guard(owner, record)
    return structuredClone(view)
  }

  get(id: string): RemoteSessionView { return structuredClone(this.record(id).view) }
  list(): RemoteSessionView[] { this.binding(); return structuredClone([...this.records.values()].map((r) => r.view)) }
  async discover(): Promise<RemoteSessionView[]> {
    const owner = this.binding()
    if (!owner.binding.accountID || !owner.binding.discover) return this.list()
    const rows = parse(z.array(z.object({ conversationID: AdmissionSchema.shape.conversationID, title: z.string().max(1024), modelSlug: z.string().min(1) })), await this.wait(owner, () => owner.binding.discover!(owner.controller.signal)))
    this.guard(owner)
    if (new Set(rows.map((row) => row.conversationID)).size !== rows.length) throw problem()
    for (const row of rows) {
      if ([...this.records.values()].some((r) => r.view.conversationID === row.conversationID)) continue
      const now = Date.now()
      const view: RemoteSessionView = { id: newId("session"), source: "remote", scope: "account", epoch: owner.binding.epoch, ...row, ...(owner.catalog?.get(row.modelSlug)?.reasoning === true ? { effort: "medium" as const } : {}), state: "history_required", time: { created: now, updated: now } }
      const record: RecordState = { owner, view, messages: [], files: new Map(), uploads: 0, historyRead: 0 }
      this.records.set(view.id, record); this.changed(record)
    }
    owner.discovered = true
    return this.list()
  }
  messages(id: string): RemoteMessageView[] { return structuredClone(this.record(id).messages) }

  async upload(id: string, input: unknown): Promise<RemoteFile> {
    const record = this.record(id), value = parse(Upload, input, "invalid_request"), owner = record.owner
    if (this.pending || record.uploads) throw problem("session_busy")
    if (owner.catalog?.get(value.oneOffModelSlug ?? record.view.modelSlug)?.vision !== true) throw problem("model_no_image_input")
    const conversationID = record.view.conversationID
    const body = value.body.slice(0, value.body.size, value.body.type)
    record.uploads++
    try {
      const file = parse(RemoteFile, await this.wait(owner, () => owner.binding.upload({ body, filename: value.filename, conversationID }, owner.controller.signal)))
      this.guard(owner, record)
      if (file.conversationID !== conversationID || [...this.records.values()].some((r) => r !== record && r.files.has(file.id))) throw problem()
      record.files.set(file.id, { file, body, filename: value.filename })
      return structuredClone(file)
    } finally { if (this.records.get(id) === record) record.uploads-- }
  }

  async prompt(id: string, input: unknown): Promise<Accepted> {
    // Restored conversations are only known to the binding after discovery.
    const restored = this.record(id)
    if (restored.view.conversationID && restored.owner.binding.discover && !restored.owner.discovered) await this.discover()
    const record = this.record(id), value = parse(RemotePromptInput, input, "invalid_request")
    if (this.pending || record.uploads) throw problem("session_busy")
    if (record.view.state === "history_required") throw problem("conflict")
    // Discovered sessions carry no effort; reasoning models need one to continue.
    if (record.view.effort === undefined && record.owner.catalog?.get(record.view.modelSlug)?.reasoning === true) record.view.effort = "medium"
    const files = value.attachmentIDs.map((id) => { const saved = record.files.get(id); if (!saved) throw problem("invalid_request"); return saved.file })
    const base = { sessionID: id, time: { created: Date.now() }, partial: false }
    const user: RemoteMessageView = { ...base, id: newId("message"), role: "user", parts: [
      ...(value.message ? [{ id: newId("part"), type: "text" as const, text: value.message }] : []),
      ...files.map((file) => ({ id: newId("part"), type: "file" as const, file: structuredClone(file) })),
    ] }
    const turn: Turn = { record, input: { ...value, modelSlug: record.view.modelSlug, effort: record.view.effort, conversationID: record.view.conversationID }, user,
      assistant: { ...base, time: { created: Date.now() }, id: newId("message"), role: "assistant", parts: [] }, characters: 0 }
    // ponytail: one unresolved turn per binding; parallel remote conversations need a main ledger extension.
    this.pending = record.turn = turn
    return this.start(turn, false)
  }

  async resume(id: string): Promise<Accepted> {
    const record = this.record(id), turn = record.turn
    if (!turn?.delivery || this.pending !== turn || !turn.attempt?.wireSettled || !["uncertain", "detached"].includes(record.view.state)) throw problem("conflict")
    return this.start(turn, true)
  }

  detach(id: string): RemoteSessionView {
    const record = this.record(id), turn = record.turn, attempt = turn?.attempt
    if (!turn || this.pending !== turn || !attempt) throw problem("conflict")
    if (attempt.active) {
      attempt.active = false
      record.view.state = turn.terminal ? "history_required" : "detached"
      attempt.controller.abort()
      turn.delivery?.detach()
      const outcome: RemoteOutcome = { state: record.view.state, complete: false, partial: turn.assistant.partial, errorCode: "aborted" }
      record.view.outcome = outcome
      attempt.admission.reject(problem("aborted")); attempt.done.resolve(structuredClone(outcome))
      this.changed(record)
    }
    this.guard(record.owner, record)
    return structuredClone(record.view)
  }

  private start(turn: Turn, resume: boolean): Promise<Accepted> {
    const record = turn.record, owner = record.owner
    const attempt: Attempt = { controller: new AbortController(), active: true, wireSettled: false, admission: deferred<Accepted>(), done: deferred<RemoteOutcome>() }
    // Admission can be invalidated synchronously from a live subscriber before the caller receives it.
    void attempt.admission.promise.catch(() => undefined)
    turn.attempt = attempt
    record.historyRead++
    record.view.state = turn.ids ? "streaming" : "admitting"
    delete record.view.outcome
    this.changed(record)
    const guard = () => { this.guard(owner, record); if (record.turn !== turn || turn.attempt !== attempt || !attempt.active) throw problem("aborted") }
    const admitted = (value: Admission) => {
      guard()
      const ids = parse(AdmissionSchema, value)
      if ((turn.ids && (turn.ids.assistantID !== ids.assistantID || turn.ids.conversationID !== ids.conversationID))
        || (record.view.conversationID && record.view.conversationID !== ids.conversationID)
        || [...this.records.values()].some((r) => r !== record && r.view.conversationID === ids.conversationID)) throw problem()
      if (!turn.ids) {
        if (record.messages.some((m) => m.remoteID === ids.assistantID)) throw problem()
        turn.ids = ids; record.view.conversationID = ids.conversationID; turn.assistant.remoteID = ids.assistantID
        record.messages.push(turn.user, turn.assistant)
        if (!record.view.title) record.view.title = turn.input.message.split("\n")[0].slice(0, 60)
      }
      record.view.state = "streaming"
      delete turn.assistant.errorCode
      this.changed(record); guard()
      attempt.admission.resolve({ messageID: turn.user.id, done: attempt.done.promise })
    }
    const observer: Observer = {
      admitted,
      event: (event) => {
        guard()
        try { this.project(turn, event) }
        catch (error) { this.unsupported(turn, "unknown", true); this.changed(record); throw neutral(error) }
        this.changed(record, false); guard()
      },
      cursor: (id) => { guard(); turn.reset = id === "" },
    }
    try {
      guard()
      const signal = AbortSignal.any([owner.controller.signal, attempt.controller.signal])
      let completion: Promise<HostResult>
      if (resume) completion = turn.delivery!.resume(observer, signal)
      else { turn.delivery = owner.binding.turn(structuredClone(turn.input), observer, signal); completion = turn.delivery.completion }
      void completion.then((result) => {
        attempt.wireSettled = true
        try { guard(); this.finish(turn, attempt, result) }
        catch (error) { this.rejected(turn, attempt, error) }
      }, (error) => { attempt.wireSettled = true; this.rejected(turn, attempt, error) })
      if (!attempt.active || owner.controller.signal.aborted) turn.delivery?.detach()
    } catch (error) { attempt.wireSettled = true; this.rejected(turn, attempt, error) }
    return attempt.admission.promise
  }

  private rejected(turn: Turn, attempt: Attempt, error: unknown) {
    const record = turn.record
    if (turn.attempt !== attempt || this.records.get(record.view.id) !== record || this.owner !== record.owner) return
    try { this.guard(record.owner, record) } catch { return }
    const refused = !turn.ids && (!turn.delivery || turn.delivery.admissionState === "refused")
    const state = refused ? "ready" : turn.terminal || turn.reset ? "history_required" : !attempt.active ? record.view.state : "uncertain"
    attempt.active = false
    if (refused) this.pending = undefined
    const code = neutral(error).code
    if (turn.ids) turn.assistant.errorCode = code
    const outcome: RemoteOutcome = { state, complete: false, partial: turn.assistant.partial, errorCode: code }
    record.view.state = state; record.view.outcome = outcome
    attempt.admission.reject(problem(code)); attempt.done.resolve(structuredClone(outcome))
    this.changed(record)
  }

  private finish(turn: Turn, attempt: Attempt, value: HostResult) {
    const result = parse(z.object({ admission: AdmissionSchema, terminal: Terminal, projection: z.literal("limited").optional() }), value)
    if (!turn.ids || result.admission.conversationID !== turn.ids.conversationID || result.admission.assistantID !== turn.ids.assistantID
      || !turn.terminal || JSON.stringify(result.terminal) !== JSON.stringify(turn.terminal)) throw problem()
    const terminal = result.terminal
    if (terminal.type === "done" && terminal.message_id !== turn.ids.assistantID) throw problem()
    if (result.projection === "limited") this.unsupported(turn, "transport", false)
    for (const part of turn.assistant.parts) if (part.type === "tool" && part.status === "running") {
      part.status = "interrupted"
      turn.assistant.partial = true
    }
    const state = terminal.type === "error" && terminal.recovery === "history" ? "history_required" : "settled"
    if (state === "history_required") this.unsupported(turn, "history", false)
    const outcome: RemoteOutcome = { state, complete: terminal.type === "done" && terminal.finish_reason === "stop" && !terminal.outcome && !turn.assistant.partial, partial: turn.assistant.partial,
      ...(terminal.type === "done" ? { finishReason: terminal.finish_reason, ...(terminal.outcome ? { terminalOutcome: terminal.outcome } : {}), ...(terminal.termination_reason ? { terminationReason: terminal.termination_reason } : {}) } : { errorCode: terminal.code }) }
    if (!turn.record.owner.binding.accountID) turn.assistant.partial = true
    if (state === "settled") this.pending = undefined
    attempt.active = false
    turn.record.view.state = state; turn.record.view.outcome = outcome
    if (outcome.complete) turn.assistant.time.completed = Date.now()
    attempt.done.resolve(structuredClone(outcome))
    this.changed(turn.record)
  }

  private unsupported(turn: Turn, kind: Extract<RemotePart, { type: "unsupported" }>["kind"], blocking: boolean) {
    turn.assistant.partial = true
    if (!turn.assistant.parts.some((p) => p.type === "unsupported" && p.kind === kind && p.blocking === blocking)) this.add(turn, { id: newId("part"), type: "unsupported", kind, blocking })
  }
  private add(turn: Turn, part: RemotePart) {
    // ponytail: bound one projection to the transport ceiling; larger output needs paginated views.
    if (turn.assistant.parts.length >= 4096) throw problem()
    turn.assistant.parts.push(part)
  }
  private project(turn: Turn, raw: unknown) {
    const event = parse(Envelope, raw), assistant = turn.assistant
    if (!turn.ids || (event.message_id && event.message_id !== turn.ids.assistantID) || (event.conversation_id && event.conversation_id !== turn.ids.conversationID)) throw problem()
    switch (event.type) {
      case "text_delta": case "reasoning_delta": {
        const value = parse(z.object({ message_id: AdmissionSchema.shape.assistantID, delta: Text }), raw)
        const type = event.type === "text_delta" ? "text" : "reasoning"
        if (turn.characters + value.delta.length > 16 * 1024 * 1024) throw problem()
        const part = assistant.parts.at(-1)
        if ((part?.type === "text" || part?.type === "reasoning") && part.type === type) part.text += value.delta
        else this.add(turn, { id: newId("part"), type, text: value.delta })
        turn.characters += value.delta.length
        break
      }
      case "reasoning_done": {
        const value = parse(z.object({ message_id: AdmissionSchema.shape.assistantID, duration_ms: Duration }), raw)
        const part = assistant.parts.findLast((p) => p.type === "reasoning")
        if (part?.type === "reasoning") part.durationMs = value.duration_ms
        break
      }
      case "usage": {
        const u = parse(z.object({ message_id: AdmissionSchema.shape.assistantID, input_tokens: Count, output_tokens: Count, cached_tokens: Count, reasoning_tokens: Count.nullish() }), raw)
        assistant.usage = { input: u.input_tokens, output: u.output_tokens, cached: u.cached_tokens, ...(u.reasoning_tokens != null ? { reasoning: u.reasoning_tokens } : {}) }
        break
      }
      case "done": case "error": {
        const terminal = parse(Terminal, raw)
        turn.terminal = terminal
        if (terminal.type === "done") {
          assistant.finishReason = terminal.finish_reason
          assistant.terminalOutcome = terminal.outcome
          assistant.terminationReason = terminal.termination_reason
          if (parse(z.object({ metadata: z.unknown().optional() }), raw).metadata !== undefined) this.unsupported(turn, "structured", true)
        } else assistant.errorCode = terminal.code
        break
      }
      case "disclosure": {
        const value = parse(z.object({ reason: RemotePart.options[3].shape.reason, text: RemoteNoticeText, blocking: z.boolean() }), raw)
        this.add(turn, { id: newId("part"), type: "disclosure", ...value }); break
      }
      case "safety_notice": {
        const value = parse(z.object({ severity: RemotePart.options[4].shape.severity, message: RemoteNoticeText, referral: RemotePart.options[4].shape.referral }), raw)
        this.add(turn, { id: newId("part"), type: "safety", severity: value.severity, text: value.message, referral: value.referral }); break
      }
      case "tool_start": case "tool_end": {
        const invocationID = parse(z.object({ invocation_id: Tool.shape.invocationID }), raw).invocation_id
        const end = event.type === "tool_end" ? parse(z.object({ outcome: z.enum(["ok", "error", "timeout", "refused", "interrupted"]), duration_ms: Duration }), raw) : undefined
        let part = assistant.parts.find((p) => p.type === "tool" && p.invocationID === invocationID)
        if (!part) { part = { id: newId("part"), type: "tool", invocationID, status: "running" }; this.add(turn, part) }
        if (part.type === "tool" && end) { part.status = end.outcome; part.durationMs = end.duration_ms }
        break
      }
      case "tool_result": this.unsupported(turn, "tool_result", false); break
      case "permission_required": this.unsupported(turn, "permission", true); break
      case "image_generation": case "generated_file": case "artifact": this.unsupported(turn, "media", false); break
      default: this.unsupported(turn, "unknown", true)
    }
  }

  async history(id: string): Promise<RemoteHistoryWindow> {
    const record = this.record(id), owner = record.owner, conversationID = record.view.conversationID
    if (!conversationID) throw problem("invalid_request")
    if (record.turn?.attempt && !record.turn.attempt.wireSettled) throw problem("conflict")
    const read = ++record.historyRead, turn = record.turn
    const history = parse(RemoteHistoryWindow, await this.wait(owner, () => owner.binding.history(conversationID, owner.controller.signal)))
    this.guard(owner, record)
    if (record.historyRead !== read || record.turn !== turn) throw problem("aborted")
    if (history.conversationID !== conversationID || history.modelSlug !== record.view.modelSlug) throw problem()
    record.view.title = history.title
    const completed = turn?.ids && history.items.find((m) => m.role === "assistant" && m.id === turn.ids!.assistantID && m.finish_reason !== undefined)
    if (!turn && record.view.state === "history_required" && history.items.every((message) => message.role !== "assistant" || message.finish_reason !== undefined)) {
      record.view.state = "settled"
      record.view.outcome = { state: "settled", complete: false, partial: true }
    }
    if (turn && this.pending === turn && completed) {
      this.pending = undefined
      turn.assistant.finishReason = completed.finish_reason
      for (const part of turn.assistant.parts) if (part.type === "tool" && part.status === "running") part.status = "interrupted"
      this.unsupported(turn, "history", false)
      record.view.state = "settled"
      record.view.outcome = { state: "settled", complete: false, partial: true, finishReason: completed.finish_reason }
    }
    this.changed(record)
    this.guard(owner, record)
    return structuredClone(history)
  }

  close(): void { this.closed = true; this.clear() }
  private clear() {
    const owner = this.owner, records = [...this.records.values()]
    this.owner = undefined; this.records.clear(); this.pending = undefined
    owner?.off(); owner?.catalog?.clear(); owner?.controller.abort()
    for (const record of records) {
      record.files.clear(); record.messages.length = 0
      const turn = record.turn, attempt = turn?.attempt
      if (attempt) {
        attempt.active = false; attempt.controller.abort()
        attempt.admission.reject(problem("aborted"))
        attempt.done.resolve({ state: "detached", complete: false, partial: turn!.assistant.partial, errorCode: "aborted" })
      }
      turn?.delivery?.detach()
      this.bus.publish("remote.session.removed", { sessionID: record.view.id, epoch: record.view.epoch }, "remote")
    }
  }
}
