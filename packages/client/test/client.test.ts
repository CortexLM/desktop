import { describe, expect, it } from "vitest"
import type { Event } from "@cortex/schema"
import { createClient, CortexApiError, parseSSE } from "../src/index"
import { createServer } from "../../server/src/index"
import { fakeOpenAI, testCore } from "../../core/test/helpers"

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const s of chunks) c.enqueue(new TextEncoder().encode(s))
      c.close()
    },
  })

describe("client", () => {
  it("reports unexpected event-stream EOF so its owner can reconnect", async () => {
    const client = createClient({ baseUrl: "http://engine.test", fetch: async () => new Response(streamOf([])) })
    let failed: (error: unknown) => void = () => { throw new Error("error signal not initialized") }
    const error = new Promise<unknown>((resolve) => { failed = resolve })
    const stop = client.subscribe(() => undefined, { onError: failed })
    try { await expect(error).resolves.toMatchObject({ code: "internal" }) }
    finally { stop() }
  })

  it("signals open only for an accepted event stream", async () => {
    const order: string[] = []
    let settled: () => void = () => { throw new Error("error signal not initialized") }
    const done = new Promise<void>((resolve) => { settled = resolve })
    const ok = createClient({ baseUrl: "http://engine.test", fetch: async () => new Response(streamOf([])) })
    const stopOk = ok.subscribe(() => undefined, { onOpen: () => order.push("open"), onError: () => { order.push("error"); settled() } })
    await done
    stopOk()
    const refusedDone = new Promise<void>((resolve) => { settled = resolve })
    const refused = createClient({ baseUrl: "http://engine.test", fetch: async () => new Response(null, { status: 503 }) })
    const stopRefused = refused.subscribe(() => undefined, { onOpen: () => order.push("open"), onError: () => { order.push("error"); settled() } })
    await refusedDone
    stopRefused()
    expect(order).toEqual(["open", "error", "error"])
  })
  it("trims only trailing URL slashes without backtracking", async () => {
    const base = `https://engine.test/${"/".repeat(100_000)}prefix`
    const urls: string[] = []
    const start = performance.now()
    const client = createClient({
      baseUrl: base + "/".repeat(100_000),
      fetch: (r) => { urls.push(r.url); return Response.json({ ok: true }) },
    })
    expect(performance.now() - start).toBeLessThan(1000)
    await client.health()
    expect(urls).toEqual([`${base}/api/health`])
  })

  it("parses SSE split across arbitrary chunks, skipping comments and junk", async () => {
    const e1 = JSON.stringify({ type: "session.deleted", properties: { sessionID: "s1" } })
    const e2 = JSON.stringify({ type: "part.delta", properties: { sessionID: "s", messageID: "m", partID: "p", field: "text", delta: "a\nb" } })
    const raw = `: connected\n\ndata: ${e1}\r\n\r\ndata: not-json\n\ndata: {"type":"unknown"}\n\ndata: ${e2}\n\n`
    const chunks = raw.match(/.{1,7}/gs)!
    const out: Event[] = []
    for await (const e of parseSSE(streamOf(chunks))) out.push(e)
    expect(out.map((e) => e.type)).toEqual(["session.deleted", "part.delta"])
    expect((out[1] as any).properties.delta).toBe("a\nb")
  })

  it("drives the server through an injected fetch (IPC-style) and subscribes to events", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ content: "pong" }], finish: "stop" }])
    const app = createServer(testCore(srv.url))
    const client = createClient({ baseUrl: "cortex://engine", fetch: (r) => app.fetch(r) })
    const events: Event[] = []
    const idle = new Promise<void>((resolve) => {
      const off = client.subscribe((e) => {
        events.push(e)
        if (e.type === "session.status" && e.properties.status.type === "idle") (off(), resolve())
      })
    })
    await new Promise((r) => setTimeout(r, 10))
    const s = await client.sessions.create({ model: { providerID: "fake", modelID: "reasoner" } })
    expect(await client.sessions.prompt(s.id, { parts: [{ type: "text", text: "ping" }] })).toHaveProperty("messageID")
    await idle
    expect(events.filter((e) => e.type === "part.delta").map((e) => (e as any).properties.delta).join("")).toBe("pong")
    const msgs = await client.sessions.messages(s.id)
    expect(msgs).toHaveLength(2)

    const err = await client.sessions.get("ses_nope").catch((e) => e)
    expect(err).toBeInstanceOf(CortexApiError)
    expect(err).toMatchObject({ code: "not_found", status: 404 })

    expect((await client.catalog.search("claude")).length).toBe(2)
    expect((await client.providers.setKey("openai", "sk-xyz-1111")).keyHint).toBe("1111")
    const bot = await client.bots.create({ name: "Kernel", model: { providerID: "fake", modelID: "reasoner" } })
    await client.bots.memory.add(bot.id, "remember me")
    expect(await client.bots.memory.list(bot.id)).toHaveLength(1)
    const item = await client.space.create({ kind: "page", title: "Notes" })
    expect((await client.space.recents()).map((i) => i.id)).toEqual([item.id])
    expect((await client.connection.get()).mode).toBe("local")
    await srv.close()
  })
})
