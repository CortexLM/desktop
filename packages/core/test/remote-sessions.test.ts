import { afterEach, expect, it, vi } from "vitest"
import { Event, RemoteHistoryWindow, RemoteMessageView, RemoteModel, RemoteSessionView, type RemoteAuthState } from "@cortex/schema"
import { createServer } from "../../server/src/index"
import { CLOUD_URL, CortexError, createCore, memoryCredentials, type Core, type CoreRemoteBinding, type CoreRemoteDelivery, type CoreRemoteHost } from "../src/index"

const remoteID = (prefix: string, n: number) => `${prefix}_${String(n).padStart(26, "0")}`
const ids = (n = 1) => ({ conversationID: remoteID("cnv", n), assistantID: remoteID("msg", n) })
const model: RemoteModel = { slug: "remote-model", name: "Remote model", reasoning: true, vision: true, tools: true, source: "cloud" }
type Observer = Parameters<CoreRemoteBinding["turn"]>[1]
type Result = Awaited<CoreRemoteDelivery["completion"]>
const finish = (n = 1, reason: "stop" | "length" | "interrupted" | "error" | "tool_calls" = "stop") => ({ type: "done", message_id: ids(n).assistantID, finish_reason: reason })
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function delivery(first: Observer) {
  let observer = first, active = deferred<Result>(), state: CoreRemoteDelivery["admissionState"] = "pending"
  const original = active.promise
  const handle: CoreRemoteDelivery = {
    get admissionState() { return state },
    completion: original,
    detach: vi.fn(() => { state = state === "admitted" ? state : "uncertain"; active.reject(new CortexError("aborted", "private detail")) }),
    resume: vi.fn((next) => { observer = next; active = deferred<Result>(); return active.promise }),
  }
  return {
    handle,
    admit(value = ids()) { state = "admitted"; observer.admitted(value) },
    emit(event: unknown, cursor = "1") { observer.event(event); observer.cursor?.(cursor) },
    resolve(terminal = finish(), admission = ids()) { active.resolve({ admission, terminal }) },
    reject(next: CoreRemoteDelivery["admissionState"], error: unknown = new Error("private backend detail")) { state = next; active.reject(error) },
    get observer() { return observer },
  }
}
const cores: Core[] = []
afterEach(async () => { for (const core of cores.splice(0)) await core.close(); vi.restoreAllMocks() })
function setup() {
  let version = 0, signal = new AbortController(), signedIn = false, current: CoreRemoteBinding
  const controls: ReturnType<typeof delivery>[] = []
  const models = vi.fn(async () => structuredClone([model]))
  let fileIndex = 0
  const upload = vi.fn<CoreRemoteBinding["upload"]>(async (input) => ({ id: remoteID("lbf", ++fileIndex), filename: input.filename, contentType: input.body.type, byteSize: input.body.size, conversationID: input.conversationID }))
  const history = vi.fn<CoreRemoteBinding["history"]>()
  const turn = vi.fn<CoreRemoteBinding["turn"]>((_input, observer) => { const control = delivery(observer); controls.push(control); return control.handle })
  const make = () => { current = { epoch: `epoch-${++version}`, signal: signal.signal, models, upload, history, turn }; signedIn = true }
  const owner = { origin: CLOUD_URL, revision: crypto.randomUUID() }
  const host: CoreRemoteHost & { state(): RemoteAuthState; authenticate(): Promise<RemoteAuthState>; clear(): void } = {
    bind: vi.fn((origin: string) => { if (!signedIn || origin !== CLOUD_URL) throw new CortexError("provider_auth_failed", "private host detail"); return current }),
    state: () => ({ status: signedIn ? "signed_in" : "signed_out", signedIn, owner }),
    authenticate: async () => ({ status: "signed_out", signedIn: false, owner }),
    clear: vi.fn(() => { signedIn = false; signal.abort(); signal = new AbortController() }),
  }
  const network = vi.fn<typeof fetch>(() => { throw new Error("Unexpected local provider/network access") })
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: host, remoteChat: host, fetch: network })
  cores.push(core)
  core.connection.set({ mode: "cloud", signedIn: false }); make()
  const service = core.remoteSessions
  const create = async () => { const { epoch } = await service.models(); return service.create({ epoch, modelSlug: model.slug, effort: "high" }) }
  return { core, service, create, controls, models, upload, history, turn, host, network, replace() { host.clear(); make() }, lose() { host.clear() } }
}
const counts = (core: Core) => ["event", "session", "message", "part"].map((table) => (core.storage.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n)
const historyWindow = (n = 1): RemoteHistoryWindow => ({
  conversationID: ids(n).conversationID, title: "Known conversation", modelSlug: model.slug,
  items: [{ id: ids(n).assistantID, role: "assistant", text: "server text", created_at: "2026-10-03T00:00:00Z", version_index: 2, version_count: 1, is_active_version: true, finish_reason: "stop" }],
  limit: 100, limited: true, projection: "text-and-attachments", reasoningAndTools: "omitted",
})

it("admits only after headers with a local user ID; projects deltas and measured usage without local side effects", async () => {
  const f = setup(), events: Event[] = [], plugin = vi.fn(), tool = vi.fn()
  f.core.plugins.register("observer", { event: plugin, "tool.execute.before": tool, "chat.params": tool })
  const provider = vi.spyOn(f.core.providers, "get"), permission = vi.spyOn(f.core.permissions, "ask")
  const seen: number[][] = []
  f.core.bus.subscribe((event, source) => { expect(source).toBe("remote"); events.push(Event.parse(event)); seen.push(counts(f.core)) })
  const session = await f.create()
  expect(RemoteSessionView.parse(session)).toEqual(session)
  session.title = "caller mutation"
  expect(f.service.get(session.id).title).toBe("")
  const draft = { message: "  Explain it  ", attachmentIDs: [] as string[] }
  let accepted = false
  const prompt = f.service.prompt(session.id, draft).then((value) => { accepted = true; return value })
  const d = f.controls[0]
  draft.message = "changed"; draft.attachmentIDs.push(remoteID("lbf", 99))
  expect(f.turn).toHaveBeenCalledWith(expect.objectContaining({ message: "Explain it", attachmentIDs: [] }), expect.anything(), expect.any(AbortSignal))
  expect(accepted).toBe(false); expect(f.service.messages(session.id)).toEqual([])
  await expect(f.service.prompt(session.id, { message: "duplicate", attachmentIDs: [] })).rejects.toMatchObject({ code: "session_busy" })
  d.admit()
  const result = await prompt
  expect(result.messageID).not.toBe(ids().assistantID)
  expect(f.service.messages(session.id)[0]).toMatchObject({ id: result.messageID, role: "user", parts: [{ text: "Explain it" }] })
  d.emit({ type: "text_delta", message_id: ids().assistantID, delta: "hello " }, "1")
  d.emit({ type: "text_delta", message_id: ids().assistantID, delta: "world" }, "1")
  d.emit({ type: "reasoning_delta", message_id: ids().assistantID, delta: "consider" }, "1")
  d.emit({ type: "reasoning_done", message_id: ids().assistantID, duration_ms: 12.5 })
  const usage = { type: "usage", message_id: ids().assistantID, input_tokens: 7, output_tokens: 4, cached_tokens: 2, cost: 999, routing_reason: "private" }
  d.emit(usage); d.emit(usage)
  d.emit(finish())
  expect(f.service.get(session.id).state).toBe("streaming")
  expect(f.service.messages(session.id)[1].time.completed).toBeUndefined()
  d.resolve()
  expect(await result.done).toEqual({ state: "settled", complete: true, partial: false, finishReason: "stop" })
  const messages = f.service.messages(session.id), assistant = messages[1]
  expect(RemoteMessageView.parse(assistant)).toEqual(assistant)
  expect(assistant.parts).toEqual([expect.objectContaining({ type: "text", text: "hello world" }), expect.objectContaining({ type: "reasoning", text: "consider", durationMs: 12.5 })])
  expect(assistant.usage).toEqual({ input: 7, output: 4, cached: 2 })
  expect(assistant).not.toHaveProperty("model"); expect(assistant).not.toHaveProperty("agent")
  assistant.parts.length = 0
  expect(f.service.messages(session.id)[1].parts).toHaveLength(2)
  expect(events.every((e) => e.type === "remote.session.changed" && Object.keys(e.properties).sort().join() === "epoch,sessionID")).toBe(true)
  expect(seen.every((n) => n.every((v) => v === 0))).toBe(true)
  expect(counts(f.core)).toEqual([0, 0, 0, 0])
  for (const spy of [plugin, tool, provider, permission, f.network]) expect(spy).not.toHaveBeenCalled()
})

it("validates catalogue, epoch, effort and input before main; preserves the local API by default", async () => {
  const f = setup()
  expect(() => f.service.create({ epoch: "epoch-1", modelSlug: model.slug, effort: "high" })).toThrow(expect.objectContaining({ code: "catalog_unavailable" }))
  const catalog = await f.service.models(); catalog.models[0].slug = "tampered"
  for (const input of [
    { epoch: "stale", modelSlug: model.slug, effort: "high" }, { epoch: catalog.epoch, modelSlug: "missing", effort: "high" },
    { epoch: catalog.epoch, modelSlug: model.slug }, { epoch: catalog.epoch, modelSlug: model.slug, effort: true },
    { epoch: catalog.epoch, modelSlug: model.slug, effort: "high", origin: "https://other.test" },
  ]) expect(() => f.service.create(input)).toThrow(CortexError)
  const session = f.service.create({ epoch: catalog.epoch, modelSlug: model.slug, effort: "low" })
  for (const input of [
    { message: "", attachmentIDs: [] }, { message: "x", attachmentIDs: [], reasoning: true },
    { message: "x", attachmentIDs: [remoteID("lbf", 5)] }, { message: "😀".repeat(50001), attachmentIDs: [] },
  ]) await expect(f.service.prompt(session.id, input)).rejects.toMatchObject({ code: "invalid_request" })
  expect(f.turn).not.toHaveBeenCalled()
  const local = f.core.sessions.create({ model: { providerID: "local", modelID: "local" } })
  expect(f.core.sessions.list()).toEqual([local]); expect(f.core.sessions.list()).not.toContainEqual(session)
  const server = createServer(f.core)
  expect(await (await server.fetch(new Request("http://local/api/sessions"))).json()).toEqual([local])
  expect((await server.fetch(new Request(`http://local/api/sessions/${session.id}`))).status).toBe(404)
  await f.core.sessions.delete(local.id)
  f.core.connection.set({ mode: "local", signedIn: false })
  const before = vi.mocked(f.host.bind).mock.calls.length
  await expect(f.service.models()).rejects.toMatchObject({ code: "invalid_request" })
  expect(vi.mocked(f.host.bind).mock.calls).toHaveLength(before)
})

it("gates uploads on the selected one-off capability without changing the recorded model", async () => {
  const f = setup()
  f.models.mockResolvedValue([
    { ...model, vision: false },
    { ...model, slug: "vision", vision: true },
    { ...model, slug: "unknown", vision: "unknown" },
  ])
  const session = await f.create()
  const input = { body: new Blob(["image"], { type: "image/png" }), filename: "image.png" }
  for (const oneOffModelSlug of [undefined, model.slug, "unknown", "missing"]) {
    await expect(f.service.upload(session.id, { ...input, oneOffModelSlug }))
      .rejects.toMatchObject({ code: "model_no_image_input" })
  }
  for (const oneOffModelSlug of ["", " ", "x".repeat(1025), null, 1]) {
    await expect(f.service.upload(session.id, { ...input, oneOffModelSlug }))
      .rejects.toMatchObject({ code: "invalid_request" })
    await expect(f.service.prompt(session.id, { message: "text", attachmentIDs: [], oneOffModelSlug }))
      .rejects.toMatchObject({ code: "invalid_request" })
  }
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.turn).not.toHaveBeenCalled()
  const file = await f.service.upload(session.id, { ...input, oneOffModelSlug: " vision " })
  expect(file.filename).toBe(input.filename)
  expect(f.upload).toHaveBeenCalledTimes(1)
  const uploaded = f.upload.mock.calls[0][0]
  expect(uploaded).toEqual({ filename: input.filename, body: expect.any(Blob), conversationID: undefined })
  expect(uploaded.body.type).toBe(input.body.type)
  expect(await uploaded.body.text()).toBe(await input.body.text())
  expect(f.service.get(session.id)).toEqual(session)
  await expect(f.service.upload(session.id, input)).rejects.toMatchObject({ code: "model_no_image_input" })
})

it("keeps the one-off on the original delivery and omits it on the next ordinary turn", async () => {
  const f = setup(), session = await f.create()
  const draft = { message: "original", attachmentIDs: [] as string[], oneOffModelSlug: "alternate" }
  const pending = f.service.prompt(session.id, draft), first = f.controls[0]
  draft.oneOffModelSlug = "changed"
  expect(f.turn.mock.calls[0][0]).toEqual({
    message: "original", attachmentIDs: [], oneOffModelSlug: "alternate",
    modelSlug: model.slug, effort: "high", conversationID: undefined,
  })
  first.admit()
  const accepted = await pending
  first.reject("admitted")
  expect(await accepted.done).toMatchObject({ state: "uncertain" })
  const replay = f.service.resume(session.id)
  first.admit()
  const resumed = await replay
  expect(resumed.messageID).toBe(accepted.messageID)
  first.emit(finish()); first.resolve(); await resumed.done
  expect(first.handle.resume).toHaveBeenCalledTimes(1)
  expect(f.turn).toHaveBeenCalledTimes(1)
  expect(f.service.get(session.id)).toMatchObject({ modelSlug: model.slug, effort: "high" })
  expect(f.service.get(session.id)).not.toHaveProperty("oneOffModelSlug")
  const next = f.service.prompt(session.id, { message: "ordinary", attachmentIDs: [] })
  expect(f.turn.mock.calls[1][0]).toEqual({
    message: "ordinary", attachmentIDs: [], modelSlug: model.slug, effort: "high", conversationID: ids().conversationID,
  })
  const second = f.controls[1], admission = { ...ids(), assistantID: ids(2).assistantID }
  second.admit(admission)
  const ordinary = await next, terminal = { ...finish(), message_id: admission.assistantID }
  second.emit(terminal); second.resolve(terminal, admission); await ordinary.done
})

it("owns uploaded file IDs per session and snapshots bytes/metadata without fetching caller URLs", async () => {
  const f = setup(), a = await f.create(), b = f.service.create({ epoch: a.epoch, modelSlug: model.slug, effort: "high" })
  const pending = deferred<Awaited<ReturnType<CoreRemoteBinding["upload"]>>>()
  f.upload.mockReturnValueOnce(pending.promise)
  const input = { body: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), filename: "original.png" }
  const upload = f.service.upload(a.id, input)
  input.filename = "changed.png"
  await expect(f.service.upload(a.id, input)).rejects.toMatchObject({ code: "session_busy" })
  expect(f.upload).toHaveBeenCalledTimes(1)
  await expect(f.service.prompt(a.id, { message: "early", attachmentIDs: [] })).rejects.toMatchObject({ code: "session_busy" })
  expect(f.upload.mock.calls[0][0].filename).toBe("original.png")
  expect([...new Uint8Array(await f.upload.mock.calls[0][0].body.arrayBuffer())]).toEqual([137, 80, 78, 71])
  pending.resolve({ id: remoteID("lbf", 7), filename: "original.png", contentType: "image/png", byteSize: 4 })
  const file = await upload; file.filename = "tampered"
  await expect(f.service.prompt(b.id, { message: "foreign", attachmentIDs: [file.id] })).rejects.toMatchObject({ code: "invalid_request" })
  await expect(f.service.upload(a.id, { body: input.body, filename: "x", url: "https://private.test" })).rejects.toMatchObject({ code: "invalid_request" })
  const prompt = f.service.prompt(a.id, { message: "", attachmentIDs: [file.id] })
  f.controls[0].admit(); const accepted = await prompt
  expect(f.service.messages(a.id)[0].parts).toMatchObject([{ type: "file", file: { filename: "original.png" } }])
  f.controls[0].emit(finish()); f.controls[0].resolve(); await accepted.done
  expect(f.network).not.toHaveBeenCalled()
})

it("releases definitive refusals, retains ambiguous admission and resumes only the original handle", async () => {
  const f = setup(), session = await f.create(), other = f.service.create({ epoch: session.epoch, modelSlug: model.slug, effort: "high" })
  f.turn.mockImplementationOnce(() => { throw new CortexError("invalid_request", "private synchronous refusal") })
  await expect(f.service.prompt(session.id, { message: "sync", attachmentIDs: [] })).rejects.toMatchObject({ code: "invalid_request", message: "Could not complete the remote request" })
  const refusal = expect(f.service.prompt(session.id, { message: "refused", attachmentIDs: [] })).rejects.toMatchObject({ code: "provider_rate_limited" })
  f.controls[0].reject("refused", new CortexError("provider_rate_limited", "private")); await refusal
  expect(f.service.get(session.id).state).toBe("ready")
  const uncertain = expect(f.service.prompt(session.id, { message: "ambiguous", attachmentIDs: [] })).rejects.toMatchObject({ code: "provider_error" })
  const d = f.controls[1]; d.reject("uncertain"); await uncertain
  expect(f.service.get(session.id).state).toBe("uncertain")
  await expect(f.service.prompt(other.id, { message: "fresh", attachmentIDs: [] })).rejects.toMatchObject({ code: "session_busy" })
  const resumed = f.service.resume(session.id)
  expect(f.service.messages(session.id)).toEqual([])
  d.admit(); const accepted = await resumed
  d.emit({ type: "reasoning_delta", message_id: ids().assistantID, delta: "retained" })
  d.emit({ type: "usage", message_id: ids().assistantID, input_tokens: 3, output_tokens: 1, cached_tokens: 0 })
  const visible = f.service.messages(session.id)
  f.service.detach(session.id)
  expect(await accepted.done).toMatchObject({ state: "detached", complete: false })
  await Promise.resolve()
  const replay = f.service.resume(session.id)
  d.admit(); d.admit()
  const second = await replay
  expect(second.messageID).toBe(accepted.messageID)
  expect(f.service.messages(session.id)).toEqual(visible)
  d.emit(finish()); d.resolve(); expect(await second.done).toMatchObject({ complete: false, partial: true, finishReason: "stop" })
  expect(d.handle.resume).toHaveBeenCalledTimes(2)
  expect(f.turn).toHaveBeenCalledTimes(3); expect(f.upload).not.toHaveBeenCalled()
})

it("repeats matching header admission after a callback interruption without duplicating local messages", async () => {
  const f = setup(), session = await f.create()
  let interrupted = false
  const off = f.core.bus.subscribe((event) => {
    if (event.type === "remote.session.changed" && !interrupted && f.service.get(session.id).state === "streaming") {
      interrupted = true
      f.service.detach(session.id)
    }
  })
  const refused = expect(f.service.prompt(session.id, { message: "keep IDs", attachmentIDs: [] })).rejects.toMatchObject({ code: "aborted" })
  const d = f.controls[0]
  expect(() => d.admit()).toThrow(CortexError)
  await refused; off()
  const originals = f.service.messages(session.id).map((m) => m.id)
  const replay = f.service.resume(session.id)
  d.admit(); const admitted = await replay
  expect(f.service.messages(session.id).map((m) => m.id)).toEqual(originals)
  expect(admitted.messageID).toBe(originals[0])
  d.emit(finish()); d.resolve()
  expect(await admitted.done).toMatchObject({ partial: true, complete: false })
  expect(f.turn).toHaveBeenCalledTimes(1)
})

it("refuses the detached snapshot when a subscriber signs out during its notification", async () => {
  const f = setup(), session = await f.create()
  const pending = f.service.prompt(session.id, { message: "private account title", attachmentIDs: [] })
  const d = f.controls[0]; d.admit(); const accepted = await pending
  const off = f.core.bus.subscribe((event) => {
    if (event.type === "remote.session.changed" && f.service.get(session.id).state === "detached") f.lose()
  })
  try {
    expect(() => f.service.detach(session.id)).toThrow(expect.objectContaining({ code: "aborted" }))
    expect(await accepted.done).toMatchObject({ complete: false, errorCode: "aborted" })
    expect(() => f.service.get(session.id)).toThrow(CortexError)
    expect(counts(f.core)).toEqual([0, 0, 0, 0])
  } finally { off() }
})

it("detaches before headers without admitting a draft; replay waits for matching headers", async () => {
  const f = setup(), session = await f.create()
  const detached = expect(f.service.prompt(session.id, { message: "unacknowledged", attachmentIDs: [] })).rejects.toMatchObject({ code: "aborted" })
  const d = f.controls[0], old = d.observer
  f.service.detach(session.id); await detached
  expect(f.service.messages(session.id)).toEqual([])
  const pending = f.service.resume(session.id)
  expect(() => old.admitted(ids())).toThrow(CortexError)
  d.admit(); const result = await pending
  d.emit(finish()); d.resolve()
  expect(await result.done).toMatchObject({ complete: false, partial: true })
  expect(f.turn).toHaveBeenCalledTimes(1)
})

it.each(["length", "interrupted", "error", "tool_calls"] as const)("preserves %s finish without a successful completion timestamp", async (reason) => {
  const f = setup(), session = await f.create(), pending = f.service.prompt(session.id, { message: "test", attachmentIDs: [] })
  const d = f.controls[0]; d.admit(); const accepted = await pending
  d.emit(finish(1, reason)); d.resolve(finish(1, reason))
  expect(await accepted.done).toEqual({ state: "settled", complete: false, partial: false, finishReason: reason })
  expect(f.service.messages(session.id)[1].time.completed).toBeUndefined()
})

it("preserves plain safety/disclosure copy while omitting payloads, action URLs, raw errors and structured output", async () => {
  const f = setup(), session = await f.create(), pending = f.service.prompt(session.id, { message: "test", attachmentIDs: [] })
  const d = f.controls[0]; d.admit(); const accepted = await pending
  d.emit({ type: "disclosure", reason: "conversation_start", text: "Plain <text> https://example.test", blocking: true })
  d.emit({ type: "text_delta", message_id: ids().assistantID, delta: "before safety" })
  d.emit({ type: "safety_notice", severity: "acute", message: "Contact support", referral: { name: "Help", contact: "https://help.test", note: "Text, not a link" } })
  d.emit({ type: "text_delta", message_id: ids().assistantID, delta: "after safety" })
  d.emit({ type: "tool_start", invocation_id: remoteID("tci", 1), tool_name: "bash", label: "private label" })
  d.emit({ type: "tool_result", invocation_id: remoteID("tci", 1), payload: { url: "https://private.test", token: "private token" } })
  d.emit({ type: "tool_end", invocation_id: remoteID("tci", 1), outcome: "refused", duration_ms: 5, error_detail: "private error" })
  d.emit({ type: "permission_required", prompt: { detail: "private action", url: "https://private.test" } })
  d.emit({ type: "image_generation", status: "done", file_id: "private file", url: "https://private.test" })
  d.emit({ type: "unrecognized-event", private: "private content" })
  const terminal = { ...finish(), metadata: { payload: "private signing payload" } }
  d.emit(terminal); d.resolve(terminal)
  expect(await accepted.done).toEqual({ state: "settled", complete: false, partial: true, finishReason: "stop" })
  const assistant = f.service.messages(session.id)[1]
  expect(assistant.parts).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "disclosure", text: "Plain <text> https://example.test", blocking: true }),
    expect.objectContaining({ type: "safety", severity: "acute", referral: { name: "Help", contact: "https://help.test", note: "Text, not a link" } }),
    expect.objectContaining({ type: "tool", status: "refused", durationMs: 5 }),
    expect.objectContaining({ type: "unsupported", kind: "permission", blocking: true }),
  ]))
  expect(JSON.stringify(assistant)).not.toContain("private")
  expect(assistant.parts.slice(0, 4).map((p) => p.type)).toEqual(["disclosure", "text", "safety", "text"])
  expect(assistant.time.completed).toBeUndefined()
})

it("rejects invalid usage/duration/identity before projection and never manufactures zero usage", async () => {
  const f = setup(), session = await f.create(), pending = f.service.prompt(session.id, { message: "test", attachmentIDs: [] })
  const d = f.controls[0]; d.admit(); const accepted = await pending
  for (const event of [
    { type: "usage", message_id: ids().assistantID, input_tokens: Infinity, output_tokens: 1, cached_tokens: 0 },
    { type: "reasoning_done", message_id: ids().assistantID, duration_ms: -1 },
    { type: "text_delta", message_id: ids(2).assistantID, delta: "foreign" },
  ]) expect(() => d.emit(event)).toThrow(CortexError)
  expect(f.service.messages(session.id)[1].usage).toBeUndefined()
  d.reject("admitted")
  expect(await accepted.done).toMatchObject({ state: "uncertain", complete: false, partial: true })
  expect(JSON.stringify(f.service.messages(session.id))).not.toContain("foreign")
})

it("keeps incomplete media and expired replay reserved until bounded known-history recovery", async () => {
  const f = setup(), session = await f.create()
  await expect(f.service.history(session.id)).rejects.toMatchObject({ code: "invalid_request" })
  expect(f.history).not.toHaveBeenCalled()
  const pending = f.service.prompt(session.id, { message: "test", attachmentIDs: [] }), d = f.controls[0]
  d.admit(); const accepted = await pending
  d.emit({ type: "reasoning_delta", message_id: ids().assistantID, delta: "keep reasoning" })
  d.emit({ type: "tool_start", invocation_id: remoteID("tci", 9) })
  d.emit(finish()); d.reject("admitted")
  expect(await accepted.done).toMatchObject({ state: "history_required", complete: false })
  await expect(f.service.resume(session.id)).rejects.toMatchObject({ code: "conflict" })
  f.history.mockResolvedValueOnce({ ...historyWindow(), limited: false } as never)
  await expect(f.service.history(session.id)).rejects.toMatchObject({ code: "provider_error" })
  f.history.mockResolvedValueOnce(historyWindow())
  const history = await f.service.history(session.id)
  expect(history).toEqual(historyWindow()); history.items[0].text = "mutated"
  expect(f.service.messages(session.id)[1].parts).toContainEqual(expect.objectContaining({ type: "reasoning", text: "keep reasoning" }))
  expect(f.service.messages(session.id)[1].parts).toContainEqual(expect.objectContaining({ type: "tool", invocationID: remoteID("tci", 9), status: "interrupted" }))
  expect(f.service.get(session.id).outcome).toEqual({ state: "settled", complete: false, partial: true, finishReason: "stop" })
  expect(f.service.messages(session.id)[1].time.completed).toBeUndefined()
  const next = f.service.prompt(session.id, { message: "follow-up", attachmentIDs: [] }), second = f.controls[1]
  second.admit({ ...ids(), assistantID: ids(2).assistantID }); const acknowledged = await next
  const terminal = { type: "error", code: "provider_error", recovery: "history", detail: "private", request_id: "private" }
  second.emit(terminal); second.resolve(terminal as never, { ...ids(), assistantID: ids(2).assistantID })
  expect(await acknowledged.done).toMatchObject({ state: "history_required", complete: false })
  expect(JSON.stringify(f.service.messages(session.id))).not.toContain("private")
})

it("rejects invalid terminal completion and marks dangling remote tools partial", async () => {
  const f = setup(), session = await f.create()
  const pending = f.service.prompt(session.id, { message: "bad terminal", attachmentIDs: [] }), d = f.controls[0]
  d.admit(); const accepted = await pending
  expect(() => d.emit({ type: "done", message_id: ids().assistantID, finish_reason: "unknown" })).toThrow(CortexError)
  d.resolve()
  expect(await accepted.done).toMatchObject({ complete: false, partial: true, state: "uncertain" })
  f.history.mockResolvedValueOnce(historyWindow()); await f.service.history(session.id)
  const next = f.service.prompt(session.id, { message: "tool", attachmentIDs: [] }), second = f.controls[1]
  const admission = { ...ids(), assistantID: ids(2).assistantID }
  second.admit(admission); const later = await next
  second.emit({ type: "tool_start", invocation_id: remoteID("tci", 2) })
  const terminal = { ...finish(), message_id: admission.assistantID }
  second.emit(terminal); second.resolve(terminal, admission)
  expect(await later.done).toMatchObject({ complete: false, partial: true })
  expect(f.service.messages(session.id).at(-1)!.parts).toContainEqual(expect.objectContaining({ type: "tool", status: "interrupted" }))
})

it("refuses stale concurrent catalogue/history results within the same epoch", async () => {
  const f = setup(), oldCatalog = deferred<RemoteModel[]>()
  f.models.mockReturnValueOnce(oldCatalog.promise)
  const stale = expect(f.service.models()).rejects.toMatchObject({ code: "aborted" })
  const latest = await f.service.models(); oldCatalog.resolve([model]); await stale
  const session = f.service.create({ epoch: latest.epoch, modelSlug: model.slug, effort: "high" })
  const pending = f.service.prompt(session.id, { message: "first", attachmentIDs: [] }), first = f.controls[0]
  first.admit(); const accepted = await pending; first.emit(finish()); first.resolve(); await accepted.done
  const history = deferred<RemoteHistoryWindow>(); f.history.mockReturnValueOnce(history.promise)
  const staleHistory = expect(f.service.history(session.id)).rejects.toMatchObject({ code: "aborted" })
  const next = f.service.prompt(session.id, { message: "second", attachmentIDs: [] }), second = f.controls[1]
  history.resolve(historyWindow()); await staleHistory
  const admission = { ...ids(), assistantID: ids(2).assistantID }
  second.admit(admission); const result = await next
  const terminal = { ...finish(), message_id: admission.assistantID }
  second.emit(terminal); second.resolve(terminal, admission); await result.done
  expect(f.service.get(session.id).title).toBe("first")
})

it("removes projections immediately on epoch loss and ignores late observer/catalogue/upload/history work", async () => {
  const f = setup(), session = await f.create(), events: Event[] = []
  f.core.bus.subscribe((e) => events.push(e))
  const pending = expect(f.service.prompt(session.id, { message: "held", attachmentIDs: [] })).rejects.toMatchObject({ code: "aborted" })
  const old = f.controls[0].observer
  f.replace()
  expect(events.at(-1)).toEqual({ type: "remote.session.removed", properties: { sessionID: session.id, epoch: session.epoch } })
  await pending
  expect(f.service.list()).toEqual([])
  expect(() => old.admitted(ids())).toThrow(CortexError)
  f.controls[0].reject("uncertain")
  const catalog = deferred<RemoteModel[]>(); f.models.mockReturnValueOnce(catalog.promise)
  const staleModels = expect(f.service.models()).rejects.toMatchObject({ code: "aborted" })
  f.replace(); await staleModels; catalog.resolve([model])
  const current = await f.create(), upload = deferred<Awaited<ReturnType<CoreRemoteBinding["upload"]>>>()
  f.upload.mockReturnValueOnce(upload.promise)
  const staleUpload = expect(f.service.upload(current.id, { body: new Blob(["x"], { type: "image/png" }), filename: "x" })).rejects.toMatchObject({ code: "aborted" })
  f.replace(); await staleUpload; upload.resolve({ id: remoteID("lbf", 1), filename: "x", contentType: "image/png", byteSize: 1 })
  const last = await f.create(), prompt = f.service.prompt(last.id, { message: "known", attachmentIDs: [] }), d = f.controls.at(-1)!
  d.admit(); const result = await prompt; d.emit(finish()); d.resolve(); await result.done
  const window = deferred<RemoteHistoryWindow>(); f.history.mockReturnValueOnce(window.promise)
  const staleHistory = expect(f.service.history(last.id)).rejects.toMatchObject({ code: "aborted" })
  f.replace(); await staleHistory; window.resolve(historyWindow())
  expect(f.service.list()).toEqual([])
  expect(counts(f.core)).toEqual([0, 0, 0, 0])
})

it("revalidates origin/account for getters and synchronously clears/detaches on close", async () => {
  const f = setup(), session = await f.create()
  f.core.connection.set({ mode: "selfhost", url: "https://other.test", signedIn: false })
  expect(() => f.service.get(session.id)).toThrow(CortexError)
  expect(() => f.service.list()).toThrow(CortexError)
  f.core.connection.set({ mode: "cloud", signedIn: false }); f.replace()
  const current = await f.create(), prompt = f.service.prompt(current.id, { message: "close", attachmentIDs: [] }), d = f.controls[0]
  d.admit(); const accepted = await prompt
  const removed: Event[] = []; f.core.bus.subscribe((e) => { if (e.type === "remote.session.removed") removed.push(e) })
  f.service.close()
  expect(removed).toEqual([{ type: "remote.session.removed", properties: { sessionID: current.id, epoch: current.epoch } }])
  expect(d.handle.detach).toHaveBeenCalled()
  expect(await accepted.done).toMatchObject({ state: "detached", complete: false, errorCode: "aborted" })
  expect(() => f.service.get(current.id)).toThrow(expect.objectContaining({ code: "aborted" }))
  expect(() => d.emit({ type: "text_delta", message_id: ids().assistantID, delta: "late" })).toThrow(CortexError)
})
