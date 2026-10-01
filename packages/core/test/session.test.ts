import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { Event } from "@cortex/schema"
import { fakeOpenAI, testCore, toolCall } from "./helpers"

describe("session runner (fake OpenAI-compatible SSE)", () => {
  let close: (() => Promise<void>) | undefined
  afterEach(async () => close?.())

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
