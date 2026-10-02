import { ConnectionMode, ConnectionUrl, type ConnectionProbe } from "@cortex/schema"
import { CortexError } from "./error"
import type { Storage } from "./storage"

const DEFAULT: ConnectionMode = { mode: "local", signedIn: false }
export const CLOUD_URL = "https://api.cortex.foundation"

/** Host-provided probe (desktop main uses the Cortex SDK). Returns reachable/unreachable/incompatible and remote model ids. */
export type RemoteProbe = (url: string) => Promise<{ status: "reachable" | "unreachable" | "incompatible"; authRequired?: boolean; models?: { id: string; name: string }[] }>

export class ConnectionService {
  constructor(
    private storage: Storage,
    private fetchImpl: typeof fetch = fetch,
    private remote?: RemoteProbe,
  ) {}

  get(): ConnectionMode {
    return { ...(this.storage.getDoc<ConnectionMode>("connection", "mode") ?? DEFAULT), signedIn: false }
  }
  set(input: unknown): ConnectionMode {
    // Authentication is not wired; renderer-supplied metadata cannot establish a session.
    const c = { ...ConnectionMode.parse(input), signedIn: false }
    if (c.mode === "selfhost" && !c.url) throw new CortexError("invalid_request", "Self-hosted mode needs a URL")
    this.storage.putDoc("connection", "mode", c)
    return c
  }

  /** Cloud and self-host: the host probe when provided, else `GET {url}/readyz` must answer 2xx. */
  async probe(): Promise<ConnectionProbe> {
    const c = this.get()
    if (c.mode === "local") return { status: "not_applicable" }
    const url = c.mode === "cloud" ? CLOUD_URL : c.url
    if (!url) return { status: "not_applicable" }
    if (!ConnectionUrl.safeParse(url).success) return { status: "incompatible" }
    if (this.remote) {
      const r = await this.remote(url)
      return { status: r.status, ...(r.authRequired !== undefined ? { authRequired: r.authRequired } : {}), ...(r.models ? { models: r.models } : {}) }
    }
    try {
      const res = await this.fetchImpl(`${url.replace(/\/+$/, "")}/readyz`, { signal: AbortSignal.timeout(5_000), redirect: "error" })
      if (!res.ok) return { status: "incompatible", httpStatus: res.status }
      return { status: "reachable", httpStatus: res.status }
    } catch {
      return { status: "unreachable" }
    }
  }
}
