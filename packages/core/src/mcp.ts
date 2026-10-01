import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { McpConfig, type McpServer } from "@cortex/schema"
import type { Bus } from "./bus"
import { CortexError } from "./error"
import type { Storage } from "./storage"

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

export class McpService {
  private live = new Map<string, Live>()
  private status = new Map<string, Pick<McpServer, "status" | "error">>()
  /** Test seam: build the transport for a config. */
  transportFactory: (cfg: McpConfig) => Transport = defaultTransport

  constructor(
    private bus: Bus,
    private storage: Storage,
  ) {}

  configs(): McpConfig[] {
    return this.storage.listDocs<McpConfig>("mcp").sort((a, b) => a.name.localeCompare(b.name))
  }

  list(): McpServer[] {
    return this.configs().map((c) => this.view(c))
  }
  get(name: string): McpServer | undefined {
    const c = this.storage.getDoc<McpConfig>("mcp", name)
    return c && this.view(c)
  }
  private view(c: McpConfig): McpServer {
    const s = this.status.get(c.name) ?? { status: c.enabled ? "disconnected" : "disabled" }
    return { ...c, ...s, tools: (this.live.get(c.name)?.tools ?? []).map((t) => ({ name: t.tool, description: t.description })) } as McpServer
  }

  async add(input: unknown): Promise<McpServer> {
    const cfg = McpConfig.parse(input)
    this.storage.putDoc("mcp", cfg.name, cfg)
    if (cfg.enabled) await this.connect(cfg.name).catch(() => undefined)
    return this.get(cfg.name)!
  }

  async remove(name: string): Promise<boolean> {
    await this.disconnect(name)
    this.status.delete(name)
    return this.storage.deleteDoc("mcp", name)
  }

  async setEnabled(name: string, enabled: boolean): Promise<McpServer> {
    const c = this.storage.getDoc<McpConfig>("mcp", name)
    if (!c) throw new CortexError("not_found", `Unknown MCP server ${name}`)
    this.storage.putDoc("mcp", name, { ...c, enabled })
    if (enabled) await this.connect(name).catch(() => undefined)
    else {
      await this.disconnect(name)
      this.setStatus(name, "disabled")
    }
    return this.get(name)!
  }

  private setStatus(name: string, status: McpServer["status"], error?: McpServer["error"]) {
    this.status.set(name, { status, error })
    this.bus.publish("mcp.status", { name, status, error })
  }

  async connect(name: string): Promise<McpServer> {
    const cfg = this.storage.getDoc<McpConfig>("mcp", name)
    if (!cfg) throw new CortexError("not_found", `Unknown MCP server ${name}`)
    await this.disconnect(name)
    const client = new Client({ name: "cortex", version: "0.2.0" })
    try {
      await client.connect(this.transportFactory(cfg))
      const { tools } = await client.listTools()
      this.live.set(name, {
        client,
        tools: tools.map((t) => ({ name: `${name}_${t.name}`, server: name, tool: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })),
      })
      this.setStatus(name, "connected")
    } catch {
      await client.close().catch(() => undefined)
      const error = { code: "mcp_connect_failed" as const, message: `Could not connect to MCP server ${name}` }
      this.setStatus(name, "failed", error)
      throw new CortexError(error.code, error.message)
    }
    return this.get(name)!
  }

  async disconnect(name: string) {
    const l = this.live.get(name)
    if (!l) return
    this.live.delete(name)
    await l.client.close().catch(() => undefined)
    this.setStatus(name, "disconnected")
  }

  async connectAll() {
    await Promise.all(this.configs().filter((c) => c.enabled).map((c) => this.connect(c.name).catch(() => undefined)))
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
    await Promise.all([...this.live.keys()].map((n) => this.disconnect(n)))
  }
}

function defaultTransport(cfg: McpConfig): Transport {
  if (cfg.type === "stdio") return new StdioClientTransport({ command: cfg.command, args: cfg.args, env: { ...getDefaultEnvironment(), ...cfg.env }, stderr: "ignore" })
  return new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers } })
}
