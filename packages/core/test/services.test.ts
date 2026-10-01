import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { z } from "zod"
import {
  Bus,
  createCore,
  evaluate,
  memoryCredentials,
  nextCron,
  nextRun,
  parseCron,
  PermissionService,
  SkillService,
  Storage,
} from "../src/index"
import { fakeOpenAI, testCore, toolCall } from "./helpers"

describe("permissions", () => {
  it("last matching rule wins, default ask", () => {
    expect(evaluate([], "bash", "ls")).toBe("ask")
    expect(evaluate([{ tool: "*", pattern: "*", action: "allow" }, { tool: "bash", pattern: "rm *", action: "deny" }], "bash", "rm -rf /")).toBe("deny")
    expect(evaluate([{ tool: "bash", pattern: "rm *", action: "deny" }, { tool: "*", pattern: "*", action: "allow" }], "bash", "rm -rf /")).toBe("allow")
  })

  it("ask → always persists per project and releases matching asks", async () => {
    const storage = new Storage(":memory:")
    const bus = new Bus(storage)
    const perms = new PermissionService(bus, storage)
    const rules = [{ tool: "bash", pattern: "*", action: "ask" as const }]
    const asked: string[] = []
    bus.on("permission.asked", (e) => asked.push(e.properties.permission.id))
    const a = perms.ask({ sessionID: "s1", tool: "bash", pattern: "ls", input: "ls", rules, project: "/p" })
    const b = perms.ask({ sessionID: "s1", tool: "bash", pattern: "ls", input: "ls", rules, project: "/p" })
    expect(perms.list()).toHaveLength(2)
    perms.reply(asked[0]!, "always")
    await Promise.all([a, b])
    expect(perms.list()).toHaveLength(0)
    await perms.ask({ sessionID: "s2", tool: "bash", pattern: "ls", input: "ls", rules, project: "/p" }) // remembered
    const other = perms.ask({ sessionID: "s2", tool: "bash", pattern: "ls", input: "ls", rules, project: "/q" })
    expect(perms.list()).toHaveLength(1) // different project still asks
    perms.reply(perms.list()[0]!.id, "reject")
    await expect(other).rejects.toMatchObject({ code: "permission_rejected" })
    await expect(perms.ask({ sessionID: "s", tool: "bash", pattern: "x", input: "", rules: [{ tool: "bash", pattern: "*", action: "deny" }], project: "/p" })).rejects.toMatchObject({ code: "permission_denied" })
    expect(() => perms.reply("nope", "once")).toThrow()
  })
})

describe("cron", () => {
  it("computes next runs", () => {
    const base = new Date(2026, 0, 1, 10, 30, 15) // Thu 1 Jan 2026 10:30:15 local
    expect(nextCron(parseCron("*/15 * * * *"), base)).toEqual(new Date(2026, 0, 1, 10, 45))
    expect(nextCron(parseCron("0 9 * * *"), base)).toEqual(new Date(2026, 0, 2, 9, 0))
    expect(nextCron(parseCron("0 9 * * 1-5"), new Date(2026, 0, 2, 10))).toEqual(new Date(2026, 0, 5, 9, 0)) // Fri → Mon
    expect(nextCron(parseCron("0 0 1 */3 *"), base)).toEqual(new Date(2026, 3, 1, 0, 0))
    expect(nextCron(parseCron("30 10 * * 7"), base)).toEqual(new Date(2026, 0, 4, 10, 30)) // Sunday as 7
    expect(nextCron(parseCron("0 0 29 2 *"), base)).toEqual(new Date(2028, 1, 29, 0, 0))
    expect(nextCron(parseCron("0 12 13 * 5"), base)).toEqual(new Date(2026, 0, 2, 12, 0)) // dom OR dow
    expect(() => parseCron("61 * * * *")).toThrow()
    expect(() => parseCron("* * *")).toThrow()
  })
  it("daily/weekly/once", () => {
    const base = new Date(2026, 0, 1, 10, 0)
    expect(nextRun({ type: "daily", time: "09:00" }, base)).toBe(new Date(2026, 0, 2, 9, 0).getTime())
    expect(nextRun({ type: "weekly", day: 1, time: "8:15" }, base)).toBe(new Date(2026, 0, 5, 8, 15).getTime())
    expect(nextRun({ type: "once", at: base.getTime() + 1000 }, base)).toBe(base.getTime() + 1000)
    expect(nextRun({ type: "once", at: base.getTime() - 1000 }, base)).toBeUndefined()
  })
})

describe("skills", () => {
  it("discovers SKILL.md from builtin/personal/project with shadowing and toggles", async () => {
    const root = mkdtempSync(join(tmpdir(), "cortex-skills-"))
    const mk = (dir: string, name: string, desc: string) => {
      mkdirSync(join(dir, name), { recursive: true })
      writeFileSync(join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: "${desc}"\n---\n# ${name}\nBody of ${desc}`)
    }
    mk(join(root, "builtin"), "pdf", "builtin pdf")
    mk(join(root, "personal"), "pdf", "personal pdf")
    mk(join(root, "personal"), "notes", "notes")
    mk(join(root, "proj", ".cortex", "skills"), "deploy", "deploy it")
    mkdirSync(join(root, "builtin", "empty"))
    const svc = new SkillService({ builtin: join(root, "builtin"), personal: join(root, "personal") }, new Storage(":memory:"))
    const list = await svc.list(join(root, "proj"))
    expect(list.map((s) => `${s.name}:${s.source}`)).toEqual(["deploy:project", "notes:personal", "pdf:personal"])
    expect(list.find((s) => s.name === "pdf")!.description).toBe("personal pdf")
    expect((await svc.load("notes"))!.content).toContain("Body of notes")
    svc.setEnabled("notes", false)
    expect((await svc.list()).find((s) => s.name === "notes")!.enabled).toBe(false)
    expect(await svc.load("notes")).toBeUndefined()
  })
})

describe("plugins", () => {
  it("loads a plugin dir, exposes its tool and hooks, and can be disabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-plugin-"))
    const p = join(dir, "hello")
    mkdirSync(p)
    writeFileSync(join(p, "package.json"), JSON.stringify({ name: "hello", description: "Says hello", main: "index.mjs" }))
    writeFileSync(
      join(p, "index.mjs"),
      `import { z } from "zod"
       export default () => ({
         tools: [{ name: "hello", description: "greet", parameters: z.object({ who: z.string() }), execute: async ({ who }) => ({ output: "hello " + who }) }],
         "chat.params": (p) => { p.temperature = 0.42 },
       })`,
    )
    mkdirSync(join(dir, "bad"))
    writeFileSync(join(dir, "bad", "package.json"), JSON.stringify({ name: "bad", main: "missing.mjs" }))
    const srv = await fakeOpenAI([{ deltas: [toolCall("h1", "hello", { who: "you" })], finish: "tool_calls" }, { deltas: [{ content: "ok" }], finish: "stop" }])
    const core = testCore(srv.url, { plugins: { installed: dir } })
    await core.plugins.scan()
    const list = core.plugins.list()
    expect(list.find((x) => x.id === "hello")).toMatchObject({ enabled: true, tools: ["hello"], hooks: ["chat.params"] })
    expect(list.find((x) => x.id === "bad")!.error?.code).toBe("plugin_load_failed")
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "greet" }] })
    expect(srv.requests[0].temperature).toBe(0.42)
    expect(core.sessions.messages(s.id)[1]!.parts.find((x) => x.type === "tool")).toMatchObject({ state: { status: "completed", output: "hello you" } })
    core.plugins.setEnabled("hello", false)
    expect(core.plugins.tools()).toHaveLength(0)
    await srv.close()
  })
})

describe("mcp", () => {
  let cleanup: (() => Promise<void>) | undefined
  afterEach(async () => cleanup?.())

  it("connects to an in-memory server, lists and calls tools as <server>_<tool>", async () => {
    const server = new SdkMcpServer({ name: "demo", version: "1.0.0" })
    server.registerTool("add", { description: "Add numbers", inputSchema: { a: z.number(), b: z.number() } }, async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }))
    const srv = await fakeOpenAI([{ deltas: [toolCall("m1", "demo_add", { a: 2, b: 3 })], finish: "tool_calls" }, { deltas: [{ content: "5" }], finish: "stop" }])
    const core = testCore(srv.url)
    cleanup = async () => {
      await core.close()
      await srv.close()
    }
    core.mcp.transportFactory = () => {
      const [client, serverSide] = InMemoryTransport.createLinkedPair()
      void server.connect(serverSide)
      return client
    }
    const statuses: string[] = []
    core.bus.on("mcp.status", (e) => statuses.push(e.properties.status))
    const info = await core.mcp.add({ name: "demo", type: "stdio", command: "unused" })
    expect(info.status).toBe("connected")
    expect(info.tools.map((t) => t.name)).toEqual(["add"])
    expect(core.mcp.tools().map((t) => t.name)).toEqual(["demo_add"])
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "add" }] })
    expect(srv.requests[0].tools.map((t: any) => t.function.name)).toContain("demo_add")
    expect(core.sessions.messages(s.id)[1]!.parts.find((x) => x.type === "tool")).toMatchObject({ tool: "demo_add", state: { status: "completed", output: "5" } })
    await core.mcp.setEnabled("demo", false)
    expect(core.mcp.get("demo")!.status).toBe("disabled")
    expect(statuses).toEqual(["connected", "disconnected", "disabled"])
  })

  it("reports failed status for an unreachable stdio command", async () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    cleanup = () => core.close()
    const info = await core.mcp.add({ name: "nope", type: "stdio", command: "/nonexistent/cortex-mcp-binary" })
    expect(info.status).toBe("failed")
    expect(info.error?.code).toBe("mcp_connect_failed")
  })
})

describe("scheduler, bots, space, connection, providers", () => {
  it("runs a task now and on tick, recording history", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "report 1" }], finish: "stop" }, { deltas: [{ content: "report 2" }], finish: "stop" }])
    const core = testCore(srv.url)
    const t = core.scheduler.create({ title: "Daily digest", prompt: "summarise", schedule: { type: "daily", time: "09:00" }, model: { providerID: "fake", modelID: "reasoner" } })
    expect(t.nextRun).toBeGreaterThan(Date.now())
    const run = await core.scheduler.run(t.id)
    expect(run.status).toBe("success")
    expect(core.sessions.messages(run.sessionID!)[1]!.parts.some((p) => p.type === "text" && p.text === "report 1")).toBe(true)
    const runs = await core.scheduler.tick(t.nextRun! + 1)
    expect(runs).toHaveLength(1)
    const after = core.scheduler.get(t.id)
    expect(after.runs).toHaveLength(2)
    expect(after.nextRun).toBeGreaterThan(t.nextRun!)
    expect(() => core.scheduler.create({ title: "bad", prompt: "x", schedule: { type: "cron", expr: "nope" }, model: t.model })).toThrow()
    await srv.close()
  })

  it("bot CRUD, memory and routines", () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    const b = core.bots.create({ name: "Kernel", model: { providerID: "fake", modelID: "reasoner" } })
    expect(b.mascot.shape).toBe("pebble")
    const m = core.bots.remember(b.id, "likes jazz")
    core.scheduler.create({ title: "Morning", prompt: "hi", schedule: { type: "daily", time: "08:00" }, model: b.model, botID: b.id })
    expect(core.bots.get(b.id).routines).toHaveLength(1)
    core.bots.forget(b.id, m.id)
    expect(core.bots.memory(b.id)).toEqual([])
    expect(core.bots.update(b.id, { name: "Kernel 2" }).name).toBe("Kernel 2")
    core.bots.delete(b.id)
    expect(core.bots.list()).toEqual([])
    expect(core.scheduler.list()).toEqual([])
  })

  it("space recents and connection probe", async () => {
    const core = createCore({
      dataDir: ":memory:",
      credentials: memoryCredentials(),
      fetch: async (u) => (String(u).startsWith("https://ok.test") ? Response.json({ status: "ok" }) : String(u).startsWith("https://old.test") ? new Response("", { status: 404 }) : Promise.reject(new Error("down"))),
    })
    const a = core.space.create({ kind: "page", title: "A", content: "# A" })
    const b = core.space.create({ kind: "image", title: "B", url: "file:///b.png" })
    await new Promise((r) => setTimeout(r, 5))
    core.space.update(a.id, { opened: true })
    expect(core.space.recents().map((i) => i.id)).toEqual([a.id, b.id])
    expect(core.space.list("image").map((i) => i.id)).toEqual([b.id])
    expect(await core.connection.probe()).toEqual({ status: "not_applicable" })
    core.connection.set({ mode: "selfhost", url: "https://ok.test", signedIn: false })
    expect((await core.connection.probe()).status).toBe("reachable")
    core.connection.set({ mode: "selfhost", url: "https://old.test", signedIn: false })
    expect((await core.connection.probe()).status).toBe("incompatible")
    core.connection.set({ mode: "selfhost", url: "https://down.test", signedIn: false })
    expect((await core.connection.probe()).status).toBe("unreachable")
    expect(() => core.connection.set({ mode: "selfhost", signedIn: false })).toThrow()
  })

  it("provider keys are write-only: config exposes hint only", async () => {
    const creds = memoryCredentials()
    const core = createCore({ dataDir: ":memory:", credentials: creds })
    const cfg = await core.providers.setKey("openai", "sk-secret-abcd")
    expect(cfg).toEqual({ providerID: "openai", enabled: true, hasKey: true, keyHint: "abcd", baseURL: undefined })
    expect(JSON.stringify(await core.providers.list())).not.toContain("secret")
    expect(await creds.get("openai")).toBe("sk-secret-abcd")
    expect((await core.providers.removeKey("openai")).hasKey).toBe(false)
  })

  it("persists across reopen with a file database", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-db-"))
    const c1 = createCore({ dataDir: dir, credentials: memoryCredentials() })
    const s = c1.sessions.create({ model: { providerID: "fake", modelID: "reasoner" }, title: "Kept" })
    await c1.close()
    const c2 = createCore({ dataDir: dir, credentials: memoryCredentials() })
    expect(c2.sessions.get(s.id).title).toBe("Kept")
    await c2.close()
  })
})
