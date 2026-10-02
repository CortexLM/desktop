import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import http from "node:http"
import { describe, expect, it, vi } from "vitest"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createCore, memoryCredentials } from "../src/index"

describe("main-only MCP connection configuration", () => {
  it("refuses persistent MCP writes without a host credential store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-mcp-no-store-"))
    const core = createCore({ dataDir: dir, credentials: memoryCredentials() })
    try {
      await expect(core.mcp.add({ name: "private", type: "stdio", command: "private-command", enabled: false })).rejects.toMatchObject({ code: "mcp_connect_failed" })
      expect(core.storage.listDocs("mcp")).toEqual([])
      const legacy = { name: "legacy", type: "stdio", command: "legacy-command", enabled: false }
      core.storage.putDoc("mcp", "legacy", legacy)
      await core.mcp.connectAll()
      expect(core.storage.getDoc("mcp", "legacy")).toEqual(legacy)
      expect(core.mcp.get("legacy")?.status).toBe("failed")
    } finally { await core.close(); rmSync(dir, { recursive: true, force: true }) }
  })

  it("returns metadata only and keeps complete connection material out of SQLite across reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-mcp-"))
    const credentials = memoryCredentials()
    const mcpCredentials = memoryCredentials()
    let core = createCore({ dataDir: dir, credentials, mcpCredentials })
    const cfg = { name: "private", type: "stdio" as const, command: "private-command", args: ["private-argument"], env: { TOKEN: "private-environment" }, enabled: false }
    try {
      const saved = await core.mcp.add(cfg)
      expect(saved).toEqual({ name: "private", type: "stdio", enabled: false, status: "disabled", tools: [] })
      expect(JSON.stringify(core.storage.listDocs("mcp"))).not.toContain("private-command")
      expect(JSON.stringify(core.storage.listDocs("mcp"))).not.toContain("private-argument")
      expect(JSON.stringify(core.storage.listDocs("mcp"))).not.toContain("private-environment")
      await core.close()
      core = createCore({ dataDir: dir, credentials, mcpCredentials })
      const server = new SdkMcpServer({ name: "private", version: "1" })
      server.registerTool("ping", {}, async () => ({ content: [{ type: "text", text: "ok" }] }))
      let supplied: unknown
      core.mcp.transportFactory = (input) => {
        supplied = input
        const [client, remote] = InMemoryTransport.createLinkedPair()
        void server.connect(remote)
        return client
      }
      expect((await core.mcp.setEnabled("private", true)).status).toBe("connected")
      expect(supplied).toEqual({ ...cfg, enabled: true })
      expect(JSON.stringify(core.mcp.list())).not.toContain("private-command")
      await core.mcp.remove("private")
      expect(core.mcp.list()).toEqual([])
    } finally { await core.close(); rmSync(dir, { recursive: true, force: true }) }
  })

  it("preserves prior configuration when its replacement cannot be stored", async () => {
    const store = memoryCredentials()
    let refuse = false
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), mcpCredentials: {
      ...store,
      set: (id, value) => { if (refuse) throw new Error("credential write failed"); return store.set(id, value) },
    } })
    try {
      await core.mcp.add({ name: "remote", type: "remote", url: "https://private.test/secret", headers: { Authorization: "private-header" }, enabled: false })
      const before = core.storage.listDocs("mcp")
      refuse = true
      await expect(core.mcp.add({ name: "remote", type: "remote", url: "https://replacement.test", enabled: false })).rejects.toThrow()
      expect(core.storage.listDocs("mcp")).toEqual(before)
      expect(core.mcp.get("remote")).toEqual({ name: "remote", type: "remote", enabled: false, status: "disabled", tools: [] })
    } finally { await core.close() }
  })

  it("retains the old connection when the metadata write fails", async () => {
    const credentials = memoryCredentials()
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), mcpCredentials: credentials })
    try {
      await core.mcp.add({ name: "remote", type: "remote", url: "https://prior.test", enabled: false })
      const before = core.storage.getDoc<{ connectionID: string }>("mcp", "remote")!
      const write = vi.spyOn(core.storage, "putDoc").mockImplementationOnce(() => { throw new Error("disk full") })
      await expect(core.mcp.add({ name: "remote", type: "remote", url: "https://next.test", enabled: false })).rejects.toThrow("disk full")
      write.mockRestore()
      expect(core.storage.getDoc("mcp", "remote")).toEqual(before)
      expect(await credentials.get(before.connectionID)).toContain("https://prior.test")
    } finally { await core.close() }
  })

  it("migrates legacy configuration only after credential persistence succeeds", async () => {
    const store = memoryCredentials()
    let refuse = true
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), mcpCredentials: {
      ...store,
      set: (id, value) => { if (refuse) throw new Error("credential write failed"); return store.set(id, value) },
    } })
    const legacy = { name: "legacy", type: "remote", url: "https://legacy.test/token", headers: { Authorization: "legacy-secret" }, enabled: false }
    try {
      core.storage.putDoc("mcp", "legacy", legacy)
      expect(JSON.stringify(core.mcp.list())).not.toContain("legacy-secret")
      await core.mcp.connectAll()
      expect(core.storage.getDoc("mcp", "legacy")).toEqual(legacy)
      expect(core.mcp.get("legacy")?.status).toBe("failed")
      refuse = false
      await core.mcp.connectAll()
      expect(JSON.stringify(core.storage.getDoc("mcp", "legacy"))).not.toContain("legacy-secret")
      expect(core.mcp.get("legacy")?.status).toBe("disabled")
    } finally { await core.close() }
  })

  it("does not publish a connection after it was removed during credential lookup", async () => {
    const store = memoryCredentials()
    let reading!: () => void, release!: () => void
    const entered = new Promise<void>((r) => { reading = r })
    const wait = new Promise<void>((r) => { release = r })
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), mcpCredentials: {
      ...store,
      get: async (id) => { const value = await store.get(id); reading(); await wait; return value },
    } })
    const server = new SdkMcpServer({ name: "pending", version: "1" })
    server.registerTool("ping", {}, async () => ({ content: [{ type: "text", text: "ok" }] }))
    let transports = 0
    core.mcp.transportFactory = () => {
      transports++
      const [client, remote] = InMemoryTransport.createLinkedPair()
      void server.connect(remote)
      return client
    }
    try {
      await core.mcp.add({ name: "pending", type: "stdio", command: "unused", enabled: false })
      const pending = core.mcp.connect("pending").catch(() => undefined)
      await entered
      await core.mcp.remove("pending")
      release()
      await pending
      expect(core.mcp.get("pending")).toBeUndefined()
      expect(core.mcp.tools()).toEqual([])
      expect(transports).toBe(0)
    } finally { release(); await core.close() }
  })

  it("does not restore a removed configuration when a pending replacement finishes", async () => {
    const store = memoryCredentials()
    let hold = false, reading!: () => void, release!: () => void
    const entered = new Promise<void>((r) => { reading = r })
    const wait = new Promise<void>((r) => { release = r })
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), mcpCredentials: {
      ...store,
      set: async (id, value) => { if (hold) { reading(); await wait } await store.set(id, value) },
    } })
    try {
      const cfg = { name: "pending", type: "remote", url: "https://prior.test", enabled: false }
      await core.mcp.add(cfg)
      hold = true
      const pending = core.mcp.add({ ...cfg, url: "https://replacement.test" }).then(() => "saved", (err) => err.code)
      await entered
      await core.mcp.remove("pending")
      release()
      expect(await pending).toBe("conflict")
      expect(core.mcp.list()).toEqual([])
    } finally { release(); await core.close() }
  })

  it("an admitted save does not auto-connect after a newer disable", async () => {
    const store = memoryCredentials()
    let release!: () => void
    const wait = new Promise<void>((r) => { release = r })
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), mcpCredentials: {
      ...store, set: (id, value) => { store.set(id, value); return wait },
    } })
    const server = new SdkMcpServer({ name: "pending", version: "1" })
    server.registerTool("ping", {}, async () => ({ content: [{ type: "text", text: "ok" }] }))
    let transports = 0, disabling: Promise<unknown> | undefined
    core.mcp.transportFactory = () => {
      transports++
      const [client, remote] = InMemoryTransport.createLinkedPair()
      void server.connect(remote)
      return client
    }
    try {
      const saving = core.mcp.add({ name: "pending", type: "stdio", command: "unused" })
      release()
      queueMicrotask(() => { disabling = core.mcp.setEnabled("pending", false) })
      await saving
      await disabling
      expect(core.mcp.get("pending")?.status).toBe("disabled")
      expect(core.mcp.get("pending")?.enabled).toBe(false)
      expect(core.mcp.tools()).toEqual([])
      expect(transports).toBe(0)
    } finally { release(); await core.close() }
  })

  it("a reconnect waiting for the old transport cannot override a newer disable", async () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    const server = new SdkMcpServer({ name: "slow", version: "1" })
    server.registerTool("ping", {}, async () => ({ content: [{ type: "text", text: "ok" }] }))
    const [client, remote] = InMemoryTransport.createLinkedPair()
    await server.connect(remote)
    let transports = 0, closing!: () => void, release!: () => void
    const entered = new Promise<void>((r) => { closing = r })
    const wait = new Promise<void>((r) => { release = r })
    core.mcp.transportFactory = () => { transports++; return client }
    try {
      await core.mcp.add({ name: "slow", type: "stdio", command: "unused" })
      const close = client.close.bind(client)
      vi.spyOn(client, "close").mockImplementationOnce(async () => { closing(); await wait; await close() })
      const reconnect = core.mcp.connect("slow").catch(() => undefined)
      await entered
      await core.mcp.setEnabled("slow", false)
      release()
      await reconnect
      expect(core.mcp.get("slow")?.status).toBe("disabled")
      expect(core.mcp.tools()).toEqual([])
      expect(transports).toBe(1)
    } finally { release(); await core.close() }
  })

  it("a removal waiting for transport close preserves a newly saved replacement", async () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    const server = new SdkMcpServer({ name: "slow", version: "1" })
    server.registerTool("ping", {}, async () => ({ content: [{ type: "text", text: "ok" }] }))
    const [client, remote] = InMemoryTransport.createLinkedPair()
    await server.connect(remote)
    core.mcp.transportFactory = () => client
    let closing!: () => void, release!: () => void
    const entered = new Promise<void>((r) => { closing = r })
    const wait = new Promise<void>((r) => { release = r })
    try {
      await core.mcp.add({ name: "slow", type: "stdio", command: "unused" })
      const close = client.close.bind(client)
      vi.spyOn(client, "close").mockImplementationOnce(async () => { closing(); await wait; await close() })
      const removing = core.mcp.remove("slow")
      await entered
      await core.mcp.add({ name: "slow", type: "remote", url: "https://replacement.test", enabled: false })
      release()
      await removing
      expect(core.mcp.get("slow")).toEqual({ name: "slow", type: "remote", enabled: false, status: "disabled", tools: [] })
    } finally { release(); await core.close() }
  })

  it("refuses redirects before custom authentication headers reach another endpoint", async () => {
    let received = 0
    const destination = http.createServer((_req, res) => { received++; res.writeHead(400); res.end() })
    await new Promise<void>((r) => destination.listen(0, "127.0.0.1", r))
    const port = (destination.address() as { port: number }).port
    const origin = http.createServer((_req, res) => { res.writeHead(307, { location: `http://127.0.0.1:${port}` }); res.end() })
    await new Promise<void>((r) => origin.listen(0, "127.0.0.1", r))
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    try {
      const info = await core.mcp.add({ name: "redirect", type: "remote", url: `http://127.0.0.1:${(origin.address() as { port: number }).port}`, headers: { "X-Api-Key": "test-private-header" } })
      expect(info.status).toBe("failed")
      expect(received).toBe(0)
    } finally {
      await core.close()
      for (const server of [origin, destination]) await new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) })
    }
  })
})
