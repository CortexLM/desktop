import { ConnectionMode, type ConnectionProbe } from "@cortex/schema"
import { CortexError } from "./error"
import type { Storage } from "./storage"

const DEFAULT: ConnectionMode = { mode: "local", signedIn: false }

export class ConnectionService {
  constructor(
    private storage: Storage,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  get(): ConnectionMode {
    return this.storage.getDoc<ConnectionMode>("connection", "mode") ?? DEFAULT
  }
  set(input: unknown): ConnectionMode {
    const c = ConnectionMode.parse(input)
    if (c.mode === "selfhost" && !c.url) throw new CortexError("invalid_request", "Self-hosted mode needs a URL")
    this.storage.putDoc("connection", "mode", c)
    return c
  }

  /** Self-host only: `GET {url}/v1/health` must answer 2xx JSON. */
  async probe(): Promise<ConnectionProbe> {
    const c = this.get()
    if (c.mode !== "selfhost" || !c.url) return { status: "not_applicable" }
    try {
      const res = await this.fetchImpl(`${c.url.replace(/\/+$/, "")}/v1/health`, { signal: AbortSignal.timeout(5_000) })
      if (!res.ok) return { status: "incompatible", httpStatus: res.status }
      const body = await res.json().catch(() => undefined)
      return body && typeof body === "object" ? { status: "reachable", httpStatus: res.status } : { status: "incompatible", httpStatus: res.status }
    } catch {
      return { status: "unreachable" }
    }
  }
}
