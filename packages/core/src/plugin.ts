import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { Event, Plugin } from "@cortex/schema"
import type { ToolDef } from "./tool"
import type { Storage } from "./storage"

export interface ChatParams {
  sessionID: string
  agent: string
  model: { providerID: string; modelID: string }
  temperature?: number
  maxOutputTokens?: number
  providerOptions: Record<string, Record<string, unknown>>
}

export interface Hooks {
  tools?: ToolDef[]
  "chat.params"?: (params: ChatParams) => void | Promise<void>
  "tool.execute.before"?: (input: { tool: string; sessionID: string; callID: string; args: unknown }) => void | Promise<void>
  "tool.execute.after"?: (input: { tool: string; sessionID: string; callID: string; args: unknown; result: { output: string; title?: string } }) => void | Promise<void>
  event?: (e: Event) => void | Promise<void>
}

/** A plugin module default-exports (or exports `plugin`) a Hooks object or a factory returning one. */
export type PluginModule = Hooks | ((ctx: { directory: string }) => Hooks | Promise<Hooks>)

export interface PluginDirs {
  installed?: string
  personal?: string
  public?: string
}

interface Loaded {
  info: Omit<Plugin, "enabled">
  hooks: Hooks
}

/**
 * Plugin registry. Each plugin is a directory with `package.json` ({name, description, main})
 * whose entry module exports hooks. Plugins run in-process with full host privileges.
 */
export class PluginRegistry {
  private loaded = new Map<string, Loaded>()
  constructor(
    private dirs: PluginDirs,
    private storage: Storage,
  ) {}

  /** Register in-memory hooks (builtins, tests). */
  register(id: string, hooks: Hooks, meta: { name?: string; description?: string; source?: Plugin["source"] } = {}) {
    this.loaded.set(id, { info: describe(id, hooks, meta.name ?? id, meta.description ?? "", meta.source ?? "installed"), hooks })
  }

  async scan(): Promise<void> {
    const sources: [Plugin["source"], string | undefined][] = [
      ["installed", this.dirs.installed],
      ["public", this.dirs.public],
      ["personal", this.dirs.personal],
    ]
    for (const [source, dir] of sources) {
      if (!dir) continue
      for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) if (e.isDirectory()) await this.loadDir(join(dir, e.name), source)
    }
  }

  async loadDir(dir: string, source: Plugin["source"] = "installed"): Promise<Plugin> {
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8").catch(() => "{}")) as { name?: string; description?: string; main?: string }
    const id = pkg.name ?? dir.split(/[\\/]/).pop()!
    try {
      const mod = (await import(pathToFileURL(join(dir, pkg.main ?? "index.js")).href)) as { default?: PluginModule; plugin?: PluginModule }
      const exp = mod.default ?? mod.plugin
      if (!exp) throw new Error("no export")
      const hooks = typeof exp === "function" ? await exp({ directory: dir }) : exp
      this.loaded.set(id, { info: describe(id, hooks, pkg.name ?? id, pkg.description ?? "", source), hooks })
    } catch {
      this.loaded.set(id, {
        info: { ...describe(id, {}, pkg.name ?? id, pkg.description ?? "", source), error: { code: "plugin_load_failed", message: `Plugin ${id} failed to load` } },
        hooks: {},
      })
    }
    return this.get(id)!
  }

  private enabled(id: string) {
    return this.storage.getDoc<{ enabled: boolean }>("plugin-state", id)?.enabled ?? true
  }
  get(id: string): Plugin | undefined {
    const l = this.loaded.get(id)
    return l && { ...l.info, enabled: this.enabled(id) }
  }
  list(): Plugin[] {
    return [...this.loaded.keys()].map((id) => this.get(id)!)
  }
  setEnabled(id: string, enabled: boolean): Plugin | undefined {
    if (!this.loaded.has(id)) return undefined
    this.storage.putDoc("plugin-state", id, { enabled })
    return this.get(id)
  }

  active(): Hooks[] {
    return [...this.loaded.entries()].filter(([id, l]) => !l.info.error && this.enabled(id)).map(([, l]) => l.hooks)
  }
  tools(): ToolDef[] {
    return this.active().flatMap((h) => h.tools ?? [])
  }
  async trigger<K extends "chat.params" | "tool.execute.before" | "tool.execute.after" | "event">(name: K, input: Parameters<NonNullable<Hooks[K]>>[0]) {
    for (const h of this.active()) {
      const fn = h[name] as ((i: typeof input) => unknown) | undefined
      if (fn) await fn(input)
    }
  }
}

function describe(id: string, hooks: Hooks, name: string, description: string, source: Plugin["source"]): Omit<Plugin, "enabled"> {
  return {
    id,
    name,
    description,
    source,
    hooks: (Object.keys(hooks) as (keyof Hooks)[]).filter((k) => k !== "tools" && hooks[k]),
    tools: (hooks.tools ?? []).map((t) => t.name),
  }
}
