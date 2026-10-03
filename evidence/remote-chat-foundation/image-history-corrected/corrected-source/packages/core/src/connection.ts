import { ConnectionMode, ConnectionUrl, RemoteAuthInput, RemoteAuthState, type ConnectionProbe } from "@cortex/schema"
import { CortexError } from "./error"
import type { Storage } from "./storage"

const DEFAULT: ConnectionMode = { mode: "local", signedIn: false }
export const CLOUD_URL = "https://api.cortex.foundation"

/** Host-provided probe (desktop main uses the Cortex SDK). Returns reachable/unreachable/incompatible and remote model ids. */
export type RemoteProbe = (url: string) => Promise<{ status: "reachable" | "unreachable" | "incompatible"; authRequired?: boolean; models?: { id: string; name: string }[] }>

/** Main-only session owner; only sanitized status crosses the engine boundary. */
export type RemoteAuth = {
  state(origin: string): RemoteAuthState
  authenticate(origin: string, input: RemoteAuthInput): Promise<RemoteAuthState>
  clear(): void
}

const origin = (c: ConnectionMode): string | undefined => {
  const url = c.mode === "cloud" ? CLOUD_URL : c.mode === "selfhost" ? c.url : undefined
  return url && ConnectionUrl.safeParse(url).success ? new URL(url).origin : undefined
}

export class ConnectionService {
  constructor(
    private storage: Storage,
    private fetchImpl: typeof fetch = fetch,
    private remote?: RemoteProbe,
    private remoteAuth?: RemoteAuth,
  ) {}

  private selection(): ConnectionMode {
    return this.storage.getDoc<ConnectionMode>("connection", "mode") ?? DEFAULT
  }
  get(): ConnectionMode {
    return { ...this.selection(), signedIn: this.auth().signedIn }
  }
  remoteOrigin(): string {
    const url = origin(this.selection())
    if (!url) throw new CortexError("invalid_request", "Select a remote connection first")
    return url
  }
  set(input: unknown): ConnectionMode {
    // Persist selection only; renderer-supplied metadata cannot establish a session.
    const c = { ...ConnectionMode.parse(input), signedIn: false }
    if (c.mode === "selfhost" && !c.url) throw new CortexError("invalid_request", "Self-hosted mode needs a URL")
    if (c.url) c.url = new URL(c.url).origin
    const previous = this.selection()
    this.storage.putDoc("connection", "mode", c)
    if (previous.mode !== c.mode || origin(previous) !== origin(c)) this.remoteAuth?.clear()
    return this.get()
  }

  auth(): RemoteAuthState {
    const url = origin(this.selection())
    return url && this.remoteAuth ? RemoteAuthState.parse(this.remoteAuth.state(url)) : { status: "signed_out", signedIn: false }
  }
  async authenticate(input: unknown): Promise<RemoteAuthState> {
    const body = RemoteAuthInput.parse(input)
    const url = origin(this.selection())
    if (!url) throw new CortexError("invalid_request", "Select a remote connection before signing in")
    if (!this.remoteAuth) throw new CortexError("provider_unsupported", "Remote sign-in is unavailable")
    return RemoteAuthState.parse(await this.remoteAuth.authenticate(url, body))
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
