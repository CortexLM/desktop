import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { McpConfig, type McpServer } from "@cortex/schema"
import type { Bus } from "./bus"
import { CortexError } from "./error"
import type { Storage } from "./storage"
import type { Credentials } from "./provider"
import { randomUUID } from "node:crypto"

export interface McpTool {
  /** Exposed name: `<server>_<tool>`. */
  name: string
  server: string
  tool: string
  description?: string
  inputSchema: Record<string, unknown>
}

interface Live {
  client: Client
  tools: McpTool[]
}

type Stored = Pick<McpServer, "name" | "type" | "enabled"> & { connectionID: string }

export class McpService {
  private live = new Map<string, Live>()
  private pending = new Map<string, Client>()
  private version = new Map<string, object>()
  private status = new Map<string, Pick<McpServer, "status" | "error">>()
  /** Test seam: build the transport for a config. */
  transportFactory: (cfg: McpConfig) => Transport = defaultTransport

  constructor(
    private bus: Bus,
    private storage: Storage,
    private credentials?: Credentials,
  ) {}

  private configs(): (Stored | McpConfig)[] {
    return this.storage.listDocs<Stored | McpConfig>("mcp").sort((a, b) => a.name.localeCompare(b.name))
  }

  list(): McpServer[] {
    return this.configs().map((c) => this.view(c))
  }
  get(name: string): McpServer | undefined {
    const c = this.storage.getDoc<Stored | McpConfig>("mcp", name)
    return c && this.view(c)
  }
  private view(c: Stored | McpConfig): McpServer {
    const s = this.status.get(c.name) ?? { status: c.enabled ? "disconnected" : "disabled" }
    return { name: c.name, type: c.type, enabled: c.enabled, ...s, tools: (this.live.get(c.name)?.tools ?? []).map((t) => ({ name: t.tool, description: t.description })) }
  }

  private async store(cfg: McpConfig): Promise<Stored> {
    const credentials = this.credentials
    if (!credentials) throw new CortexError("mcp_connect_failed", "Connection storage unavailable")
    const old = this.storage.getDoc<Stored | McpConfig>("mcp", cfg.name)
    const record: Stored = { name: cfg.name, type: cfg.type, enabled: cfg.enabled, connectionID: randomUUID() }
    await credentials.set(record.connectionID, JSON.stringify(cfg))
    try {
      if (JSON.stringify(this.storage.getDoc("mcp", cfg.name)) !== JSON.stringify(old)) throw new CortexError("conflict", "Connection changed while saving")
      this.storage.putDoc("mcp", cfg.name, record)
      if (old && "connectionID" in old) void this.disconnect(cfg.name)
    } catch (err) { await Promise.resolve().then(() => credentials.delete(record.connectionID)).catch(() => undefined); throw err }
    // ponytail: unreachable credentials may remain after cleanup failure; add collection when the store supports enumeration.
    if (old && "connectionID" in old) void Promise.resolve().then(() => credentials.delete(old.connectionID)).catch(() => undefined)
    return record
  }

  private async config(name: string): Promise<McpConfig> {
    let record = this.storage.getDoc<Stored | McpConfig>("mcp", name)
    if (!record) throw new CortexError("not_found", "Unknown MCP server")
    if (!("connectionID" in record)) record = await this.store(McpConfig.parse(record))
    const value = await this.credentials?.get(record.connectionID)
    if (!value) throw new CortexError("mcp_connect_failed", "Connection configuration unavailable")
    const cfg = McpConfig.parse(JSON.parse(value))
    if (cfg.name !== name || cfg.type !== record.type) throw new CortexError("mcp_connect_failed", "Connection configuration unavailable")
    return { ...cfg, enabled: record.enabled }
  }

  async add(input: unknown): Promise<McpServer> {
    const cfg = McpConfig.parse(input)
    const stored = await this.store(cfg)
    const current = this.storage.getDoc<Stored>("mcp", cfg.name)
    if (current?.connectionID !== stored.connectionID) throw new CortexError("conflict", "Connection changed while saving")
    if (current.enabled !== cfg.enabled) return this.get(cfg.name)!
    this.status.delete(cfg.name)
    if (current.enabled) await this.connect(cfg.name).catch(() => undefined)
    return this.get(cfg.name)!
  }

  async remove(name: string): Promise<boolean> {
    const record = this.storage.getDoc<Stored | McpConfig>("mcp", name)
    if (!record) return false
    this.storage.deleteDoc("mcp", name)
    await this.disconnect(name)
    if ("connectionID" in record) await Promise.resolve().then(() => this.credentials?.delete(record.connectionID)).catch(() => undefined)
    if (!this.get(name)) this.status.delete(name)
    return true
  }

  async setEnabled(name: string, enabled: boolean): Promise<McpServer> {
    let c = this.storage.getDoc<Stored | McpConfig>("mcp", name)
    if (!c) throw new CortexError("not_found", `Unknown MCP server ${name}`)
    if (!("connectionID" in c)) c = await this.store(McpConfig.parse(c))
    if (this.storage.getDoc<Stored>("mcp", name)?.connectionID !== c.connectionID) throw new CortexError("conflict", "Connection changed while saving")
    this.storage.putDoc("mcp", name, { ...c, enabled })
    if (enabled) await this.connect(name).catch(() => undefined)
    else {
      const disconnected = this.disconnect(name)
      this.setStatus(name, "disabled")
      await disconnected
    }
    return this.get(name)!
  }

  private setStatus(name: string, status: McpServer["status"], error?: McpServer["error"]) {
    this.status.set(name, { status, error })
    this.bus.publish("mcp.status", { name, status, error })
  }

  async connect(name: string): Promise<McpServer> {
    if (!this.get(name)) throw new CortexError("not_found", `Unknown MCP server ${name}`)
    const version = {}
    const disconnected = this.disconnect(name, version)
    const client = new Client({ name: "cortex", version: "0.2.0" })
    if (this.version.get(name) === version) this.pending.set(name, client)
    try {
      await disconnected
      if (this.version.get(name) !== version) throw new CortexError("aborted", "Connection cancelled")
      const cfg = await this.config(name)
      if (this.version.get(name) !== version || this.pending.get(name) !== client) throw new CortexError("aborted", "Connection cancelled")
      await client.connect(this.transportFactory(cfg))
      const { tools } = await client.listTools()
      if (this.version.get(name) !== version || this.pending.get(name) !== client) throw new CortexError("aborted", "Connection cancelled")
      this.live.set(name, {
        client,
        tools: tools.map((t) => ({ name: `${name}_${t.name}`, server: name, tool: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })),
      })
      this.setStatus(name, "connected")
    } catch {
      await client.close().catch(() => undefined)
      const error = { code: "mcp_connect_failed" as const, message: `Could not connect to MCP server ${name}` }
      if (this.version.get(name) === version && this.pending.get(name) === client && this.get(name)) this.setStatus(name, "failed", error)
      throw new CortexError(error.code, error.message)
    } finally {
      if (this.pending.get(name) === client) this.pending.delete(name)
    }
    return this.get(name)!
  }

  async disconnect(name: string, version = {}) {
    this.version.set(name, version)
    const pending = this.pending.get(name)
    this.pending.delete(name)
    const l = this.live.get(name)
    this.live.delete(name)
    if (l && this.get(name)) this.setStatus(name, "disconnected")
    await Promise.all([...new Set([pending, l?.client])].filter((c) => c !== undefined).map((c) => c.close().catch(() => undefined)))
  }

  async connectAll() {
    await Promise.all(this.configs().map(async (c) => {
      let current: Stored | McpConfig = c
      try {
        if (!("connectionID" in c)) current = await this.store(McpConfig.parse(c))
        if (JSON.stringify(this.storage.getDoc("mcp", c.name)) !== JSON.stringify(current)) return
        if (c.enabled) await this.connect(c.name).catch(() => undefined)
        else this.setStatus(c.name, "disabled")
      } catch {
        if (JSON.stringify(this.storage.getDoc("mcp", c.name)) === JSON.stringify(current)) this.setStatus(c.name, "failed", { code: "mcp_connect_failed", message: "Connection configuration unavailable" })
      }
    }))
  }

  tools(): McpTool[] {
    return [...this.live.values()].flatMap((l) => l.tools)
  }

  async call(server: string, tool: string, args: unknown, signal?: AbortSignal): Promise<{ output: string; isError: boolean }> {
    const l = this.live.get(server)
    if (!l) throw new CortexError("mcp_connect_failed", `MCP server ${server} is not connected`)
    const res = (await l.client.callTool({ name: tool, arguments: (args ?? {}) as Record<string, unknown> }, undefined, { signal })) as {
      content?: { type: string; text?: string }[]
      isError?: boolean
    }
    const output = (res.content ?? []).map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n")
    return { output, isError: !!res.isError }
  }

  async close() {
    await Promise.all([...new Set([...this.live.keys(), ...this.pending.keys()])].map((n) => this.disconnect(n)))
  }
}

function defaultTransport(cfg: McpConfig): Transport {
  if (cfg.type === "stdio") return new StdioClientTransport({ command: cfg.command, args: cfg.args, env: { ...getDefaultEnvironment(), ...cfg.env }, stderr: "ignore" })
  return new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers, redirect: "error" } })
}
