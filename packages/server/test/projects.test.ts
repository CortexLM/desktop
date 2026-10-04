import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createClient } from "@cortex/client"
import type { Core } from "@cortex/core"
import { newId, type Event, type Message, type Session } from "@cortex/schema"
import { fakeOpenAI, testCore } from "../../core/test/helpers"
import { createServer } from "../src/index"

const model = { providerID: "fake", modelID: "reasoner" }
const text = { parts: [{ type: "text" as const, text: "hello" }] }
const client = (core: Core) => {
  const app = createServer(core)
  return createClient({ baseUrl: "http://local", fetch: (request) => app.fetch(request) })
}
const json = (method: string, path: string, body?: unknown) =>
  new Request(`http://local${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

describe("local Projects contract", () => {
  const cleanups: (() => void | Promise<void>)[] = []
  afterEach(async () => {
    vi.restoreAllMocks()
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  })
  const memory = (url = "http://127.0.0.1:9/v1") => {
    const core = testCore(url)
    cleanups.push(() => core.close())
    return core
  }

  it("persists CRUD and exact membership through two SQLite reopens using the typed client", async () => {
    const provider = await fakeOpenAI([])
    cleanups.push(provider.close)
    const dataDir = mkdtempSync(join(tmpdir(), "cortex-projects-"))
    let core = testCore(provider.url, { dataDir })
    cleanups.push(async () => { await core.close(); rmSync(dataDir, { recursive: true, force: true }) })
    let api = client(core)
    const changes: Event[] = []
    core.bus.subscribe((event) => { if (event.type.startsWith("project.")) changes.push(event) })
    expect(await api.projects.list()).toEqual([])
    const first = await api.projects.create({ name: "  Same name  " })
    const second = await api.projects.create({ name: "Same name", icon: "rocket", color: "#FF6A13", instructions: "Line one\nLine two" })
    expect(first).toMatchObject({ name: "Same name", icon: "calendar", color: "#8448FF", instructions: "" })
    expect(first.id).not.toBe(second.id)
    expect(first.id).toMatch(/^prj_/)
    const root = await api.sessions.create({ model, projectID: first.id, title: "Retained chat" })
    const child = await api.sessions.create({ model, parentID: root.id })
    const ungrouped = await api.sessions.create({ model })
    await core.sessions.promptAndWait(root.id, text)
    const savedRoot = await api.sessions.get(root.id)
    const transcript = await api.sessions.messages(root.id)
    expect(child).not.toHaveProperty("projectID")
    expect((await api.sessions.list({ projectID: first.id })).map((s) => s.id)).toEqual([root.id])
    expect((await api.sessions.list()).map((s) => s.id)).toContain(ungrouped.id)
    await core.close()
    core = testCore(provider.url, { dataDir }); api = client(core)
    expect(await api.projects.get(first.id)).toEqual(first)
    expect(await api.projects.get(second.id)).toEqual(second)
    expect(await api.sessions.get(root.id)).toEqual(savedRoot)
    expect(await api.sessions.messages(root.id)).toEqual(transcript)
    const edited = await api.projects.update(second.id, { name: "Renamed", instructions: "New\ninstructions" })
    expect(edited).toMatchObject({ icon: "rocket", color: "#FF6A13", time: { created: second.time.created } })
    await api.sessions.update(root.id, { projectID: second.id })
    expect(await api.sessions.list({ projectID: first.id })).toEqual([])
    expect((await api.sessions.update(root.id, { projectID: null }))).not.toHaveProperty("projectID")
    const retained = await api.sessions.update(root.id, { projectID: first.id })
    delete retained.projectID
    expect(await api.projects.delete(first.id)).toEqual({ ok: true })
    await core.close()
    core = testCore(provider.url, { dataDir }); api = client(core)
    expect(await api.projects.list()).toEqual([edited])
    expect(await api.sessions.get(root.id)).toEqual(retained)
    expect(await api.sessions.messages(root.id)).toEqual(transcript)
    expect(await api.sessions.get(child.id)).toEqual(child)
    await expect(api.projects.get(first.id)).rejects.toMatchObject({ code: "not_found", status: 404 })
    expect(changes.map((event) => event.type)).toEqual(["project.changed", "project.changed"])
    expect(core.storage.events(first.id)).toEqual([{ seq: 1, type: "project.deleted", data: { projectID: first.id } }])
  })

  it("validates every mutation, opaque ID and root-only membership without partial writes", async () => {
    const core = memory(), api = client(core), app = createServer(core)
    const created = await app.fetch(json("POST", "/api/projects", { name: "Valid" }))
    expect(created.status).toBe(201)
    const project = await created.json()
    for (const fields of [{ name: " " }, { name: "x".repeat(49) }, { instructions: "x".repeat(4001) }, { icon: "bad" }, { color: "red" }, { id: "owned" }, { time: { created: 1, updated: 1 } }, { directory: "/private" }, { key: "private" }]) {
      for (const [method, path, body] of [["POST", "/api/projects", { name: "Valid", ...fields }], ["PATCH", `/api/projects/${project.id}`, fields]] as const) {
        const response = await app.fetch(json(method, path, body))
        expect(response.status).toBe(400)
        expect((await response.json()).error.code).toBe("invalid_request")
      }
    }
    expect(await api.projects.get(project.id)).toEqual(project)
    expect(await api.projects.list()).toHaveLength(1)
    expect(() => core.projects.create({ name: "bad", time: {} })).toThrow()
    expect(() => core.projects.get("")).toThrow()
    expect(() => core.projects.get("x".repeat(101))).toThrow()
    for (const operation of [api.projects.get("missing"), api.projects.update("missing", { name: "New" }), api.projects.delete("missing"), api.sessions.list({ projectID: "missing" })])
      await expect(operation).rejects.toMatchObject({ code: "not_found", status: 404 })
    for (const method of ["GET", "PATCH", "DELETE"])
      expect((await app.fetch(json(method, `/api/projects/${"x".repeat(101)}`, method === "PATCH" ? {} : undefined))).status).toBe(400)
    const root = await api.sessions.create({ model, projectID: project.id })
    const child = await api.sessions.create({ model, parentID: root.id })
    const code = await api.sessions.create({ model, kind: "code" })
    const bot = await api.sessions.create({ model, botID: "bot-local" })
    for (const fields of [{ kind: "code" }, { kind: "bot" }, { botID: "bot-local" }, { parentID: root.id }]) {
      const response = await app.fetch(json("POST", "/api/sessions", { model, projectID: project.id, ...fields }))
      expect(response.status).toBe(400)
    }
    for (const session of [child, code, bot]) {
      await expect(api.sessions.update(session.id, { projectID: project.id })).rejects.toMatchObject({ code: "invalid_request", status: 400 })
      expect(await api.sessions.update(session.id, { projectID: null })).toEqual(session)
    }
    await expect(api.sessions.create({ model, projectID: "missing" })).rejects.toMatchObject({ code: "not_found" })
    await expect(api.sessions.update(root.id, { projectID: "missing", title: "Must not save" })).rejects.toMatchObject({ code: "not_found" })
    expect(() => core.sessions.update(root.id, { parentID: child.id })).toThrow()
    expect(() => core.sessions.update(root.id, { projectID: 1 })).toThrow()
    expect(await api.sessions.get(root.id)).toEqual(root)
    const boundary = await api.projects.update(project.id, { name: "x".repeat(48), instructions: "x".repeat(4000) })
    expect(boundary.instructions).toHaveLength(4000)
    const write = vi.spyOn(core.storage, "putDoc").mockImplementationOnce(() => { throw new Error("private disk failure") })
    const failed = await app.fetch(json("PATCH", `/api/projects/${project.id}`, { instructions: "lost" }))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: { code: "internal", message: "Internal error" } })
    write.mockRestore()
    expect(await api.projects.get(project.id)).toEqual(boundary)
  })

  it("orders tied project timestamps by ID and refuses a generated ID collision", () => {
    const core = memory()
    const now = Date.now()
    const clock = vi.spyOn(Date, "now").mockReturnValue(now)
    const first = core.projects.create({ name: "First" })
    const second = core.projects.create({ name: "Second" })
    expect(core.projects.list().map((p) => p.id)).toEqual([first.id, second.id])
    clock.mockReturnValue(now + 1)
    const updated = core.projects.update(second.id, { instructions: "updated" })
    expect(core.projects.list().map((p) => p.id)).toEqual([second.id, first.id])
    const existing = core.projects.get(first.id)
    const read = core.storage.getDoc.bind(core.storage)
    vi.spyOn(core.storage, "getDoc").mockImplementation((kind, id) => kind === "project" ? existing as never : read(kind, id) as never)
    const put = vi.spyOn(core.storage, "putDoc")
    expect(() => core.projects.create({ name: "Collision" })).toThrow(expect.objectContaining({ code: "conflict" }))
    expect(put).not.toHaveBeenCalled()
    expect(core.projects.list()).toEqual([updated, existing])
  })

  it("deletes and detaches atomically, preserving messages/model/times; SQL failure rolls back the event too", async () => {
    const core = memory(), api = client(core), app = createServer(core)
    const project = await api.projects.create({ name: "Remove grouping" })
    const other = await api.projects.create({ name: "Keep grouping" })
    const roots = await Promise.all([api.sessions.create({ model, projectID: project.id }), api.sessions.create({ model, projectID: project.id })])
    const child = await api.sessions.create({ model, parentID: roots[0].id })
    const unrelated = await api.sessions.create({ model, projectID: other.id })
    for (const session of [...roots, child]) {
      const message: Message = { id: newId("message"), sessionID: session.id, role: "user", time: { created: 1234 }, model, usage: { input: 0, output: 0, reasoning: 0, cost: 0 } }
      core.bus.publish("message.updated", { message })
      core.bus.publish("part.updated", { part: { id: newId("part"), sessionID: session.id, messageID: message.id, type: "text", text: `Retain ${session.id}` } })
    }
    const rows = () => core.storage.db.prepare("SELECT * FROM session ORDER BY id").all()
    const before = rows()
    const messages = [...roots, child].map((s) => core.sessions.messages(s.id))
    const history = roots.map((s) => core.storage.events(s.id))
    const observed: Event[] = []
    core.bus.subscribe((event) => observed.push(event))
    core.storage.db.exec("CREATE TEMP TRIGGER refuse_project_detach AFTER UPDATE OF data ON session BEGIN SELECT RAISE(ABORT, 'private injected failure'); END;")
    const refused = await app.fetch(json("DELETE", `/api/projects/${project.id}`))
    expect(refused.status).toBe(500)
    expect(await refused.json()).toEqual({ error: { code: "internal", message: "Internal error" } })
    expect(await api.projects.get(project.id)).toEqual(project)
    expect(rows()).toEqual(before)
    expect(core.storage.events(project.id)).toEqual([])
    expect(observed).toEqual([])
    core.storage.db.exec("DROP TRIGGER refuse_project_detach")
    expect(await api.projects.delete(project.id)).toEqual({ ok: true })
    expect(observed).toEqual([{ type: "project.deleted", properties: { projectID: project.id } }])
    for (const root of roots) {
      const expected: Session = { ...root }; delete expected.projectID
      expect(await api.sessions.get(root.id)).toEqual(expected)
    }
    expect(await api.sessions.get(child.id)).toEqual(child)
    expect(await api.sessions.get(unrelated.id)).toEqual(unrelated)
    expect(rows()).toEqual(before.map((row) => {
      const data = JSON.parse(row.data as string)
      if (data.projectID === project.id) delete data.projectID
      return { ...row, data: JSON.stringify(data) }
    }))
    expect([...roots, child].map((s) => core.sessions.messages(s.id))).toEqual(messages)
    expect(roots.map((s) => core.storage.events(s.id))).toEqual(history)
    expect(core.storage.events(project.id)).toEqual([{ seq: 1, type: "project.deleted", data: { projectID: project.id } }])
    await expect(api.projects.delete(project.id)).rejects.toMatchObject({ code: "not_found" })
    expect(core.storage.events(project.id)).toHaveLength(1)
  })

  it("blocks root/descendant membership and deletion during reserved admission and running turns", async () => {
    const provider = await fakeOpenAI([])
    cleanups.push(provider.close)
    const core = memory(provider.url), api = client(core)
    const project = await api.projects.create({ name: "Busy" })
    const target = await api.projects.create({ name: "Target" })
    const root = await api.sessions.create({ model, projectID: project.id })
    const child = await api.sessions.create({ model, parentID: root.id, agent: "general" })
    const grandchild = await api.sessions.create({ model, parentID: child.id, agent: "explore" })
    for (const session of [root, child, grandchild]) {
      const admission = deferred(), running = deferred(), entered = deferred()
      const lookup = core.catalog.model.bind(core.catalog)
      const held = vi.spyOn(core.catalog, "model").mockImplementationOnce(async (...args) => { await admission.promise; return lookup(...args) })
      core.plugins.register("hold-project-turn", { "chat.params": async () => { entered.resolve(); await running.promise } })
      const pending = core.sessions.prompt(session.id, text)
      let done: Promise<void> | undefined
      const refuse = async () => {
        await expect(api.projects.delete(project.id)).rejects.toMatchObject({ code: "session_busy", status: 409 })
        await expect(api.sessions.update(root.id, { projectID: target.id })).rejects.toMatchObject({ code: "session_busy", status: 409 })
        await expect(api.sessions.update(root.id, { projectID: null })).rejects.toMatchObject({ code: "session_busy", status: 409 })
        expect(core.storage.events(project.id)).toEqual([])
      }
      try {
        expect(core.sessions.isBusy(session.id)).toBe(true)
        await refuse()
        expect(await api.sessions.update(root.id, { title: "Allowed while busy", agent: "plan", model })).toMatchObject({ title: "Allowed while busy", projectID: project.id })
        admission.resolve()
        done = (await pending).done
        await entered.promise
        await refuse()
      } finally {
        admission.resolve(); running.resolve(); held.mockRestore()
        await (done ?? (await pending).done)
      }
    }
    expect((await api.sessions.update(root.id, { projectID: target.id })).projectID).toBe(target.id)
    expect(await api.projects.delete(target.id)).toEqual({ ok: true })
    expect(await api.sessions.get(root.id)).not.toHaveProperty("projectID")
  })

  it("snapshots instructions before lookup, inherits current root membership and budgets both admission and output", async () => {
    const provider = await fakeOpenAI([])
    cleanups.push(provider.close)
    const core = memory(provider.url), api = client(core)
    const project = await api.projects.create({ name: "Context", instructions: "First project rule" })
    const target = await api.projects.create({ name: "Other", instructions: "Other project rule" })
    const root = await api.sessions.create({ model, projectID: project.id })
    const child = await api.sessions.create({ model, parentID: root.id, agent: "general" })
    const grandchild = await api.sessions.create({ model, parentID: child.id, agent: "explore" })
    const gate = deferred(), lookup = core.catalog.model.bind(core.catalog)
    const held = vi.spyOn(core.catalog, "model").mockImplementationOnce(async (...args) => { await gate.promise; return lookup(...args) })
    const pending = core.sessions.prompt(grandchild.id, text)
    try { await api.projects.update(project.id, { instructions: "Second project rule" }) }
    finally { gate.resolve(); held.mockRestore() }
    await (await pending).done
    const system = (index: number): string => provider.requests[index].messages.find((m: { role: string }) => m.role === "system").content
    expect(system(0)).toContain("First project rule")
    expect(system(0)).not.toContain("Second project rule")
    await core.sessions.promptAndWait(grandchild.id, text)
    expect(system(1)).toContain("Second project rule")
    expect(system(1)).not.toContain("First project rule")
    await api.sessions.update(root.id, { projectID: target.id })
    await core.sessions.promptAndWait(grandchild.id, text)
    expect(system(2)).toContain("Other project rule")
    expect(system(2)).not.toContain("Second project rule")
    await api.sessions.update(root.id, { projectID: null })
    await core.sessions.promptAndWait(grandchild.id, text)
    expect(system(3)).not.toContain("project rule")
    expect(await api.sessions.get(child.id)).not.toHaveProperty("projectID")
    expect(await api.sessions.get(grandchild.id)).not.toHaveProperty("projectID")
    await api.sessions.update(root.id, { projectID: target.id })
    await api.projects.delete(target.id)
    await core.sessions.promptAndWait(grandchild.id, text)
    expect(system(4)).not.toContain("project rule")
    const small = { providerID: "fake", modelID: "text-only" }
    const budget = await api.projects.create({ name: "Budget", instructions: "x".repeat(200) })
    const limited = await api.sessions.create({ model: small, projectID: budget.id })
    await expect(api.sessions.prompt(limited.id, text)).rejects.toMatchObject({ code: "context_window_exceeded", status: 422 })
    expect(await api.sessions.messages(limited.id)).toEqual([])
    expect(core.sessions.isBusy(limited.id)).toBe(false)
    expect(provider.requests).toHaveLength(5)
    await api.projects.update(budget.id, { instructions: "x".repeat(40) })
    const budgetGate = deferred()
    const budgetLookup = vi.spyOn(core.catalog, "model").mockImplementationOnce(async (...args) => { await budgetGate.promise; return lookup(...args) })
    const admitted = core.sessions.prompt(limited.id, text)
    try { await api.projects.update(budget.id, { instructions: "x".repeat(4000) }) }
    finally { budgetGate.resolve(); budgetLookup.mockRestore() }
    await (await admitted).done
    expect(provider.requests[5].max_tokens).toBe(38)
    const retained = await api.sessions.messages(limited.id)
    await expect(api.sessions.prompt(limited.id, text)).rejects.toMatchObject({ code: "context_window_exceeded" })
    expect(await api.sessions.messages(limited.id)).toEqual(retained)
    const ungrouped = await api.sessions.create({ model: small })
    await core.sessions.promptAndWait(ungrouped.id, text)
    expect(provider.requests[6].max_tokens).toBe(48)
    expect(system(5)).toContain("x".repeat(40))
    expect(system(6)).not.toContain("x".repeat(40))
  })

  it("refuses stale expected project context after delete/move before any model lookup or turn write", async () => {
    const provider = await fakeOpenAI([])
    cleanups.push(provider.close)
    const core = memory(provider.url), api = client(core)
    const old = await api.projects.create({ name: "Original" })
    const next = await api.projects.create({ name: "Destination", instructions: "Destination context" })
    const root = await api.sessions.create({ model, projectID: old.id })
    const child = await api.sessions.create({ model, parentID: root.id })
    const lookup = vi.spyOn(core.catalog, "model")
    const refuse = async (expectedProjectID: string | null) => {
      for (const s of [root, child]) {
        const events = core.storage.events(s.id)
        await expect(api.sessions.prompt(s.id, { ...text, expectedProjectID })).rejects.toMatchObject({ code: "conflict", status: 409 })
        expect(core.storage.events(s.id)).toEqual(events)
        expect(await api.sessions.messages(s.id)).toEqual([])
        expect(core.sessions.isBusy(s.id)).toBe(false)
      }
      expect(lookup).not.toHaveBeenCalled()
      expect(provider.requests).toEqual([])
    }
    await api.sessions.update(root.id, { projectID: next.id })
    await refuse(old.id)
    await refuse(null)
    await api.projects.delete(next.id)
    await refuse(next.id)
    lookup.mockRestore()
    await core.sessions.promptAndWait(child.id, { ...text, expectedProjectID: null })
    await api.sessions.update(root.id, { projectID: old.id })
    await core.sessions.promptAndWait(child.id, { ...text, expectedProjectID: old.id })
    await core.sessions.promptAndWait(root.id, text)
    expect(provider.requests).toHaveLength(3)
  })
})
