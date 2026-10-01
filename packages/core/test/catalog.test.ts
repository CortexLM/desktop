import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { capabilities } from "@cortex/schema"
import { Catalog, CATALOG_URL, parseCatalog } from "../src/index"
import { fixture } from "./helpers"

describe("catalog", () => {
  it("parses providers, skipping malformed entries", () => {
    const data = parseCatalog(fixture())
    expect(Object.keys(data).sort()).toEqual(["anthropic", "fake", "google", "mistralish", "openai"])
    expect(data.fake!.models.reasoner!.limit).toEqual({ context: 100000, output: 4000 })
  })

  it("derives capabilities", () => {
    const data = parseCatalog(fixture())
    expect(capabilities(data.fake!.models.reasoner!)).toEqual({
      reasoning: true,
      imageInput: true,
      pdfInput: false,
      tools: true,
      contextWindow: 100000,
      maxOutput: 4000,
      cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0 },
    })
    const plain = capabilities(data.fake!.models["text-only"]!)
    expect(plain).toMatchObject({ reasoning: false, imageInput: false, tools: false })
    expect(capabilities(data.anthropic!.models["claude-x"]!).pdfInput).toBe(true)
  })

  it("searches across providers and models, all terms must match", async () => {
    const c = new Catalog({})
    c.set(fixture())
    expect((await c.search("claude")).map((m) => `${m.providerID}/${m.id}`)).toEqual(["anthropic/claude-x", "anthropic/claude-plain"])
    expect((await c.search("anthropic plain")).map((m) => m.id)).toEqual(["claude-plain"])
    expect((await c.search("Reasoner LARGE"))[0]?.capabilities.reasoning).toBe(true)
    expect(await c.search("nothing-matches")).toEqual([])
  })

  it("marks unsupported SDKs", async () => {
    const c = new Catalog({})
    c.set(fixture())
    const ps = Object.fromEntries((await c.providers()).map((p) => [p.id, p.supported]))
    expect(ps).toMatchObject({ fake: true, anthropic: true, openai: true, google: true, mistralish: false })
  })

  it("caches network results and falls back to cache offline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-cat-"))
    const online = new Catalog({ cacheDir: dir, fetch: async () => new Response(JSON.stringify(fixture())) })
    await online.load()
    expect(online.source).toBe("network")
    const offline = new Catalog({ cacheDir: dir, fetch: async () => { throw new Error("offline") } })
    await offline.load()
    expect(offline.source).toBe("cache")
    expect(await offline.model("fake", "reasoner")).toBeDefined()
    const empty = new Catalog({ cacheDir: join(dir, "nope"), fetch: async () => { throw new Error("offline") } })
    await expect(empty.load()).rejects.toMatchObject({ code: "catalog_unavailable" })
    writeFileSync(join(dir, "models.json"), "not json")
    await expect(new Catalog({ cacheDir: dir, fetch: async () => new Response("", { status: 500 }) }).load()).rejects.toMatchObject({ code: "catalog_unavailable" })
  })

  it("live: fetches models.dev (skipped offline)", async (ctx) => {
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(8000) }).catch(() => undefined)
    if (!res?.ok) return ctx.skip()
    const data = parseCatalog(await res.json())
    expect(Object.keys(data).length).toBeGreaterThan(10)
    expect(data.anthropic?.npm).toBe("@ai-sdk/anthropic")
  }, 20_000)
})
