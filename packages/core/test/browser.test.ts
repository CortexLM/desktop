import { describe, expect, it } from "vitest"
import { BrowserBridge, PAIRING_TTL_MS, MAX_PAIRING_ATTEMPTS } from "../src/browser"

const clock = () => { let t = 1_000; return { now: () => t, advance: (ms: number) => void (t += ms) } }
const paired = () => { const c = clock(), b = new BrowserBridge(c.now), token = b.pair(b.startPairing().code); return { b, c, token } }

describe("pairing", () => {
  it("accepts the code once, tolerating case and dashes, and issues a token", () => {
    const b = new BrowserBridge(), { code } = b.startPairing()
    const token = b.pair(`${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase())
    expect(b.authenticate(token)).toBe(true)
    expect(() => b.pair(code)).toThrow(/No active pairing code/)
  })
  it("rejects expired codes", () => {
    const c = clock(), b = new BrowserBridge(c.now), { code } = b.startPairing()
    c.advance(PAIRING_TTL_MS + 1)
    expect(b.status().pairing).toBeUndefined()
    expect(() => b.pair(code)).toThrow()
  })
  it("burns the code after repeated wrong guesses", () => {
    const b = new BrowserBridge(), { code } = b.startPairing()
    for (let i = 0; i < MAX_PAIRING_ATTEMPTS; i++) expect(() => b.pair("AAAAAAAA")).toThrow(/Wrong pairing code/)
    expect(() => b.pair(code)).toThrow()
  })
  it("rejects unknown tokens and drops everything on disconnect", () => {
    const { b, token } = paired()
    expect(b.authenticate("nope")).toBe(false)
    b.share({ id: 1, title: "t", url: "https://a.test/" })
    b.disconnect()
    expect(b.authenticate(token)).toBe(false)
    expect(b.status().tabs).toEqual([])
  })
  it("a new pairing replaces the old token and consents", () => {
    const { b, token } = paired()
    b.share({ id: 1, title: "t", url: "https://a.test/" })
    b.pair(b.startPairing().code)
    expect(b.authenticate(token)).toBe(false)
    expect(b.status().tabs).toEqual([])
  })
})

describe("consent", () => {
  it("only shares web pages", () => {
    const { b } = paired()
    for (const url of ["chrome://settings", "file:///etc/passwd", "javascript:1", "https://u:p@a.test/", "nonsense"]) expect(() => b.share({ id: 1, title: "x", url })).toThrow()
    b.share({ id: 2, title: "ok", url: "https://a.test/" })
    expect(b.status().tabs.map((t) => t.id)).toEqual([2])
  })
  it("refuses to read a tab that was not shared, without asking the browser", async () => {
    const { b } = paired()
    await expect(b.read(9)).rejects.toMatchObject({ code: "permission_denied" })
    expect(await b.poll(0)).toEqual([])
  })
  it("reads a shared tab through the extension", async () => {
    const { b } = paired()
    b.share({ id: 3, title: "Docs", url: "https://a.test/x" })
    const pending = b.read(3)
    const [cmd] = await b.poll(0)
    expect(cmd).toMatchObject({ type: "read", tabId: 3 })
    b.complete(cmd!.id, { ok: true, title: "Docs", url: "https://a.test/x", text: "hello" })
    await expect(pending).resolves.toEqual({ title: "Docs", url: "https://a.test/x", text: "hello" })
  })
  it("revoking rejects an in-flight read and tells the extension", async () => {
    const { b } = paired()
    b.share({ id: 3, title: "Docs", url: "https://a.test/" })
    const pending = b.read(3)
    await b.poll(0)
    b.revoke(3, true)
    await expect(pending).rejects.toMatchObject({ code: "permission_denied" })
    expect(await b.poll(0)).toMatchObject([{ type: "revoke", tabId: 3 }])
    await expect(b.read(3)).rejects.toMatchObject({ code: "permission_denied" })
  })
  it("drops consent when the tab navigated elsewhere", async () => {
    const { b } = paired()
    b.share({ id: 3, title: "Docs", url: "https://a.test/" })
    const pending = b.read(3)
    const [cmd] = await b.poll(0)
    b.complete(cmd!.id, { ok: true, title: "Bank", url: "https://bank.test/", text: "secret" })
    await expect(pending).rejects.toMatchObject({ code: "permission_denied" })
    expect(b.status().tabs).toEqual([])
  })
  it("rejects an already-aborted read without queueing it", async () => {
    const { b } = paired()
    b.share({ id: 3, title: "Docs", url: "https://a.test/" })
    const ctl = new AbortController()
    ctl.abort()
    await expect(b.read(3, ctl.signal)).rejects.toMatchObject({ code: "aborted" })
    expect(await b.poll(0)).toEqual([])
  })
  it("removes its abort listener once the read settles", async () => {
    const { b } = paired()
    b.share({ id: 3, title: "Docs", url: "https://a.test/" })
    const ctl = new AbortController(), removed: string[] = []
    const remove = ctl.signal.removeEventListener.bind(ctl.signal)
    ctl.signal.removeEventListener = ((type: string, ...rest: [EventListenerOrEventListenerObject]) => (removed.push(type), remove(type, ...rest))) as typeof remove
    const pending = b.read(3, ctl.signal)
    const [cmd] = await b.poll(0)
    b.complete(cmd!.id, { ok: true, title: "Docs", url: "https://a.test/", text: "x" })
    await pending
    expect(removed).toContain("abort")
  })
  it("refuses reads while the extension is silent", async () => {
    const { b, c } = paired()
    b.share({ id: 3, title: "Docs", url: "https://a.test/" })
    c.advance(60_000)
    await expect(b.read(3)).rejects.toMatchObject({ code: "tool_failed" })
  })
})
