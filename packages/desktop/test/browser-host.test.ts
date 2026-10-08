import { afterEach, describe, expect, it } from "vitest"
import { BrowserBridge } from "@cortex/core"
import { startBrowserHost } from "../src/browser-host"

const ORIGIN = `chrome-extension://${"a".repeat(32)}`
let close: (() => Promise<void>) | undefined
afterEach(async () => close?.())

async function boot() {
  const bridge = new BrowserBridge(), host = await startBrowserHost(bridge, [0])
  close = host.close
  const base = `http://127.0.0.1:${host.port}`
  const req = (path: string, init: { method?: string; token?: string; body?: unknown; origin?: string | null } = {}) =>
    fetch(base + path, { method: init.method ?? "POST", headers: { ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), "content-type": "application/json" }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  return { bridge, req }
}

describe("browser host", () => {
  it("pairs, shares and serves a read end to end", async () => {
    const { bridge, req } = await boot()
    const { code } = bridge.startPairing()
    const { token } = await (await req("/pair", { body: { code } })).json()
    expect((await req("/share", { token, body: { id: 5, title: "Docs", url: "https://a.test/" } })).status).toBe(204)
    const read = bridge.read(5)
    const { commands } = await (await req("/poll", { method: "GET", token })).json()
    expect(commands).toMatchObject([{ type: "read", tabId: 5 }])
    await req("/result", { token, body: { id: commands[0].id, ok: true, title: "Docs", url: "https://a.test/", text: "hi" } })
    await expect(read).resolves.toMatchObject({ text: "hi" })
  })
  it("refuses web-page origins, missing origins, bad codes and missing tokens", async () => {
    const { bridge, req } = await boot()
    const { code } = bridge.startPairing()
    expect((await req("/pair", { origin: "https://evil.test", body: { code } })).status).toBe(403)
    expect((await req("/pair", { origin: null, body: { code } })).status).toBe(403)
    expect((await req("/pair", { body: { code: "WRONGONE" } })).status).toBe(403)
    expect((await req("/share", { body: { id: 1, title: "", url: "https://a.test/" } })).status).toBe(401)
    expect(bridge.status().connected).toBe(false)
  })
  it("rejects a non-loopback Host header", async () => {
    const { bridge } = await boot()
    const port = bridge.status().port!
    const res = await fetch(`http://127.0.0.1:${port}/pair`, { method: "POST", headers: { origin: ORIGIN, host: "evil.test" }, body: "{}" })
    expect(res.status).toBe(403)
  })
})
