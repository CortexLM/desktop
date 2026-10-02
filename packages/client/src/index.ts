// Browser-safe typed client. Works with any fetch implementation (window.fetch, IPC-backed, app.fetch).
import {
  Event,
  type Agent,
  type ApiError,
  type Bot,
  type BotCreateInput,
  type BotUpdateInput,
  type ConnectionMode,
  type ConnectionProbe,
  type ErrorCode,
  type McpConfig,
  type McpServer,
  type MemoryEntry,
  type MessageWithParts,
  type ModelInfo,
  type Permission,
  type PermissionReply,
  type PermissionRule,
  type Plugin,
  type PromptInput,
  type ProviderConfig,
  type ProviderSummary,
  type ProviderUpdateInput,
  type ScheduledTask,
  type Session,
  type SessionCreateInput,
  type SessionUpdateInput,
  type Skill,
  type SpaceCreateInput,
  type SpaceItem,
  type SpaceUpdateInput,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "@cortex/schema"

export class CortexApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "CortexApiError"
  }
}

export interface ClientOptions {
  fetch?: (input: Request) => Promise<Response> | Response
  /** e.g. "http://127.0.0.1:4096" or "cortex://engine"; routes are appended (`/api/...`). */
  baseUrl: string
}

type Ok = { ok: true }
const enc = encodeURIComponent

/** Parse an SSE byte stream into events. Comments and malformed frames are ignored. */
export async function* parseSSE(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<Event> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  const onAbort = () => void reader.cancel().catch(() => undefined)
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true }).replace(/\r\n?/g, "\n")
      let i: number
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i)
        buf = buf.slice(i + 2)
        const data = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^ /, ""))
          .join("\n")
        if (!data) continue
        try {
          const parsed = Event.safeParse(JSON.parse(data))
          if (parsed.success) yield parsed.data
        } catch {
          // skip malformed frame
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort)
    reader.releaseLock()
  }
}

export function createClient(opts: ClientOptions) {
  const doFetch = opts.fetch ?? ((r: Request) => fetch(r))
  const base = opts.baseUrl.replace(/(?<!\/)\/+$/, "")

  async function call<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const qs = query ? Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join("&") : ""
    const req = new Request(`${base}${path}${qs ? `?${qs}` : ""}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const res = await doFetch(req)
    const json = (await res.json().catch(() => undefined)) as unknown
    if (!res.ok) {
      const err = (json as ApiError | undefined)?.error
      throw new CortexApiError(err?.code ?? "internal", err?.message ?? `Request failed with status ${res.status}`, res.status)
    }
    return json as T
  }
  const get = <T>(p: string, q?: Record<string, string | number | undefined>) => call<T>("GET", p, undefined, q)
  const post = <T>(p: string, b?: unknown) => call<T>("POST", p, b ?? (undefined as unknown))
  const put = <T>(p: string, b: unknown) => call<T>("PUT", p, b)
  const patch = <T>(p: string, b: unknown) => call<T>("PATCH", p, b)
  const del = <T = Ok>(p: string) => call<T>("DELETE", p)

  return {
    health: () => get<{ ok: true; version: string }>("/api/health"),

    /** Subscribe to the live bus. Returns an unsubscribe function. Reconnect is the caller's choice. */
    subscribe(onEvent: (e: Event) => void, o: { onError?: (err: unknown) => void } = {}): () => void {
      const ctrl = new AbortController()
      void (async () => {
        try {
          const res = await doFetch(new Request(`${base}/api/events`, { headers: { accept: "text/event-stream" }, signal: ctrl.signal }))
          if (!res.ok || !res.body) throw new CortexApiError("internal", `Event stream failed with status ${res.status}`, res.status)
          for await (const e of parseSSE(res.body, ctrl.signal)) onEvent(e)
        } catch (err) {
          if (!ctrl.signal.aborted) o.onError?.(err)
        }
      })()
      return () => ctrl.abort()
    },

    sessions: {
      list: (q: { kind?: Session["kind"]; botID?: string; parentID?: string } = {}) => get<Session[]>("/api/sessions", q),
      create: (b: SessionCreateInput) => post<Session>("/api/sessions", b),
      get: (id: string) => get<Session>(`/api/sessions/${enc(id)}`),
      update: (id: string, b: SessionUpdateInput) => patch<Session>(`/api/sessions/${enc(id)}`, b),
      delete: (id: string) => del(`/api/sessions/${enc(id)}`),
      messages: (id: string) => get<MessageWithParts[]>(`/api/sessions/${enc(id)}/messages`),
      prompt: (id: string, b: PromptInput) => post<{ messageID: string }>(`/api/sessions/${enc(id)}/prompt`, b),
      abort: (id: string) => post<Ok>(`/api/sessions/${enc(id)}/abort`),
    },
    permissions: {
      list: () => get<Permission[]>("/api/permissions"),
      reply: (id: string, reply: PermissionReply) => post<Ok>(`/api/permissions/${enc(id)}/reply`, { reply }),
      rules: () => get<PermissionRule[]>("/api/permissions/rules"),
      setRules: (rules: PermissionRule[]) => put<PermissionRule[]>("/api/permissions/rules", { rules }),
    },
    catalog: {
      providers: () => get<ProviderSummary[]>("/api/catalog/providers"),
      models: (providerID: string) => get<ModelInfo[]>(`/api/catalog/providers/${enc(providerID)}/models`),
      search: (q: string, limit?: number) => get<ModelInfo[]>("/api/catalog/search", { q, limit }),
      refresh: () => post<{ source: string }>("/api/catalog/refresh"),
    },
    providers: {
      list: () => get<ProviderConfig[]>("/api/providers"),
      get: (id: string) => get<ProviderConfig>(`/api/providers/${enc(id)}`),
      update: (id: string, b: ProviderUpdateInput) => patch<ProviderConfig>(`/api/providers/${enc(id)}`, b),
      /** Write-only: the key is never returned. */
      setKey: (id: string, key: string) => put<ProviderConfig>(`/api/providers/${enc(id)}/key`, { key }),
      removeKey: (id: string) => del<ProviderConfig>(`/api/providers/${enc(id)}/key`),
    },
    agents: { list: () => get<Agent[]>("/api/agents") },
    skills: {
      list: (directory?: string) => get<Skill[]>("/api/skills", { directory }),
      setEnabled: (name: string, enabled: boolean) => patch<Ok>(`/api/skills/${enc(name)}`, { enabled }),
    },
    plugins: {
      list: () => get<Plugin[]>("/api/plugins"),
      setEnabled: (id: string, enabled: boolean) => patch<Plugin>(`/api/plugins/${enc(id)}`, { enabled }),
      rescan: () => post<Plugin[]>("/api/plugins/rescan"),
    },
    mcp: {
      list: () => get<McpServer[]>("/api/mcp"),
      add: (cfg: McpConfig) => post<McpServer>("/api/mcp", cfg),
      setEnabled: (name: string, enabled: boolean) => patch<McpServer>(`/api/mcp/${enc(name)}`, { enabled }),
      remove: (name: string) => del(`/api/mcp/${enc(name)}`),
      connect: (name: string) => post<McpServer>(`/api/mcp/${enc(name)}/connect`),
      disconnect: (name: string) => post<McpServer>(`/api/mcp/${enc(name)}/disconnect`),
    },
    bots: {
      list: () => get<Bot[]>("/api/bots"),
      create: (b: BotCreateInput) => post<Bot>("/api/bots", b),
      get: (id: string) => get<Bot>(`/api/bots/${enc(id)}`),
      update: (id: string, b: BotUpdateInput) => patch<Bot>(`/api/bots/${enc(id)}`, b),
      delete: (id: string) => del(`/api/bots/${enc(id)}`),
      sessions: (id: string) => get<Session[]>(`/api/bots/${enc(id)}/sessions`),
      createSession: (id: string, b: { title?: string; directory?: string } = {}) => post<Session>(`/api/bots/${enc(id)}/sessions`, b),
      memory: {
        list: (id: string) => get<MemoryEntry[]>(`/api/bots/${enc(id)}/memory`),
        add: (id: string, content: string) => post<MemoryEntry>(`/api/bots/${enc(id)}/memory`, { content }),
        delete: (id: string, memoryID: string) => del(`/api/bots/${enc(id)}/memory/${enc(memoryID)}`),
      },
    },
    tasks: {
      list: (q: { botID?: string } = {}) => get<ScheduledTask[]>("/api/tasks", q),
      create: (b: TaskCreateInput) => post<ScheduledTask>("/api/tasks", b),
      get: (id: string) => get<ScheduledTask>(`/api/tasks/${enc(id)}`),
      update: (id: string, b: TaskUpdateInput) => patch<ScheduledTask>(`/api/tasks/${enc(id)}`, b),
      delete: (id: string) => del(`/api/tasks/${enc(id)}`),
      run: (id: string) => post<{ accepted: true }>(`/api/tasks/${enc(id)}/run`),
    },
    space: {
      list: (kind?: SpaceItem["kind"]) => get<SpaceItem[]>("/api/space", { kind }),
      recents: (limit?: number) => get<SpaceItem[]>("/api/space/recents", { limit }),
      create: (b: SpaceCreateInput) => post<SpaceItem>("/api/space", b),
      get: (id: string) => get<SpaceItem>(`/api/space/${enc(id)}`),
      update: (id: string, b: SpaceUpdateInput) => patch<SpaceItem>(`/api/space/${enc(id)}`, b),
      delete: (id: string) => del(`/api/space/${enc(id)}`),
    },
    connection: {
      get: () => get<ConnectionMode>("/api/connection"),
      set: (c: ConnectionMode) => put<ConnectionMode>("/api/connection", c),
      probe: () => get<ConnectionProbe>("/api/connection/probe"),
    },
  }
}

export type CortexClient = ReturnType<typeof createClient>
