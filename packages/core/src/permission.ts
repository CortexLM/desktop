import { newId, type Permission, type PermissionReply, type PermissionRule } from "@cortex/schema"
import type { Bus } from "./bus"
import { CortexError } from "./error"
import type { Storage } from "./storage"

/** `*` matches any run of characters, `?` one character. Whole-string match. */
export function wildcard(pattern: string, value: string): boolean {
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[\\s\\S]*").replace(/\?/g, ".")
  return new RegExp(`^${re}$`).test(value)
}

/** Last matching rule wins; no match means ask. */
export function evaluate(rules: PermissionRule[], tool: string, pattern: string): PermissionRule["action"] {
  let action: PermissionRule["action"] = "ask"
  for (const r of rules) if (wildcard(r.tool, tool) && wildcard(r.pattern, pattern)) action = r.action
  return action
}

export const DEFAULT_RULES: PermissionRule[] = [
  { tool: "*", pattern: "*", action: "allow" },
  { tool: "bash", pattern: "*", action: "ask" },
  { tool: "write", pattern: "*", action: "ask" },
  { tool: "edit", pattern: "*", action: "ask" },
  { tool: "external_directory", pattern: "*", action: "ask" },
]

interface Pending {
  info: Permission
  project: string
  resolve: () => void
  reject: (e: Error) => void
}

export interface AskInput {
  sessionID: string
  callID?: string
  tool: string
  pattern: string
  input: unknown
  /** Ordered rules: defaults, then agent/bot rules. Config deny beats saved approvals. */
  rules: PermissionRule[]
  /** Scope of "always" approvals (project directory, or "global"). */
  project: string
  signal?: AbortSignal
}

export class PermissionService {
  private pending = new Map<string, Pending>()
  constructor(
    private bus: Bus,
    private storage: Storage,
  ) {}

  private saved(project: string): PermissionRule[] {
    return this.storage.listDocs<PermissionRule>("approval", project)
  }

  async ask(i: AskInput): Promise<void> {
    const configured = evaluate(i.rules, i.tool, i.pattern)
    if (configured === "deny") throw new CortexError("permission_denied", `Tool ${i.tool} is denied for ${i.pattern}`)
    if (configured === "allow") return
    if (evaluate(this.saved(i.project), i.tool, i.pattern) === "allow") return
    const info: Permission = {
      id: newId("permission"),
      sessionID: i.sessionID,
      callID: i.callID,
      tool: i.tool,
      pattern: i.pattern,
      input: preview(i.input),
      time: Date.now(),
    }
    return new Promise<void>((resolve, reject) => {
      this.pending.set(info.id, { info, project: i.project, resolve, reject })
      i.signal?.addEventListener("abort", () => this.settle(info.id, new CortexError("aborted", "Request aborted")), { once: true })
      this.bus.publish("permission.asked", { permission: info })
    })
  }

  private settle(id: string, err?: Error) {
    const p = this.pending.get(id)
    if (!p) return
    this.pending.delete(id)
    err ? p.reject(err) : p.resolve()
  }

  list(): Permission[] {
    return [...this.pending.values()].map((p) => p.info)
  }

  reply(id: string, reply: PermissionReply): void {
    const p = this.pending.get(id)
    if (!p) throw new CortexError("not_found", `No pending permission ${id}`)
    const { sessionID, tool, pattern } = p.info
    if (reply === "reject") {
      this.settle(id, new CortexError("permission_rejected", `User rejected ${tool}`))
      // a rejection also cancels the other pending asks of the same session
      for (const other of this.list()) if (other.sessionID === sessionID) this.settle(other.id, new CortexError("permission_rejected", `User rejected ${other.tool}`))
    } else {
      if (reply === "always") {
        this.storage.putDoc("approval", `${p.project}\u0000${tool}\u0000${pattern}`, { tool, pattern, action: "allow" }, p.project)
        for (const other of [...this.pending.values()])
          if (other.project === p.project && other.info.id !== id && other.info.tool === tool && wildcard(pattern, other.info.pattern)) this.settle(other.info.id)
      }
      this.settle(id)
    }
    this.bus.publish("permission.replied", { sessionID, permissionID: id, reply })
  }
}

function preview(input: unknown): string {
  const s = typeof input === "string" ? input : JSON.stringify(input) ?? ""
  return s.length > 500 ? s.slice(0, 500) + "…" : s
}
