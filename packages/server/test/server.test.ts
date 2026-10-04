import { afterEach, describe, expect, it } from "vitest"
import { routes } from "@cortex/protocol"
import { createServer, listen } from "../src/index"
import { fakeOpenAI, testCore, toolCall } from "../../core/test/helpers"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const json = (method: string, path: string, body?: unknown) =>
  new Request(`http://local${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })

describe("server via app.fetch", () => {
  let close: (() => Promise<void>) | undefined
  afterEach(async () => close?.())

  it("CRUD, validation and stable error shape", async () => {
    const core = testCore("http://127.0.0.1:9/v1")
    const app = createServer(core)
    expect(await (await app.fetch(json("GET", "/api/health"))).json()).toMatchObject({ ok: true })

    const created = await app.fetch(json("POST", "/api/sessions", { model: { providerID: "fake", modelID: "reasoner" } }))
    expect(created.status).toBe(201)
    const s = await created.json()
    expect((await (await app.fetch(json("GET", "/api/sessions"))).json()).map((x: any) => x.id)).toEqual([s.id])

    const bad = await app.fetch(json("POST", "/api/sessions", { model: "nope" }))
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: { code: "invalid_request", message: "Invalid request at model" } })

    const missing = await app.fetch(json("GET", "/api/sessions/ses_missing"))
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe("not_found")

    const img = await app.fetch(json("POST", `/api/sessions/${s.id}/prompt`, { parts: [{ type: "file", mime: "image/png", data: "AA==" }], model: { providerID: "fake", modelID: "text-only" } }))
    expect(img.status).toBe(422)
    expect((await img.json()).error.code).toBe("model_no_image_input")
    expect(core.sessions.get(s.id).model.modelID).toBe("reasoner") // rejected prompt leaves the session untouched

    const notJson = await app.fetch(new Request("http://local/api/sessions", { method: "POST", body: "{" }))
    expect(notJson.status).toBe(400)
    expect((await (await app.fetch(json("GET", "/api/nope"))).json()).error.code).toBe("not_found")
  })

  it("provider key route is write-only", async () => {
    const app = createServer(testCore("http://x"))
    const res = await app.fetch(json("PUT", "/api/providers/openai/key", { key: "sk-very-secret-9876" }))
    const body = await res.text()
    expect(body).not.toContain("secret")
    expect(JSON.parse(body)).toMatchObject({ hasKey: true, keyHint: "9876" })
  })

  it("refuses a duplicate active routine through the run route", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-routine-"))
    const srv = await fakeOpenAI([{ deltas: [toolCall("wait", "bash", { command: "echo test" })], finish: "tool_calls" }])
    const core = testCore(srv.url)
    close = async () => { await core.close(); await srv.close(); rmSync(dir, { recursive: true, force: true }) }
    const task = core.scheduler.create({ title: "Single routine", prompt: "run", schedule: { type: "daily", time: "09:00" }, model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
    const app = createServer(core)
    const request = () => app.fetch(json("POST", `/api/tasks/${task.id}/run`))
    const asked = new Promise<string>((resolve) => core.bus.on("permission.asked", ({ properties }) => resolve(properties.permission.sessionID)))
    expect((await request()).status).toBe(202)
    const sessionID = await asked
    const duplicate = await request()
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json()).error.code).toBe("conflict")
    await core.sessions.abort(sessionID)
    expect(core.scheduler.get(task.id).runs).toHaveLength(1)
  })

  it("MCP routes never return connection URLs, commands, arguments or credentials", async () => {
    const core = testCore("http://x")
    const app = createServer(core)
    close = () => core.close()
    for (const cfg of [
      { name: "stdio", type: "stdio", command: "private-command", args: ["private-argument"], env: { TOKEN: "private-env" }, enabled: false },
      { name: "remote", type: "remote", url: "https://private.test/private-path", headers: { Authorization: "private-header" }, enabled: false },
    ]) {
      const response = await app.fetch(json("POST", "/api/mcp", cfg))
      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({ name: cfg.name, type: cfg.type, enabled: false, status: "disabled", tools: [] })
      for (const request of [json("GET", "/api/mcp"), json("PATCH", `/api/mcp/${cfg.name}`, { enabled: false }), json("POST", `/api/mcp/${cfg.name}/disconnect`)]) {
        const r = await app.fetch(request)
        expect(r.ok).toBe(true)
        expect(await r.text()).not.toContain("private-")
      }
    }
    for (const url of ["not a URL", "file:///tmp/socket", "ftp://private.test"]) {
      const response = await app.fetch(json("POST", "/api/mcp", { name: "bad", type: "remote", url, enabled: false }))
      expect(response.status).toBe(400)
      expect((await response.json()).error.code).toBe("invalid_request")
    }
  })

  it("prompt returns 202 and SSE carries the run", async () => {
    const srv = await fakeOpenAI([{ deltas: [{ reasoning_content: "hm" }, { content: "Hello" }], finish: "stop" }])
    const core = testCore(srv.url)
    const app = createServer(core)
    close = srv.close
    const s = await (await app.fetch(json("POST", "/api/sessions", { model: { providerID: "fake", modelID: "reasoner" } }))).json()
    const ctrl = new AbortController()
    const events = await app.fetch(new Request("http://local/api/events", { signal: ctrl.signal }))
    expect(events.headers.get("content-type")).toBe("text/event-stream")
    const res = await app.fetch(json("POST", `/api/sessions/${s.id}/prompt`, { parts: [{ type: "text", text: "hi" }] }))
    expect(res.status).toBe(202)
    const reader = events.body!.getReader()
    let text = ""
    while (!text.includes('"type":"idle"')) text += new TextDecoder().decode((await reader.read()).value)
    ctrl.abort()
    expect(text).toContain('"field":"reasoning"')
    expect(text).toContain('"delta":"Hello"')
    const msgs = await (await app.fetch(json("GET", `/api/sessions/${s.id}/messages`))).json()
    expect(msgs[1].parts.some((p: any) => p.type === "text" && p.text === "Hello")).toBe(true)
  })

  it("every route is mounted", async () => {
    const app = createServer(testCore("http://x"))
    for (const def of Object.values(routes)) {
      if (def.path === "/api/events" || def.path === "/api/catalog/refresh") continue // stream / live network
      const res = await app.fetch(json(def.method.toUpperCase(), def.path.replace(/:[a-zA-Z]+/g, "x"), def.method === "get" || def.method === "delete" ? undefined : {}))
      expect([200, 201, 202, 400, 404, 409, 422, 503]).toContain(res.status)
      if (res.status === 404) expect((await res.json()).error.message).not.toBe("Route not found")
    }
  })

  it("listen() serves over a real socket", async () => {
    const h = await listen(createServer(testCore("http://x")))
    close = h.close
    expect(await (await fetch(`${h.url}/api/health`)).json()).toMatchObject({ ok: true })
  })
})
