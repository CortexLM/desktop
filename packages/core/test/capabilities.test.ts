import { afterEach, describe, expect, it } from "vitest"
import { callOptions, parseCatalog } from "../src/index"
import { fakeOpenAI, fixture, testCore } from "./helpers"

const cat = parseCatalog(fixture())
const m = (p: string, id: string) => cat[p]!.models[id]!

describe("capability-gated call options", () => {
  it("leaves thinking off when the user turns it off", () => {
    expect(callOptions(m("anthropic", "claude-x"), "anthropic", 0, false).providerOptions).toEqual({})
    expect(callOptions(m("openai", "gpt-x"), "openai", 0, false).providerOptions).toEqual({})
  })
  it("enables anthropic thinking only for reasoning models", () => {
    const r = callOptions(m("anthropic", "claude-x"), "anthropic")
    expect(r.providerOptions.anthropic).toMatchObject({ thinking: { type: "enabled" } })
    const budget = (r.providerOptions.anthropic as any).thinking.budgetTokens
    expect(budget).toBeGreaterThanOrEqual(1024)
    expect(r.maxOutputTokens!).toBeGreaterThan(budget)
    expect(callOptions(m("anthropic", "claude-plain"), "anthropic").providerOptions).toEqual({})
  })
  it("openai reasoningEffort, google thinkingConfig, compatible forwards deltas only", () => {
    expect(callOptions(m("openai", "gpt-x"), "openai").providerOptions.openai).toMatchObject({ reasoningEffort: "medium" })
    expect(callOptions(m("google", "gemini-x"), "google").providerOptions.google).toEqual({ thinkingConfig: { includeThoughts: true } })
    expect(callOptions(m("fake", "reasoner"), "openai-compatible").providerOptions).toEqual({})
  })
  it("clamps maxOutputTokens to limit.output and remaining context", () => {
    expect(callOptions(m("fake", "reasoner"), "openai-compatible").maxOutputTokens).toBe(4000)
    expect(callOptions(m("fake", "text-only"), "openai-compatible", 40).maxOutputTokens).toBe(10)
  })
  it("tools only with tool_call", () => {
    expect(callOptions(m("fake", "reasoner"), "openai-compatible").useTools).toBe(true)
    expect(callOptions(m("fake", "text-only"), "openai-compatible").useTools).toBe(false)
  })
})

describe("capability enforcement in the runner", () => {
  let close: (() => Promise<void>) | undefined
  afterEach(async () => close?.())

  it("rejects image parts on a text-only model before admitting anything", async () => {
    const srv = await fakeOpenAI([])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "text-only" } })
    await expect(
      core.sessions.prompt(s.id, { parts: [{ type: "text", text: "what is this" }, { type: "file", mime: "image/png", data: "iVBORw0KGgo=" }] }),
    ).rejects.toMatchObject({ code: "model_no_image_input" })
    expect(core.sessions.messages(s.id)).toEqual([])
    expect(srv.requests).toHaveLength(0)
  })

  it("refuses prompts larger than the context window", async () => {
    const srv = await fakeOpenAI([])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "text-only" } })
    await expect(core.sessions.prompt(s.id, { parts: [{ type: "text", text: "x".repeat(1000) }] })).rejects.toMatchObject({ code: "context_window_exceeded" })
  })

  it("omits tools from the request when the model lacks tool_call", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "hi" }], finish: "stop" }])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "text-only" }, directory: process.cwd() })
    await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "hello" }] })
    expect(srv.requests[0].tools).toBeUndefined()
    expect(srv.requests[0].max_tokens).toBeLessThanOrEqual(1000)
  })

  it("accepts images on a vision model and sends them", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "a pixel" }], finish: "stop" }])
    close = srv.close
    const core = testCore(srv.url)
    const s = core.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "what is this" }, { type: "file", mime: "image/png", data: "iVBORw0KGgo=" }] })
    const content = srv.requests[0].messages.find((x: any) => x.role === "user").content
    expect(content.some((c: any) => c.type === "image_url")).toBe(true)
    expect(srv.requests[0].tools.length).toBeGreaterThan(0)
  })

  it.each(["image/png", "application/pdf"])("refuses a text-only model when history contains %s", async (mime) => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "file received" }], finish: "stop" }])
    close = srv.close
    const core = testCore(srv.url)
    const catalog = fixture()
    catalog.fake.api = srv.url
    catalog.fake.models["text-only"].limit.context = 100000
    catalog.fake.models.reasoner.modalities.input.push("pdf")
    core.catalog.set(catalog)
    const model = { providerID: "fake", modelID: "reasoner" }
    const s = core.sessions.create({ model })
    try {
      await core.sessions.promptAndWait(s.id, { parts: [{ type: "text", text: "read this" }, { type: "file", mime, data: "AA==", filename: "attachment" }] })
      const history = core.sessions.messages(s.id)
      const events = core.storage.events(s.id)
      await expect(core.sessions.prompt(s.id, { model: { providerID: "fake", modelID: "text-only" }, parts: [{ type: "text", text: "follow-up" }] }))
        .rejects.toMatchObject({ code: mime === "image/png" ? "model_no_image_input" : "model_no_pdf_input" })
      expect(core.sessions.messages(s.id)).toEqual(history)
      expect(core.storage.events(s.id)).toEqual(events)
      expect(core.sessions.get(s.id).model).toEqual(model)
      expect(core.sessions.isBusy(s.id)).toBe(false)
      expect(srv.requests).toHaveLength(1)
    } finally {
      await core.close()
    }
  })
})
