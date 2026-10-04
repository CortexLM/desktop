import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createApi, routes, toApiError, type Handlers } from "../src/index"

describe("protocol", () => {
  it("maps errors to the public shape without leaking unknown messages", () => {
    expect(toApiError({ code: "model_no_image_input", message: "nope" })).toEqual({ status: 422, body: { error: { code: "model_no_image_input", message: "nope" } } })
    expect(toApiError(new Error("secret stack detail"))).toEqual({ status: 500, body: { error: { code: "internal", message: "Internal error" } } })
    expect(toApiError(z.object({ a: z.string() }).safeParse({}).error).status).toBe(400)
  })

  it("routes are unique and under /api", () => {
    const keys = Object.values(routes).map((r) => `${r.method} ${r.path}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => k.includes(" /api/"))).toBe(true)
  })

  it("validates bodies before calling handlers", async () => {
    let called = false
    const handlers = new Proxy({}, { get: () => () => ((called = true), { ok: 1 }) }) as Handlers
    const app = createApi(handlers)
    const res = await app.fetch(new Request("http://x/api/permissions/p1/reply", { method: "POST", body: JSON.stringify({ reply: "maybe" }) }))
    expect(res.status).toBe(400)
    expect(called).toBe(false)
    const ok = await app.fetch(new Request("http://x/api/permissions/p1/reply", { method: "POST", body: JSON.stringify({ reply: "once" }) }))
    expect(ok.status).toBe(200)
  })
})
