import { afterEach, expect, it, vi } from "vitest"
import { createClient, parseSSE } from "@cortex/client"
import {
  CLOUD_URL, CortexError, createCore, memoryCredentials,
  type Core, type CoreRemoteBinding, type CoreRemoteDelivery, type CoreRemoteHost,
} from "@cortex/core"
import type { RemoteAuthState, RemoteHistoryWindow, RemoteModel } from "@cortex/schema"
import { createServer } from "../src/index"

const model: RemoteModel = { slug: "remote-model", name: "Remote model", reasoning: true, vision: false, tools: false, source: "cloud" }
const ids = { conversationID: `cnv_${"0".repeat(26)}`, assistantID: `msg_${"0".repeat(26)}` }
const terminal = { type: "done", message_id: ids.assistantID, finish_reason: "stop" }
const prompt = { message: "hello", attachmentIDs: [] }
const historyWindow: RemoteHistoryWindow = {
  conversationID: ids.conversationID, title: "Known conversation", modelSlug: model.slug,
  items: [{
    id: ids.assistantID, parent_message_id: null, role: "assistant", text: "Known answer", created_at: "2026-10-03T00:00:00Z",
    version_index: 0, version_count: 1, is_active_version: true, finish_reason: "stop",
  }],
  limit: 200, limited: false, projection: "retained-parts", reasoningAndTools: "retained",
}
type Observer = Parameters<CoreRemoteBinding["turn"]>[1]
type Result = Awaited<CoreRemoteDelivery["completion"]>
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function delivery(first: Observer) {
  let observer = first, active = deferred<Result>(), state: CoreRemoteDelivery["admissionState"] = "pending"
  const resumed = deferred<void>()
  const handle: CoreRemoteDelivery = {
    get admissionState() { return state },
    completion: active.promise,
    detach: vi.fn(() => active.reject(new CortexError("aborted", "private detach detail"))),
    resume: vi.fn((next) => {
      observer = next
      active = deferred<Result>()
      resumed.resolve()
      return active.promise
    }),
  }
  return {
    handle, resumed,
    admit() { state = "admitted"; observer.admitted(ids) },
    finish() { observer.event(terminal); active.resolve({ admission: ids, terminal }) },
    refuse() { state = "refused"; active.reject(new CortexError("provider_rate_limited", "private backend detail")) },
  }
}
const cores: Core[] = []
afterEach(async () => {
  for (const core of cores.splice(0)) await core.close()
  vi.restoreAllMocks()
})
function setup(vision = false) {
  let version = 0, signal = new AbortController(), signedIn = false, binding: CoreRemoteBinding
  const started = deferred<ReturnType<typeof delivery>>()
  const models = vi.fn<CoreRemoteBinding["models"]>(async () => [{ ...model, vision }])
  const history = vi.fn<CoreRemoteBinding["history"]>(async () => structuredClone(historyWindow))
  const upload = vi.fn<CoreRemoteBinding["upload"]>(async () => { throw new Error("Unexpected upload") })
  const turn = vi.fn<CoreRemoteBinding["turn"]>((_input, observer) => {
    const control = delivery(observer)
    started.resolve(control)
    return control.handle
  })
  const owner = { origin: CLOUD_URL, revision: crypto.randomUUID() }
  const host: CoreRemoteHost & { state(): RemoteAuthState; authenticate(): Promise<RemoteAuthState>; clear(): void } = {
    bind(origin) {
      if (!signedIn || origin !== CLOUD_URL) throw new CortexError("provider_auth_failed", "private host detail")
      return binding
    },
    state: () => ({ status: signedIn ? "signed_in" : "signed_out", signedIn, owner }),
    authenticate: async () => { host.clear(); return host.state() },
    clear() { signedIn = false; signal.abort(); signal = new AbortController() },
  }
  const replace = () => {
    host.clear()
    binding = { epoch: `epoch-${++version}`, signal: signal.signal, models, history, upload, turn }
    signedIn = true
  }
  const network = vi.fn<typeof fetch>(() => { throw new Error("Unexpected network access") })
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: host, remoteChat: host, fetch: network })
  cores.push(core)
  core.connection.set({ mode: "cloud", signedIn: false })
  replace()
  const app = createServer(core)
  const responses: { method: string; path: string; status: number }[] = []
  const api = createClient({ baseUrl: "http://local", fetch: async (request) => {
    const response = await app.fetch(new Request(request.url, {
      method: request.method, headers: request.headers, signal: request.signal,
      body: request.body ? await request.text() : undefined,
    }))
    responses.push({ method: request.method, path: new URL(request.url).pathname, status: response.status })
    return new Response(await response.text(), { status: response.status, headers: response.headers })
  } })
  const create = async () => {
    const { epoch } = await api.remoteSessions.models()
    return api.remoteSessions.create({ epoch, modelSlug: model.slug, effort: "high" })
  }
  return { core, app, api, responses, create, started, models, history, upload, turn, network, replace }
}

it("uploads exact bytes through text-reconstructed requests and responses", async () => {
  const f = setup(true), session = await f.create()
  const fileID = `lbf_${"0".repeat(26)}`
  f.upload.mockImplementation(async ({ body, filename, conversationID }) => ({
    id: fileID, filename, contentType: body.type, byteSize: body.size, conversationID,
  }))
  for (const bytes of [
    Buffer.from([0]), Buffer.from([0, 255]), Buffer.from([0, 255, 128]),
    Buffer.from(Array.from({ length: 256 }, (_, index) => index)),
  ]) {
    for (const data of new Set([bytes.toString("base64"), bytes.toString("base64").replace(/=+$/, "")])) {
      const file = await f.api.remoteSessions.upload(session.id, { filename: "bytes.png", mime: "image/png", data })
      expect(file).toEqual({ id: fileID, filename: "bytes.png", contentType: "image/png", byteSize: bytes.length })
      const [input, signal] = f.upload.mock.calls.at(-1)!
      expect(input).toEqual({ body: expect.any(Blob), filename: "bytes.png", conversationID: undefined })
      expect(input.body.type).toBe("image/png")
      expect(Buffer.from(await input.body.arrayBuffer())).toEqual(bytes)
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal!.aborted).toBe(false)
      expect(f.responses.at(-1)).toEqual({
        method: "POST", path: `/api/remote/sessions/${session.id}/upload`, status: 201,
      })
    }
  }
  expect(f.network).not.toHaveBeenCalled()
})

it("forwards one-off upload eligibility and prompt selection without changing the session record", async () => {
  const f = setup()
  f.models.mockResolvedValue([model, { ...model, slug: "vision", vision: true }])
  const session = await f.create()
  const input = { filename: "image.png", mime: "image/png" as const, data: "AA==" }
  const file = { id: `lbf_${"0".repeat(26)}`, filename: input.filename, contentType: input.mime, byteSize: 1 }
  f.upload.mockResolvedValue(file)
  await expect(f.api.remoteSessions.upload(session.id, input)).rejects.toMatchObject({ code: "model_no_image_input" })
  for (const oneOffModelSlug of ["", " ", "x".repeat(1025), null, 1]) {
    await expect(f.api.remoteSessions.upload(session.id, { ...input, oneOffModelSlug } as never))
      .rejects.toMatchObject({ code: "invalid_request", status: 400 })
    await expect(f.api.remoteSessions.prompt(session.id, { ...prompt, oneOffModelSlug } as never))
      .rejects.toMatchObject({ code: "invalid_request", status: 400 })
  }
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.turn).not.toHaveBeenCalled()
  expect(await f.api.remoteSessions.upload(session.id, { ...input, oneOffModelSlug: " vision " })).toEqual(file)
  expect(Buffer.from(await f.upload.mock.calls[0][0].body.arrayBuffer())).toEqual(Buffer.from([0]))
  const pending = f.api.remoteSessions.prompt(session.id, {
    ...prompt, attachmentIDs: [file.id], oneOffModelSlug: " vision ",
  })
  const control = await f.started.promise
  expect(f.turn.mock.calls[0][0]).toEqual({
    ...prompt, attachmentIDs: [file.id], oneOffModelSlug: "vision",
    modelSlug: model.slug, effort: "high", conversationID: undefined,
  })
  expect(await f.api.remoteSessions.messages(session.id)).toEqual([])
  control.admit(); await pending
  const settled = deferred<void>()
  const off = f.core.bus.subscribe((event) => {
    if (event.type === "remote.session.changed" && event.properties.sessionID === session.id
      && f.core.remoteSessions.get(session.id).state === "settled") settled.resolve()
  })
  try { control.finish(); await settled.promise } finally { off() }
  expect(await f.api.remoteSessions.get(session.id)).toMatchObject({ modelSlug: model.slug, effort: "high" })
  expect(await f.api.remoteSessions.get(session.id)).not.toHaveProperty("oneOffModelSlug")
  await expect(f.api.remoteSessions.upload(session.id, input)).rejects.toMatchObject({ code: "model_no_image_input" })
  expect(f.upload).toHaveBeenCalledTimes(1)
  expect(f.network).not.toHaveBeenCalled()
})

it("accepts exactly 8 MiB decoded and rejects the next byte before uploading", async () => {
  const f = setup(true), session = await f.create(), bytes = Buffer.alloc(8 * 1024 * 1024, 255)
  const file = { id: `lbf_${"0".repeat(26)}`, filename: "limit.png", contentType: "image/png", byteSize: bytes.length }
  f.upload.mockResolvedValue(file)
  const input = { filename: file.filename, mime: "image/png" as const, data: bytes.toString("base64") }
  for (const data of [input.data, input.data.replace(/=+$/, "")]) {
    expect(await f.api.remoteSessions.upload(session.id, { ...input, data })).toEqual(file)
    expect(Buffer.from(await f.upload.mock.calls.at(-1)![0].body.arrayBuffer()).equals(bytes)).toBe(true)
  }
  const oversized = Buffer.alloc(bytes.length + 1, 255).toString("base64")
  expect(oversized.length).toBe(input.data.length)
  await expect(f.api.remoteSessions.upload(session.id, { ...input, data: oversized }))
    .rejects.toMatchObject({ code: "invalid_request", status: 400 })
  expect(f.upload).toHaveBeenCalledTimes(2)
  expect(f.network).not.toHaveBeenCalled()
})

it("rejects malformed upload fields and noncanonical base64 before calling main", async () => {
  const f = setup(true), session = await f.create()
  const input = { filename: "image.png", mime: "image/png", data: "AA==" }
  for (const value of [
    {}, { ...input, filename: "" }, { ...input, filename: " " }, { ...input, filename: "x".repeat(1025) },
    { ...input, mime: "text/plain" }, { ...input, data: null },
    { ...input, conversationID: ids.conversationID }, { ...input, epoch: session.epoch },
    { ...input, origin: CLOUD_URL }, { ...input, url: "https://other.test/image.png" },
    { ...input, token: "private" }, { ...input, body: {} },
    ...["", "A", "A===", "AA=", "AA===", "=AAA", "AA==AA==", " AA==", "AA==\n",
      "A A==", "-w==", "_w==", "AB==", "AB", "AAB=", "AAB", "data:image/png;base64,AA==",
    ].map((data) => ({ ...input, data })),
  ]) await expect(f.api.remoteSessions.upload(session.id, value as never))
    .rejects.toMatchObject({ code: "invalid_request", status: 400 })
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.network).not.toHaveBeenCalled()
})

it("refuses upload for unsupported models and local or foreign session IDs", async () => {
  const input = { filename: "image.png", mime: "image/png" as const, data: "AA==" }
  const unsupported = setup(), plain = await unsupported.create()
  await expect(unsupported.api.remoteSessions.upload(plain.id, input))
    .rejects.toMatchObject({ code: "model_no_image_input" })
  expect(unsupported.upload).not.toHaveBeenCalled()
  const f = setup(true), session = await f.create()
  const local = await f.api.sessions.create({ model: { providerID: "local", modelID: "local" } })
  expect(local.id.split("_")[0]).toBe(session.id.split("_")[0])
  for (const id of [local.id, plain.id, ids.conversationID, "ses_missing", "foreign/id?origin=other"]) {
    await expect(f.api.remoteSessions.upload(id, input)).rejects.toMatchObject({ code: "not_found", status: 404 })
  }
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.network).not.toHaveBeenCalled()
})

it.each(["replace", "logout"] as const)("cancels held uploads on %s before late completion", async (action) => {
  const f = setup(true), session = await f.create()
  const held = deferred<Awaited<ReturnType<CoreRemoteBinding["upload"]>>>(), entered = deferred<void>()
  const file = { id: `lbf_${"0".repeat(26)}`, filename: "image.png", contentType: "image/png", byteSize: 1 }
  const input = { filename: file.filename, mime: "image/png" as const, data: "AA==" }
  f.upload.mockImplementationOnce(() => { entered.resolve(); return held.promise })
  const pending = expect(f.api.remoteSessions.upload(session.id, input))
    .rejects.toMatchObject({ code: "aborted", status: 409 })
  await entered.promise
  await expect(f.api.remoteSessions.upload(session.id, input))
    .rejects.toMatchObject({ code: "session_busy", status: 409 })
  await expect(f.api.remoteSessions.prompt(session.id, prompt))
    .rejects.toMatchObject({ code: "session_busy", status: 409 })
  if (action === "replace") f.replace()
  else expect(await f.api.connection.auth.submit({ action: "logout" })).toMatchObject({ signedIn: false })
  await pending
  expect(f.upload.mock.calls[0][1]!.aborted).toBe(true)
  if (action === "logout") {
    await expect(f.api.remoteSessions.upload(session.id, input))
      .rejects.toMatchObject({ code: "provider_auth_failed", status: 502 })
    f.replace()
  }
  held.resolve(file)
  expect(await f.api.remoteSessions.list()).toEqual([])
  await expect(f.api.remoteSessions.upload(session.id, input))
    .rejects.toMatchObject({ code: "not_found", status: 404 })
  const current = await f.create()
  await expect(f.api.remoteSessions.prompt(current.id, { ...prompt, attachmentIDs: [file.id] }))
    .rejects.toMatchObject({ code: "invalid_request", status: 400 })
  expect(f.upload).toHaveBeenCalledTimes(1)
  expect(f.turn).not.toHaveBeenCalled()
  expect(f.network).not.toHaveBeenCalled()
})

it("keeps uploaded IDs session-owned and supplies conversation IDs from admitted state", async () => {
  const f = setup(true), a = await f.create(), b = await f.create()
  const input = { filename: "image.png", mime: "image/png" as const, data: "AA==" }
  const file = { id: `lbf_${"0".repeat(26)}`, filename: input.filename, contentType: input.mime, byteSize: 1 }
  f.upload.mockResolvedValue(file)
  expect(await f.api.remoteSessions.upload(a.id, input)).toEqual(file)
  await expect(f.api.remoteSessions.prompt(b.id, { ...prompt, attachmentIDs: [file.id] }))
    .rejects.toMatchObject({ code: "invalid_request", status: 400 })
  await expect(f.api.remoteSessions.upload(b.id, input))
    .rejects.toMatchObject({ code: "provider_error", status: 502 })
  await expect(f.api.remoteSessions.prompt(b.id, { ...prompt, attachmentIDs: [file.id] }))
    .rejects.toMatchObject({ code: "invalid_request", status: 400 })
  expect(f.turn).not.toHaveBeenCalled()
  const pending = f.api.remoteSessions.prompt(a.id, { ...prompt, attachmentIDs: [file.id] })
  const control = await f.started.promise
  control.admit()
  await pending
  expect(f.turn.mock.calls[0][0].attachmentIDs).toEqual([file.id])
  const settled = deferred<void>()
  const off = f.core.bus.subscribe((event) => {
    if (event.type === "remote.session.changed" && event.properties.sessionID === a.id
      && f.core.remoteSessions.get(a.id).state === "settled") settled.resolve()
  })
  try { control.finish(); await settled.promise } finally { off() }
  const next = { ...file, id: `lbf_${"1".repeat(26)}`, conversationID: ids.conversationID }
  f.upload.mockResolvedValueOnce(next)
  expect(await f.api.remoteSessions.upload(a.id, input)).toEqual(next)
  expect(f.upload.mock.calls.at(-1)![0].conversationID).toBe(ids.conversationID)
  f.upload.mockResolvedValueOnce({ ...next, conversationID: `cnv_${"1".repeat(26)}` })
  await expect(f.api.remoteSessions.upload(a.id, input))
    .rejects.toMatchObject({ code: "provider_error", status: 502 })
  expect(f.network).not.toHaveBeenCalled()
})

it("validates bounded inputs and isolates actual local and remote records sharing the session ID format", async () => {
  const f = setup(), remote = f.api.remoteSessions
  expect(await remote.models()).toEqual({ epoch: "epoch-1", models: [model] })
  expect(await remote.list()).toEqual([])
  const input = { epoch: "epoch-1", modelSlug: model.slug, effort: "high" as const }
  for (const value of [
    {}, { ...input, effort: true }, { ...input, origin: CLOUD_URL },
    { ...input, token: "private" }, { ...input, conversationID: ids.conversationID },
  ]) await expect(remote.create(value as never)).rejects.toMatchObject({ code: "invalid_request", status: 400 })
  await expect(remote.create({ ...input, epoch: "stale" })).rejects.toMatchObject({ code: "aborted", status: 409 })
  await expect(remote.create({ ...input, modelSlug: "missing" })).rejects.toMatchObject({ code: "model_not_found", status: 404 })
  const session = await remote.create(input)
  expect(await remote.get(session.id)).toEqual(session)
  expect(await remote.list()).toEqual([session])
  expect(await remote.messages(session.id)).toEqual([])
  for (const value of [
    { message: "", attachmentIDs: [] }, { message: "x".repeat(100001), attachmentIDs: [] },
    { ...prompt, token: "private" }, { ...prompt, origin: CLOUD_URL },
    { ...prompt, conversationID: ids.conversationID }, { ...prompt, lastEventID: "1" },
    { ...prompt, attachmentIDs: [`lbf_${"0".repeat(26)}`] },
  ]) await expect(remote.prompt(session.id, value as never)).rejects.toMatchObject({ code: "invalid_request", status: 400 })
  await expect(remote.history(session.id)).rejects.toMatchObject({ code: "invalid_request", status: 400 })
  await expect(remote.detach(session.id)).rejects.toMatchObject({ code: "conflict", status: 409 })
  await expect(remote.resume(session.id)).rejects.toMatchObject({ code: "conflict", status: 409 })
  const local = await f.api.sessions.create({ model: { providerID: "local", modelID: "local" } })
  expect(local.id.split("_")[0]).toBe(session.id.split("_")[0])
  expect(await f.api.sessions.list()).toEqual([local])
  await expect(f.api.sessions.get(session.id)).rejects.toMatchObject({ code: "not_found", status: 404 })
  for (const id of [local.id, ids.conversationID, "ses_missing", "foreign/id?origin=other"]) {
    for (const read of [remote.get, remote.messages, remote.history, remote.detach, remote.resume])
      await expect(read(id)).rejects.toMatchObject({ code: "not_found", status: 404 })
    await expect(remote.prompt(id, prompt)).rejects.toMatchObject({ code: "not_found", status: 404 })
  }
  expect(f.responses).toEqual(expect.arrayContaining([
    { method: "GET", path: "/api/remote/models", status: 200 },
    { method: "GET", path: "/api/remote/sessions", status: 200 },
    { method: "POST", path: "/api/remote/sessions", status: 201 },
    { method: "GET", path: `/api/remote/sessions/${session.id}`, status: 200 },
    { method: "GET", path: `/api/remote/sessions/${session.id}/messages`, status: 200 },
  ]))
  expect(f.turn).not.toHaveBeenCalled()
  expect(f.history).not.toHaveBeenCalled()
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.network).not.toHaveBeenCalled()
})

it("holds admission for headers, returns only the user ID before completion and resumes the original delivery", async () => {
  const f = setup(), session = await f.create(), remote = f.api.remoteSessions
  let acknowledged = false
  const pending = remote.prompt(session.id, prompt).then((value) => { acknowledged = true; return value })
  const control = await f.started.promise
  expect(await remote.messages(session.id)).toEqual([])
  expect(acknowledged).toBe(false)
  await expect(remote.prompt(session.id, prompt)).rejects.toMatchObject({ code: "session_busy", status: 409 })
  control.admit()
  const accepted = await pending
  expect(Object.keys(accepted)).toEqual(["messageID"])
  expect(accepted.messageID).not.toBe(ids.assistantID)
  expect((await remote.messages(session.id))[0]).toMatchObject({ id: accepted.messageID, role: "user" })
  expect((await remote.get(session.id)).state).toBe("streaming")
  expect((await remote.detach(session.id)).state).toBe("detached")
  acknowledged = false
  const replay = remote.resume(session.id).then((value) => { acknowledged = true; return value })
  await control.resumed.promise
  expect(await remote.messages(session.id)).toHaveLength(2)
  expect(acknowledged).toBe(false)
  control.admit()
  expect(await replay).toEqual(accepted)
  expect(f.turn).toHaveBeenCalledTimes(1)
  expect(control.handle.resume).toHaveBeenCalledTimes(1)
  const settled = deferred<void>()
  const off = f.core.bus.subscribe((event) => {
    if (event.type === "remote.session.changed" && event.properties.sessionID === session.id
      && f.core.remoteSessions.get(session.id).state === "settled") settled.resolve()
  })
  try { control.finish(); await settled.promise } finally { off() }
  expect(await remote.history(session.id)).toEqual(historyWindow)
  expect(f.history).toHaveBeenCalledWith(ids.conversationID, expect.any(AbortSignal))
  expect((await remote.get(session.id)).outcome).toMatchObject({ complete: true, partial: false })
  expect(await remote.messages(session.id)).toHaveLength(2)
  expect(f.responses).toEqual(expect.arrayContaining([
    { method: "POST", path: `/api/remote/sessions/${session.id}/prompt`, status: 202 },
    { method: "POST", path: `/api/remote/sessions/${session.id}/detach`, status: 200 },
    { method: "POST", path: `/api/remote/sessions/${session.id}/resume`, status: 202 },
    { method: "GET", path: `/api/remote/sessions/${session.id}/history`, status: 200 },
  ]))
  expect(f.upload).not.toHaveBeenCalled()
  expect(f.network).not.toHaveBeenCalled()
})

it("sanitizes host errors and refuses admission without inserting messages", async () => {
  const f = setup(), session = await f.create()
  const rejected = expect(f.api.remoteSessions.prompt(session.id, prompt)).rejects.toMatchObject({
    code: "provider_rate_limited", status: 429,
  })
  const control = await f.started.promise
  control.refuse()
  await rejected
  expect(await f.api.remoteSessions.messages(session.id)).toEqual([])
  expect((await f.api.remoteSessions.get(session.id)).state).toBe("ready")
  f.models.mockRejectedValueOnce(new Error("private token and backend address"))
  const response = await f.app.fetch(new Request("http://local/api/remote/models"))
  expect(response.status).toBe(502)
  const body = await response.json()
  expect(body).toMatchObject({ error: { code: "provider_error" } })
  expect(JSON.stringify(body)).not.toContain("private")
  expect(f.network).not.toHaveBeenCalled()
})

it("rejects stale catalogue work and old records after epoch replacement", async () => {
  const f = setup(), session = await f.create()
  const held = deferred<RemoteModel[]>(), entered = deferred<void>()
  f.models.mockImplementationOnce(() => { entered.resolve(); return held.promise })
  const stale = expect(f.api.remoteSessions.models()).rejects.toMatchObject({ code: "aborted", status: 409 })
  await entered.promise
  f.replace()
  await stale
  held.resolve([model])
  expect(await f.api.remoteSessions.list()).toEqual([])
  await expect(f.api.remoteSessions.get(session.id)).rejects.toMatchObject({ code: "not_found", status: 404 })
  await expect(f.api.remoteSessions.create({
    epoch: session.epoch, modelSlug: model.slug, effort: "high",
  })).rejects.toMatchObject({ code: "aborted", status: 409 })
  expect((await f.api.remoteSessions.models()).epoch).not.toBe(session.epoch)
  expect(f.network).not.toHaveBeenCalled()
})

it("logout cancels held admission and emits the unchanged removal event through SSE", async () => {
  const f = setup(), session = await f.create()
  const pending = expect(f.api.remoteSessions.prompt(session.id, prompt)).rejects.toMatchObject({ code: "aborted", status: 409 })
  const control = await f.started.promise
  const controller = new AbortController()
  const response = await f.app.fetch(new Request("http://local/api/events", { signal: controller.signal }))
  const stream = parseSSE(response.body!, controller.signal)
  const removed = stream.next()
  try {
    expect(await f.api.connection.auth.submit({ action: "logout" })).toMatchObject({ signedIn: false })
    await pending
    expect((await removed).value).toEqual({
      type: "remote.session.removed", properties: { sessionID: session.id, epoch: session.epoch },
    })
    await expect(f.api.remoteSessions.get(session.id)).rejects.toMatchObject({ code: "provider_auth_failed", status: 502 })
    expect(control.handle.detach).toHaveBeenCalled()
    expect(() => control.admit()).toThrow(CortexError)
    expect(await f.api.sessions.list()).toEqual([])
    expect(f.network).not.toHaveBeenCalled()
  } finally {
    controller.abort()
    await stream.return(undefined)
  }
})
