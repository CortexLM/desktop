import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { PermissionRule, type PermissionRule as Rule } from "@cortex/schema"
import { z } from "zod"
import { AGENTS } from "./agent"
import { BotService } from "./bot"
import { Bus } from "./bus"
import { Catalog } from "./catalog"
import { ConnectionService, type RemoteAuth, type RemoteProbe } from "./connection"
import { COMPUTER_USE_SERVER, computerUsePreset } from "./computer-use"
import { McpService } from "./mcp"
import { PermissionService } from "./permission"
import { PluginRegistry, type PluginDirs } from "./plugin"
import { memoryCredentials, ProviderSettings, type Credentials } from "./provider"
import { Scheduler } from "./scheduler"
import { SessionService } from "./session"
import { RemoteSessionService, type CoreRemoteHost } from "./remote-sessions"
import { SkillService, type SkillDirs } from "./skill"
import { SpaceService } from "./space"
import { Storage } from "./storage"

export interface CoreOptions {
  /** Directory for the database and caches. Use ":memory:" for an in-memory database (tests). */
  dataDir: string
  credentials: Credentials
  /** Separate main-only MCP connection store; required for persistent hosts using MCP. */
  mcpCredentials?: Credentials
  /** Probes Cortex Cloud / self-hosted backends (desktop: Cortex SDK). */
  remoteProbe?: RemoteProbe
  /** Main-only remote session owner; credentials never enter engine storage. */
  remoteAuth?: RemoteAuth
  remoteChat?: CoreRemoteHost
  fetch?: typeof fetch
  catalogUrl?: string
  /** Catalog cache directory; defaults to `<dataDir>/cache`. No cache when dataDir is ":memory:" unless given. */
  cacheDir?: string
  skills?: SkillDirs
  plugins?: PluginDirs
  maxSteps?: number
}

export type Core = ReturnType<typeof createCore>

/** Wire every engine service around one storage and one bus. No network or timers start until `start()`. */
export function createCore(opts: CoreOptions) {
  const memory = opts.dataDir === ":memory:"
  if (!memory) mkdirSync(opts.dataDir, { recursive: true })
  const storage = new Storage(memory ? ":memory:" : join(opts.dataDir, "cortex.db"))
  const bus = new Bus(storage)
  const catalog = new Catalog({ cacheDir: opts.cacheDir ?? (memory ? undefined : join(opts.dataDir, "cache")), url: opts.catalogUrl, fetch: opts.fetch })
  const providers = new ProviderSettings(storage, opts.credentials)
  const permissions = new PermissionService(bus, storage)
  const skills = new SkillService(opts.skills ?? {}, storage)
  const plugins = new PluginRegistry(opts.plugins ?? {}, storage)
  const mcp = new McpService(bus, storage, opts.mcpCredentials ?? (memory ? memoryCredentials() : undefined))
  const bots = new BotService(storage)
  const permissionRules = {
    get: (): Rule[] => storage.getDoc<Rule[]>("settings", "permission") ?? [],
    set: (rules: unknown): Rule[] => {
      const r = z.array(PermissionRule).parse(rules)
      storage.putDoc("settings", "permission", r)
      return r
    },
  }
  const sessions = new SessionService({
    storage,
    bus,
    catalog,
    providers,
    permissions,
    skills,
    plugins,
    mcp,
    fetch: opts.fetch,
    botContext: (id) => bots.context(id),
    rules: permissionRules.get,
    maxSteps: opts.maxSteps,
  })
  const scheduler = new Scheduler(storage, bus, sessions)
  bots.scheduler = scheduler
  const space = new SpaceService(storage)
  const connection = new ConnectionService(storage, opts.fetch, opts.remoteProbe, opts.remoteAuth)
  const remoteSessions = new RemoteSessionService(bus, connection, opts.remoteChat)
  bus.subscribe((e, source) => { if (source === "local") void plugins.trigger("event", e).catch(() => undefined) })

  return {
    storage,
    bus,
    catalog,
    providers,
    permissions,
    permissionRules,
    agents: () => AGENTS,
    skills,
    plugins,
    mcp,
    sessions,
    remoteSessions,
    bots,
    scheduler,
    space,
    connection,
    /** Load plugins, connect enabled MCP servers, start the scheduler tick. Catalog loads lazily. */
    async start(o: { schedulerIntervalMs?: number; computerUse?: string } = {}) {
      // Register the computer-use preset once when the host found Cua Driver; the user enables it in Plugins.
      if (o.computerUse && !mcp.get(COMPUTER_USE_SERVER)) await mcp.add(computerUsePreset(o.computerUse))
      await plugins.scan()
      await mcp.connectAll()
      scheduler.start(o.schedulerIntervalMs)
    },
    async close() {
      remoteSessions.close()
      opts.remoteAuth?.clear()
      scheduler.stop()
      for (const s of storage.sessions()) await sessions.abort(s.id)
      await mcp.close()
      storage.close()
    },
  }
}

export * from "./agent"
export * from "./bot"
export * from "./bus"
export * from "./catalog"
export * from "./computer-use"
export * from "./connection"
export * from "./cron"
export * from "./error"
export * from "./llm"
export * from "./mcp"
export * from "./permission"
export * from "./plugin"
export * from "./provider"
export * from "./scheduler"
export * from "./session"
export * from "./remote-sessions"
export * from "./skill"
export * from "./space"
export * from "./storage"
export * from "./tool"
