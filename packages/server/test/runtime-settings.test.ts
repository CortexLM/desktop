import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createClient, parseSSE } from "@cortex/client"
import { CortexError, memoryCredentials, type Core, type CoreOptions } from "@cortex/core"
import type { Event } from "@cortex/schema"
import { testCore, toolCall, type Turn } from "../../core/test/helpers"
import { createServer } from "../src/index"

const model = { providerID: "fake", modelID: "reasoner" }
const prompt = { parts: [{ type: "text" as const, text: "hello" }] }
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}
type Payload = { messages: { role: string; content: string }[]; tools?: { function: { name: string } }[]; max_tokens?: number }
const system = (request: Payload) => request.messages.find((m) => m.role === "system")!.content

describe("persistent Memory pause", () => {
  const cores = new Set<Core>(), dirs: string[] = []
  const close = async (core: Core) => { cores.delete(core); await core.close() }
  afterEach(async () => {
    vi.restoreAllMocks()
    for (const core of cores) await close(core)
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  const open = (options: Partial<CoreOptions> = {}, turns: Turn[] = []) => {
    const requests: Payload[] = []
    const core = testCore("http://provider.test/v1", { ...options, fetch: async (input, init) => {
      const request = new Request(input, init)
      expect(request.url).toBe("http://provider.test/v1/chat/completions")
      const body = await request.json()
      requests.push(body)
      const turn = turns.shift() ?? { deltas: [{ content: "done" }], finish: "stop" }
      const chunk = (delta: unknown, finish: string | null = null) => `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
      return new Response(chunk({ role: "assistant" }) + turn.deltas.map((delta) => chunk(delta)).join("") + chunk({}, turn.finish) + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
    } })
    cores.add(core)
    const app = createServer(core)
    const api = createClient({ baseUrl: "http://local", fetch: (request) => app.fetch(request) })
    return { core, app, api, requests }
  }

  it("strictly validates writes, defaults only absent data and emits committed changes through SSE", async () => {
    const { core, app, api } = open()
    expect(await api.settings.get()).toEqual({ memoryEnabled: true })
    expect(core.storage.getDoc("settings", "runtime")).toBeUndefined()
    expect(await api.bots.list()).toEqual([])
    const changes: unknown[] = []
    core.bus.on("settings.changed", (event) => changes.push({ event, saved: core.storage.getDoc("settings", "runtime") }))
    const invalid = [null, true, false, "false", [], {}, { memoryEnabled: null }, { memoryEnabled: "false" }, { memoryEnabled: 0 }, { memoryEnabled: false, unknown: true }, { memoryEnabled: false, initializeOnly: false }, { memoryEnabled: false, initializeOnly: null }, { memoryEnabled: false, initializeOnly: "true" }]
    for (const input of invalid) {
      await expect(api.settings.update(input as never)).rejects.toMatchObject({ code: "invalid_request", status: 400 })
      expect(() => core.settings.update(input)).toThrow()
    }
    expect(core.storage.getDoc("settings", "runtime")).toBeUndefined()
    expect(changes).toEqual([])
    const ctrl = new AbortController()
    const response = await app.fetch(new Request("http://local/api/events", { signal: ctrl.signal }))
    const stream = parseSSE(response.body!, ctrl.signal)
    const event = stream.next()
    try {
      expect(await api.settings.update({ memoryEnabled: false })).toEqual({ memoryEnabled: false })
      expect((await event).value).toEqual({ type: "settings.changed", properties: {} })
    } finally { ctrl.abort(); await stream.return(undefined) }
    await api.settings.update({ memoryEnabled: false })
    expect(changes).toEqual([{ event: { type: "settings.changed", properties: {} }, saved: { memoryEnabled: false } }])
    expect(core.storage.events("global")).toEqual([])
    expect(await api.settings.update({ memoryEnabled: true })).toEqual({ memoryEnabled: true })
    expect(changes).toHaveLength(2)
  })

  it("preserves both Bots' notes exactly through pause/resume and two SQLite reopens; manual edits remain available", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "cortex-memory-"))
    dirs.push(dataDir)
    let h = open({ dataDir })
    const first = await h.api.bots.create({ name: "First", model })
    const second = await h.api.bots.create({ name: "Second", model })
    const notes = [await h.api.bots.memory.add(first.id, "First note"), await h.api.bots.memory.add(second.id, "Second note")]
    await h.api.settings.update({ memoryEnabled: false })
    const manual = await h.api.bots.memory.add(first.id, "Added while paused")
    expect(await h.api.bots.memory.list(first.id)).toEqual(expect.arrayContaining([notes[0], manual]))
    await h.api.bots.memory.delete(first.id, manual.id)
    await close(h.core)
    h = open({ dataDir })
    expect(await h.api.settings.get()).toEqual({ memoryEnabled: false })
    for (const note of notes) expect(await h.api.bots.memory.list(note.botID)).toEqual([note])
    expect(await h.api.settings.update({ memoryEnabled: true, initializeOnly: true })).toEqual({ memoryEnabled: false })
    await h.api.settings.update({ memoryEnabled: true })
    await close(h.core)
    h = open({ dataDir })
    expect(await h.api.settings.get()).toEqual({ memoryEnabled: true })
    for (const note of notes) expect((await h.api.bots.get(note.botID)).memory).toEqual([note])
    expect(h.core.storage.getDoc("settings", "runtime")).toEqual({ memoryEnabled: true })
  })

  it("initializes absent settings atomically; competing migration and later legacy values cannot replace saved choices", async () => {
    for (const first of [false, true]) {
      const { core, api } = open()
      const changes: Event[] = []
      core.bus.on("settings.changed", (event) => changes.push(event))
      expect(await Promise.all([
        api.settings.update({ memoryEnabled: first, initializeOnly: true }),
        api.settings.update({ memoryEnabled: !first, initializeOnly: true }),
      ])).toEqual([{ memoryEnabled: first }, { memoryEnabled: first }])
      expect(core.storage.getDoc("settings", "runtime")).toEqual({ memoryEnabled: first })
      expect(changes).toHaveLength(1)
      await api.settings.update({ memoryEnabled: !first })
      expect(await api.settings.update({ memoryEnabled: first, initializeOnly: true })).toEqual({ memoryEnabled: !first })
      expect(changes).toHaveLength(2)
    }
    const { api } = open()
    expect(await Promise.all([
      api.settings.update({ memoryEnabled: true }),
      api.settings.update({ memoryEnabled: false, initializeOnly: true }),
    ])).toEqual([{ memoryEnabled: true }, { memoryEnabled: true }])
  })

  it("rolls back refused writes, leaves corrupt documents untouched and refuses Bot admission before catalog work", async () => {
    const { core, api } = open()
    const bot = await api.bots.create({ name: "Preserved", model })
    const note = await api.bots.memory.add(bot.id, "Kept")
    const changes: Event[] = []
    core.bus.on("settings.changed", (event) => changes.push(event))
    core.storage.db.exec("CREATE TEMP TRIGGER refuse_settings_insert AFTER INSERT ON doc WHEN NEW.kind = 'settings' AND NEW.id = 'runtime' BEGIN SELECT RAISE(ABORT, 'private disk failure'); END;")
    await expect(api.settings.update({ memoryEnabled: false, initializeOnly: true })).rejects.toMatchObject({ code: "internal", status: 500, message: "Internal error" })
    expect(await api.settings.get()).toEqual({ memoryEnabled: true })
    expect(core.storage.getDoc("settings", "runtime")).toBeUndefined()
    expect(changes).toEqual([])
    core.storage.db.exec("DROP TRIGGER refuse_settings_insert")
    await api.settings.update({ memoryEnabled: false })
    core.storage.db.exec("CREATE TEMP TRIGGER refuse_settings_update AFTER UPDATE ON doc WHEN NEW.kind = 'settings' AND NEW.id = 'runtime' BEGIN SELECT RAISE(ABORT, 'private disk failure'); END;")
    await expect(api.settings.update({ memoryEnabled: true })).rejects.toMatchObject({ code: "internal", status: 500, message: "Internal error" })
    expect(await api.settings.get()).toEqual({ memoryEnabled: false })
    expect(changes).toHaveLength(1)
    core.storage.db.exec("DROP TRIGGER refuse_settings_update")
    const session = await api.bots.createSession(bot.id)
    const lookup = vi.spyOn(core.catalog, "model")
    for (const raw of ["null", "{}", '{"memoryEnabled":"false"}', '{"memoryEnabled":false,"initializeOnly":true}', "{"]) {
      core.storage.db.prepare("UPDATE doc SET data = ? WHERE kind = 'settings' AND id = 'runtime'").run(raw)
      expect(() => core.settings.get()).toThrow(CortexError)
      await expect(api.settings.get()).rejects.toMatchObject({ code: "internal", status: 500 })
      for (const initializeOnly of [undefined, true] as const)
        await expect(api.settings.update({ memoryEnabled: true, initializeOnly })).rejects.toMatchObject({ code: "internal", status: 500 })
      await expect(api.sessions.prompt(session.id, prompt)).rejects.toMatchObject({ code: "internal", status: 500 })
      expect(core.sessions.isBusy(session.id)).toBe(false)
      expect(core.storage.db.prepare("SELECT data FROM doc WHERE kind = 'settings' AND id = 'runtime'").get()).toMatchObject({ data: raw })
    }
    expect(lookup).not.toHaveBeenCalled()
    expect(await api.sessions.messages(session.id)).toEqual([])
    expect(await api.bots.memory.list(bot.id)).toEqual([note])
    expect(changes).toHaveLength(1)
  })

  it("gates actual system payloads per Bot, preserves history/persona/tools and adds no memory to ordinary Chat", async () => {
    const { core, api, requests } = open({}, [{ deltas: [{ content: "Previously shared first-note" }], finish: "stop" }])
    const first = await api.bots.create({ name: "First", persona: "First persona", model, tools: { allow: ["task"] } })
    const second = await api.bots.create({ name: "Second", persona: "Second persona", model })
    await api.bots.memory.add(first.id, "first-note")
    await api.bots.memory.add(second.id, "second-note")
    const a = await api.bots.createSession(first.id), b = await api.bots.createSession(second.id)
    await core.sessions.promptAndWait(a.id, prompt)
    const saved = await api.sessions.messages(a.id)
    await core.sessions.promptAndWait(b.id, prompt)
    expect(system(requests[0])).toContain("first-note")
    expect(system(requests[0])).not.toContain("second-note")
    expect(system(requests[1])).toContain("second-note")
    expect(system(requests[1])).not.toContain("first-note")
    await api.settings.update({ memoryEnabled: false })
    expect(await api.sessions.messages(a.id)).toEqual(saved)
    const read = vi.spyOn(core.storage, "listDocs")
    await core.sessions.promptAndWait(a.id, prompt)
    await core.sessions.promptAndWait(b.id, prompt)
    expect(read.mock.calls.some(([kind]) => kind === "memory")).toBe(false)
    read.mockRestore()
    expect(system(requests[2])).toContain("First persona")
    expect(requests[2].tools?.map((t) => t.function.name)).toEqual(["task"])
    expect(system(requests[3])).toContain("Second persona")
    for (const request of requests.slice(2)) expect(system(request)).not.toContain("<memory>")
    expect(requests[2].messages.some((m) => m.role === "assistant" && m.content.includes("first-note"))).toBe(true)
    await api.settings.update({ memoryEnabled: true })
    await core.sessions.promptAndWait(a.id, prompt)
    expect(system(requests[4])).toContain("first-note")
    const chat = await api.sessions.create({ model })
    await core.sessions.promptAndWait(chat.id, prompt)
    expect(system(requests[5])).not.toMatch(/<memory>|First persona|Second persona|first-note|second-note/)
    expect(await api.bots.memory.list(first.id)).toHaveLength(1)
    expect(await api.bots.memory.list(second.id)).toHaveLength(1)
  })

  it("snapshots notes and restrictions before async catalog/key lookup; later edits/toggles affect only future turns", async () => {
    const keyGate = deferred(), keyEntered = deferred()
    let holdKey = false
    const { core, api, requests } = open({ credentials: { ...memoryCredentials(), get: async () => {
      if (holdKey) { holdKey = false; keyEntered.resolve(); await keyGate.promise }
      return "sk-test-1234"
    } } }, [
      { deltas: [toolCall("denied-snapshot", "task", { description: "Denied", prompt: "run", agent: "general" })], finish: "tool_calls" },
      { deltas: [{ content: "done" }], finish: "stop" },
    ])
    const bot = await api.bots.create({ name: "Snapshot", persona: "Original persona", model, tools: { allow: ["task"] }, permission: [{ tool: "task", action: "deny" }] })
    const note = await api.bots.memory.add(bot.id, "Original note")
    const session = await api.bots.createSession(bot.id)
    const gate = deferred(), lookup = core.catalog.model.bind(core.catalog)
    const held = vi.spyOn(core.catalog, "model").mockImplementationOnce(async (...args) => { await gate.promise; return lookup(...args) })
    const pending = core.sessions.prompt(session.id, prompt)
    try {
      expect(core.sessions.isBusy(session.id)).toBe(true)
      await api.settings.update({ memoryEnabled: false })
      await api.bots.memory.delete(bot.id, note.id)
      await api.bots.memory.add(bot.id, "Replacement note")
      await api.bots.update(bot.id, { persona: "Replacement persona", tools: { allow: [] }, permission: [] })
    } finally { gate.resolve(); held.mockRestore() }
    await (await pending).done
    expect(system(requests[0])).toContain("Original note")
    expect(system(requests[0])).toContain("Original persona")
    expect(system(requests[0])).not.toContain("Replacement")
    expect(requests[0].tools?.map((t) => t.function.name)).toEqual(["task"])
    expect(core.sessions.list({ parentID: session.id })).toEqual([])
    expect(core.sessions.messages(session.id).flatMap((m) => m.parts).find((p) => p.type === "tool")).toMatchObject({ state: { status: "error", error: "Tool task is denied for general" } })
    holdKey = true
    const paused = core.sessions.prompt(session.id, prompt)
    try { await keyEntered.promise; await api.settings.update({ memoryEnabled: true }) }
    finally { keyGate.resolve() }
    await (await paused).done
    expect(system(requests[2])).toContain("Replacement persona")
    expect(system(requests[2])).not.toContain("<memory>")
    expect(requests[2].tools ?? []).toEqual([])
    await core.sessions.promptAndWait(session.id, prompt)
    expect(system(requests[3])).toContain("Replacement note")
    expect(system(requests[3])).not.toContain("Original note")
  })

  it("counts the reserved memory snapshot for admission and output, refuses before prompt writes, admits while paused", async () => {
    const { core, api, requests } = open()
    const bot = await api.bots.create({ name: "Small", model: { providerID: "fake", modelID: "text-only" } })
    const large = await api.bots.memory.add(bot.id, "x".repeat(200))
    const refused = await api.bots.createSession(bot.id)
    await expect(api.sessions.prompt(refused.id, prompt)).rejects.toMatchObject({ code: "context_window_exceeded", status: 422 })
    expect(await api.sessions.messages(refused.id)).toEqual([])
    expect(core.sessions.isBusy(refused.id)).toBe(false)
    expect(requests).toEqual([])
    await api.settings.update({ memoryEnabled: false })
    await core.sessions.promptAndWait(refused.id, prompt)
    expect(requests[0].max_tokens).toBe(44) // hello: 2 tokens; "You are Small.": 4.
    await api.bots.memory.delete(bot.id, large.id)
    await api.bots.memory.add(bot.id, "short-note")
    await api.settings.update({ memoryEnabled: true })
    const limited = await api.bots.createSession(bot.id)
    const gate = deferred(), lookup = core.catalog.model.bind(core.catalog)
    const held = vi.spyOn(core.catalog, "model").mockImplementationOnce(async (...args) => { await gate.promise; return lookup(...args) })
    const pending = core.sessions.prompt(limited.id, prompt)
    try {
      await api.settings.update({ memoryEnabled: false })
      await api.bots.memory.add(bot.id, "x".repeat(1000))
    } finally { gate.resolve(); held.mockRestore() }
    await (await pending).done
    expect(system(requests[1])).toContain("short-note")
    expect(system(requests[1])).not.toContain("x".repeat(1000))
    expect(requests[1].max_tokens).toBe(18) // 120 characters of reserved Bot context: 30 tokens, plus hello: 2.
    await api.settings.update({ memoryEnabled: true })
    const retained = await api.sessions.messages(limited.id)
    await expect(api.sessions.prompt(limited.id, prompt)).rejects.toMatchObject({ code: "context_window_exceeded" })
    expect(await api.sessions.messages(limited.id)).toEqual(retained)
    expect(requests).toHaveLength(2)
  })

  it("keeps the same global gate for delegated children and routines; paused Bot permissions still deny tools", async () => {
    const turns: Turn[] = []
    const { core, api, requests } = open({}, turns)
    const bot = await api.bots.create({ name: "Worker", model })
    await api.bots.memory.add(bot.id, "worker-note")
    const routine = await api.tasks.create({ title: "Routine", prompt: "run", model, botID: bot.id, schedule: { type: "daily", time: "09:00" } })
    for (const memoryEnabled of [true, false]) {
      await api.settings.update({ memoryEnabled })
      turns.push({ deltas: [toolCall("child", "task", { description: "Child", prompt: "run", agent: "general" })], finish: "tool_calls" }, { deltas: [{ content: "child done" }], finish: "stop" }, { deltas: [{ content: "parent done" }], finish: "stop" })
      const parent = await api.bots.createSession(bot.id)
      const start = requests.length
      expect(await core.sessions.promptAndWait(parent.id, prompt)).toBe("parent done")
      const children = core.sessions.list({ parentID: parent.id })
      expect(children).toHaveLength(1)
      expect(children[0]).toMatchObject({ botID: bot.id, kind: "bot" })
      expect(requests[start + 1].tools?.map((t) => t.function.name) ?? []).not.toContain("task")
      const run = await core.scheduler.run(routine.id)
      expect(run.status).toBe("success")
      expect(core.sessions.get(run.sessionID!)).toMatchObject({ botID: bot.id, kind: "bot" })
      for (const request of requests.slice(start)) expect(system(request).includes("worker-note")).toBe(memoryEnabled)
    }
    await api.bots.update(bot.id, { permission: [{ tool: "task", action: "deny" }] })
    turns.push({ deltas: [toolCall("denied", "task", { description: "Denied", prompt: "run", agent: "general" })], finish: "tool_calls" })
    const denied = await api.bots.createSession(bot.id)
    await core.sessions.promptAndWait(denied.id, prompt)
    expect(core.sessions.list({ parentID: denied.id })).toEqual([])
    expect(core.sessions.messages(denied.id).flatMap((m) => m.parts).find((p) => p.type === "tool")).toMatchObject({ state: { status: "error", error: "Tool task is denied for general" } })
  })
})
