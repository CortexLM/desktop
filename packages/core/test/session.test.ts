import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { Event } from "@cortex/schema"
import { memoryCredentials } from "../src/provider"
import { fakeOpenAI, testCore, toolCall } from "./helpers"

describe("session runner (fake OpenAI-compatible SSE)", () => {
  let close: (() => Promise<void>) | undefined
  afterEach(async () => close?.())

  it("admits only one concurrent prompt per session, then permits a follow-up", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "accepted" }], finish: "stop" }])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    try {
      const results = await Promise.allSettled(["first", "second"].map((text) => core.sessions.prompt(s.id, { parts: [{ type: "text", text }] })))
      for (const result of results) if (result.status === "fulfilled") await result.value.done
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"])
      expect(results[1]).toMatchObject({ reason: { code: "session_busy" } })
      expect(srv.requests).toHaveLength(1)
      expect(core.sessions.messages(s.id).map((m) => m.info.role)).toEqual(["user", "assistant"])
      expect(core.sessions.isBusy(s.id)).toBe(false)
      await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "follow-up" }] })
      expect(srv.requests).toHaveLength(2)
    } finally {
      await core.close()
    }
  })

  it.each(["abort", "delete"] as const)("%s during admission prevents a late prompt or session resurrection", async (action) => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "must not run" }], finish: "stop" }])
    close = srv.close
    let entered!: () => void
    let release!: () => void
    const reading = new Promise<void>((r) => { entered = r })
    const gate = new Promise<void>((r) => { release = r })
    const core = testCore(srv.url, { credentials: {
      ...memoryCredentials(),
      get: async () => { entered(); await gate; return "sk-test-1234" },
    } })
    const model = { providerID: "fake", modelID: "reasoner" }
    const s = core.sessions.create({ model })
    try {
      const pending = core.sessions.prompt(s.id, { parts: [{ type: "text", text: "late prompt" }] })
        .then(async ({ done }) => { await done; return "admitted" }, (err) => err.code)
      await reading
      const ending = core.sessions[action](s.id)
      release()
      const [outcome] = await Promise.all([pending, ending])
      expect(outcome).toBe("aborted")
      expect(srv.requests).toHaveLength(0)
      expect(core.storage.messages(s.id)).toEqual([])
      expect(core.storage.events(s.id).some((e) => e.type === "message.updated" || e.type === "part.updated")).toBe(false)
      expect(core.sessions.isBusy(s.id)).toBe(false)
      if (action === "delete") expect(core.sessions.list()).toEqual([])
      else {
        expect(core.sessions.get(s.id).title).toBe("")
        await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "retry" }] })
        expect(srv.requests).toHaveLength(1)
      }
    } finally {
      release()
      await core.close()
    }
  })

  it("cancels parent admission before waiting for child deletion", async () => {
    const srv = await fakeOpenAI([])
    close = srv.close
    const gates = [0, 1].map(() => {
      let entered!: () => void, release!: () => void
      const reading = new Promise<void>((r) => { entered = r })
      const wait = new Promise<void>((r) => { release = r })
      return { reading, wait, entered, release }
    })
    let reads = 0
    const core = testCore(srv.url, { credentials: { ...memoryCredentials(), get: async () => {
      const gate = gates[reads++]
      if (gate) { gate.entered(); await gate.wait }
      return "sk-test-1234"
    } } })
    const model = { providerID: "fake", modelID: "reasoner" }
    const parent = core.sessions.create({ model })
    const child = core.sessions.create({ model, parentID: parent.id })
    const prompt = (id: string) => core.sessions.prompt(id, { parts: [{ type: "text", text: "pending" }] })
      .then(async ({ done }) => { await done; return "admitted" }, (err) => err.code)
    try {
      const first = prompt(parent.id)
      await gates[0]!.reading
      const second = prompt(child.id)
      await gates[1]!.reading
      const deleting = core.sessions.delete(parent.id)
      gates[0]!.release()
      const outcome = await first
      gates[1]!.release()
      await Promise.all([second, deleting])
      expect(outcome).toBe("aborted")
      expect(srv.requests).toHaveLength(0)
      expect(core.sessions.list()).toEqual([])
      for (const id of [parent.id, child.id]) {
        expect(core.storage.events(id).some((e) => e.type === "message.updated" || e.type === "part.updated")).toBe(false)
        expect(core.sessions.isBusy(id)).toBe(false)
      }
    } finally {
      gates.forEach((g) => g.release())
      await core.close()
    }
  })

  it("honors synchronous cancellation from a model-update listener before persisting a turn", async () => {
    const srv = await fakeOpenAI([])
    close = srv.close
    const core = testCore(srv.url)
    const model = { providerID: "fake", modelID: "reasoner" }
    const s = core.sessions.create({ model })
    const input = { model, parts: [{ type: "text", text: "pending" }] }
    let nested: Promise<unknown> | undefined, abort: Promise<void> | undefined
    const off = core.bus.on("session.updated", () => {
      off()
      nested = core.sessions.prompt(s.id, input).then(() => "admitted", (err) => err.code)
      abort = core.sessions.abort(s.id)
    })
    try {
      const outcome = await core.sessions.prompt(s.id, input).then(async ({ done }) => { await done; return "admitted" }, (err) => err.code)
      await abort
      expect(await nested).toBe("session_busy")
      expect(outcome).toBe("aborted")
      expect(srv.requests).toHaveLength(0)
      expect(core.storage.events(s.id).some((e) => e.type === "message.updated" || e.type === "part.updated")).toBe(false)
      expect(core.sessions.isBusy(s.id)).toBe(false)
    } finally {
      off()
      await core.close()
    }
  })

  it("streams reasoning + text, runs one tool, persists parts and usage", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-run-"))
    writeFileSync(join(dir, "hello.txt"), "hello from disk\n")
    const srv = await fakeOpenAI([
      { deltas: [{ reasoning_content: "Let me " }, { reasoning_content: "look." }, toolCall("call_1", "read", { path: "hello.txt" })], finish: "tool_calls", usage: { prompt_tokens: 1000, completion_tokens: 100 } },
      { deltas: [{ content: "The file " }, { content: "says hello." }], finish: "stop", usage: { prompt_tokens: 2000, completion_tokens: 50 } },
    ])
    close = srv.close
    const core = testCore(srv.url)
    const events: Event[] = []
    core.bus.subscribe((e) => events.push(e))
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
    expect(s.title).toBe("")
    await expect(core.sessions.prompt(s.id, { model: { providerID: "fake", modelID: "text-only" }, parts: [
      { type: "text", text: "Read the image" }, { type: "file", mime: "image/png", data: "AA==" },
    ] })).rejects.toMatchObject({ code: "model_no_image_input" })
    expect(core.sessions.get(s.id).title).toBe("")
    expect(core.sessions.messages(s.id)).toEqual([])
    const text = await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "Read hello.txt" }] })
    expect(text).toBe("The file says hello.")

    // bus order: status busy → reasoning deltas → tool running/completed → text deltas → idle
    const seq = events.map((e) => (e.type === "part.delta" ? `delta:${e.properties.field}` : e.type === "part.updated" ? `part:${e.properties.part.type}${e.properties.part.type === "tool" ? ":" + e.properties.part.state.status : ""}` : e.type === "session.status" ? `status:${e.properties.status.type}` : e.type))
    const at = (x: string) => seq.indexOf(x)
    expect(at("status:busy")).toBeGreaterThan(-1)
    expect(at("delta:reasoning")).toBeGreaterThan(at("status:busy"))
    expect(at("part:tool:running")).toBeGreaterThan(at("delta:reasoning"))
    expect(at("part:tool:completed")).toBeGreaterThan(at("part:tool:running"))
    expect(at("delta:text")).toBeGreaterThan(at("part:tool:completed"))
    expect(seq.at(-1)).toBe("status:idle")
    expect(seq.filter((x) => x === "delta:reasoning")).toHaveLength(2)
    expect(seq).not.toContain("status:error")

    // the second request replays the tool call and its result
    const second = srv.requests[1].messages
    expect(second.some((m: any) => m.role === "tool" && m.content.includes("hello from disk"))).toBe(true)
    expect(srv.requests[0].tools.map((t: any) => t.function.name)).toContain("read")

    // persisted projection
    const msgs = core.sessions.messages(s.id)
    expect(msgs.map((m) => m.info.role)).toEqual(["user", "assistant"])
    const parts = msgs[1]!.parts
    expect(parts.map((p) => p.type)).toEqual(["step-start", "reasoning", "tool", "step-finish", "step-start", "text", "step-finish"])
    expect(parts.find((p) => p.type === "reasoning")).toMatchObject({ text: "Let me look." })
    expect(parts.find((p) => p.type === "tool")).toMatchObject({ tool: "read", callID: "call_1", state: { status: "completed", input: { path: "hello.txt" } } })
    expect(msgs[1]!.info.usage).toMatchObject({ input: 3000, output: 150 })
    expect(msgs[1]!.info.usage.cost).toBeCloseTo((3000 * 1 + 150 * 2) / 1e6)
    expect(msgs[1]!.info.time.completed).toBeDefined()
    expect(core.sessions.get(s.id).title).toBe("Read hello.txt")
    expect(core.storage.events(s.id).length).toBeGreaterThan(5)
  })

  it("asks permission for write; once → executes, reject → stops the loop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-perm-"))
    const srv = await fakeOpenAI([
      { deltas: [toolCall("w1", "write", { path: "a.txt", content: "A" })], finish: "tool_calls" },
      { deltas: [{ content: "done" }], finish: "stop" },
      { deltas: [toolCall("w2", "write", { path: "b.txt", content: "B" })], finish: "tool_calls" },
      { deltas: [{ content: "should not run" }], finish: "stop" },
    ])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" }, directory: dir })

    let off = core.bus.on("permission.asked", (e) => core.permissions.reply(e.properties.permission.id, "once"))
    await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "write a" }] })
    off()
    expect(readFileSync(join(dir, "a.txt"), "utf8")).toBe("A")

    off = core.bus.on("permission.asked", (e) => core.permissions.reply(e.properties.permission.id, "reject"))
    const { done } = await core.sessions.prompt(s.id, { parts: [{ type: "text", text: "write b" }] })
    await done
    off()
    const last = core.sessions.messages(s.id).at(-1)!
    expect(last.info.error?.code).toBe("permission_rejected")
    expect(last.parts.find((p) => p.type === "tool")).toMatchObject({ state: { status: "error" } })
    expect(srv.requests).toHaveLength(3)
  })

  it.each(["grep", "glob"])("%s cannot bypass a denied read path", async (name) => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-search-perm-"))
    writeFileSync(join(dir, "secret.txt"), "PRIVATE_SECRET\n")
    const srv = await fakeOpenAI([
      { deltas: [toolCall("search", name, { pattern: name === "grep" ? "." : "*.txt" })], finish: "tool_calls" },
      { deltas: [{ content: "done" }], finish: "stop" },
    ])
    close = srv.close
    const core = testCore(srv.url)
    core.permissionRules.set([{ tool: "read", pattern: "*secret.txt", action: "deny" }])
    const session = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
    try {
      await core.sessions.promptAndWait(session.id, { parts: [{ type: "text", text: "Search the files" }] })
      const tool = core.sessions.messages(session.id).flatMap(row => row.parts).find(part => part.type === "tool")
      expect(tool).toMatchObject({ state: { status: "error" } })
      expect(JSON.stringify(tool)).not.toContain("PRIVATE_SECRET")
    } finally {
      await core.close()
    }
  })

  it("abort stops a pending permission wait", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-abort-"))
    const srv = await fakeOpenAI([{ deltas: [toolCall("b1", "bash", { command: "echo hi" })], finish: "tool_calls" }])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
    const asked = new Promise<void>((r) => core.bus.on("permission.asked", () => r()))
    const { done } = await core.sessions.prompt(s.id, { parts: [{ type: "text", text: "run" }] })
    await asked
    expect(core.permissions.list()).toHaveLength(1)
    await core.sessions.abort(s.id)
    await done
    expect(core.permissions.list()).toHaveLength(0)
    expect(core.sessions.messages(s.id).at(-1)!.info.error?.code).toBe("aborted")
    expect(core.sessions.isBusy(s.id)).toBe(false)
  })

  it("task runs a subagent child session without nested task", async () => {
    const srv = await fakeOpenAI([
      { deltas: [toolCall("t1", "task", { description: "sub", prompt: "say child", agent: "general" })], finish: "tool_calls" },
      { deltas: [{ content: "child report" }], finish: "stop" },
      { deltas: [{ content: "parent done" }], finish: "stop" },
    ])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    expect(await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "delegate" }] })).toBe("parent done")
    const children = core.sessions.list({ parentID: s.id })
    expect(children).toHaveLength(1)
    expect(children[0]!.agent).toBe("general")
    expect(srv.requests[1].tools?.map((t: any) => t.function.name) ?? []).not.toContain("task")
    const tool = core.sessions.messages(s.id)[1]!.parts.find((p) => p.type === "tool")
    expect(tool).toMatchObject({ state: { status: "completed", output: "child report" } })
  })

  it("checks external-directory permission for an in-tree symlink escape", async () => {
    const root = mkdtempSync(join(tmpdir(), "cortex-symlink-"));
    const dir = join(root, "project");
    mkdirSync(dir);
    writeFileSync(join(root, "secret.txt"), "PRIVATE");
    symlinkSync(root, join(dir, "outside"), process.platform === "win32" ? "junction" : "dir");
    const srv = await fakeOpenAI([{ deltas: [toolCall("r1", "read", { path: "outside/secret.txt" })], finish: "tool_calls" }]);
    close = srv.close;
    const core = testCore(srv.url);
    core.permissionRules.set([{ tool: "external_directory", pattern: "*", action: "deny" }]);
    const session = core.sessions.create({ directory: dir, model: { providerID: "fake", modelID: "reasoner" } });
    try {
      await core.sessions.promptAndWait(session.id, { parts: [{ type: "text", text: "read" }] });
      expect(JSON.stringify(core.sessions.messages(session.id))).not.toContain("PRIVATE");
      expect(core.sessions.messages(session.id).flatMap((message) => message.parts).find((part) => part.type === "tool")).toMatchObject({ state: { status: "error" } });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("a plan child cannot bypass the parent's read-only permission", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-plan-child-"))
    const srv = await fakeOpenAI([
      { deltas: [toolCall("t1", "task", { description: "sub", prompt: "write file", agent: "general" })], finish: "tool_calls" },
      { deltas: [toolCall("w1", "write", { path: "blocked.txt", content: "blocked" })], finish: "tool_calls" },
      { deltas: [{ content: "child done" }], finish: "stop" },
      { deltas: [{ content: "parent done" }], finish: "stop" },
    ])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ agent: "plan", directory: dir, model: { providerID: "fake", modelID: "reasoner" } })
    let asked = 0
    const stop = core.bus.on("permission.asked", (event) => { asked++; core.permissions.reply(event.properties.permission.id, "once") })
    try {
      await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "delegate" }] })
      expect(asked).toBe(0)
      const child = core.sessions.list({ parentID: s.id })[0]
      expect(child).toBeDefined()
      const tool = core.sessions.messages(child!.id).flatMap((m) => m.parts).find((p) => p.type === "tool")
      expect(tool).toMatchObject({ state: { status: "error" } })
    } finally { stop(); rmSync(dir, { recursive: true, force: true }) }
  })

  it("offers enabled skill names through the model tool schema", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-skill-discovery-"));
    const skillDir = join(dir, ".cortex", "skills", "fixture-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: fixture-skill\ndescription: Fixture instructions\n---\nOnly loaded after selection.");
    const srv = await fakeOpenAI([{ deltas: [{ content: "done" }], finish: "stop" }]);
    close = srv.close;
    const core = testCore(srv.url);
    const session = core.sessions.create({ directory: dir, model: { providerID: "fake", modelID: "reasoner" } });
    try {
      await core.sessions.promptAndWait(session.id, { parts: [{ type: "text", text: "available skills" }] });
      const schema = srv.requests[0].tools.find((tool: { function: { name: string } }) => tool.function.name === "skill").function.parameters;
      expect(schema.properties.name.enum).toEqual(["fixture-skill"]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("bot sessions use persona and memory as system prompt", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "hi" }], finish: "stop" }])
    close = srv.close
    const core = testCore(srv.url)
    const bot = core.bots.create({ name: "Pebble", persona: "You speak like a pirate.", model: { providerID: "fake", modelID: "reasoner" } })
    core.bots.remember(bot.id, "User likes tea")
    const s = core.sessions.create({ model: bot.model, kind: "bot", botID: bot.id })
    await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "hello" }] })
    const sys = srv.requests[0].messages.find((m: any) => m.role === "system").content
    expect(sys).toContain("You are Pebble.")
    expect(sys).toContain("pirate")
    expect(sys).toContain("User likes tea")
    expect(core.bots.get(bot.id).memory).toHaveLength(1)
  })

  it("surfaces provider errors with a neutral code", async () => {
    const core = testCore("http://127.0.0.1:9/v1")
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    await expect(core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "hi" }] })).rejects.toMatchObject({ code: "provider_error" })
  }, 30_000)
})
