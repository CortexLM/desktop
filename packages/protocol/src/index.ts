// HTTP contract: route table, request validation and the public error shape.
// Business behaviour is injected by the server through `Handlers`; this package never imports core.
import { Hono, type Context } from "hono"
import { z } from "zod"
import {
  BotCreateInput,
  BotUpdateInput,
  ConnectionMode,
  ErrorCode,
  McpConfig,
  PermissionReply,
  PermissionRule,
  ProjectCreateInput,
  ProjectID,
  ProjectUpdateInput,
  PromptInput,
  ProviderUpdateInput,
  RemoteAuthInput,
  RuntimeSettingsUpdateInput,
  SessionCreateInput,
  SessionKind,
  SessionUpdateInput,
  SpaceCreateInput,
  SpaceItem,
  SpaceUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
  type ApiError,
} from "@cortex/schema"

type Method = "get" | "post" | "put" | "patch" | "delete"
export interface RouteDef {
  method: Method
  path: string
  body?: z.ZodType
  query?: z.ZodType
  /** Success status, default 200. */
  status?: number
}

const r = <M extends Method, P extends string, B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(
  method: M,
  path: P,
  opts: { body?: B; query?: Q; status?: number } = {},
) => ({ method, path, ...opts }) as { method: M; path: P; body: B; query: Q; status?: number }

const Enabled = z.object({ enabled: z.boolean() })

export const routes = {
  health: r("get", "/api/health"),
  events: r("get", "/api/events"),

  "settings.get": r("get", "/api/settings"),
  "settings.update": r("put", "/api/settings", { body: RuntimeSettingsUpdateInput }),

  "project.list": r("get", "/api/projects"),
  "project.create": r("post", "/api/projects", { body: ProjectCreateInput, status: 201 }),
  "project.get": r("get", "/api/projects/:id"),
  "project.update": r("patch", "/api/projects/:id", { body: ProjectUpdateInput }),
  "project.delete": r("delete", "/api/projects/:id"),

  "session.list": r("get", "/api/sessions", { query: z.object({ kind: SessionKind.optional(), botID: z.string().optional(), parentID: z.string().optional(), projectID: ProjectID.optional() }) }),
  "session.create": r("post", "/api/sessions", { body: SessionCreateInput, status: 201 }),
  "session.get": r("get", "/api/sessions/:id"),
  "session.update": r("patch", "/api/sessions/:id", { body: SessionUpdateInput }),
  "session.delete": r("delete", "/api/sessions/:id"),
  "session.messages": r("get", "/api/sessions/:id/messages"),
  "session.prompt": r("post", "/api/sessions/:id/prompt", { body: PromptInput, status: 202 }),
  "session.abort": r("post", "/api/sessions/:id/abort"),

  "permission.list": r("get", "/api/permissions"),
  "permission.rules.get": r("get", "/api/permissions/rules"),
  "permission.rules.set": r("put", "/api/permissions/rules", { body: z.object({ rules: z.array(PermissionRule) }) }),
  "permission.reply": r("post", "/api/permissions/:id/reply", { body: z.object({ reply: PermissionReply }) }),

  "catalog.providers": r("get", "/api/catalog/providers"),
  "catalog.models": r("get", "/api/catalog/providers/:id/models"),
  "catalog.search": r("get", "/api/catalog/search", { query: z.object({ q: z.string().default(""), limit: z.coerce.number().int().min(1).max(500).optional() }) }),
  "catalog.refresh": r("post", "/api/catalog/refresh"),

  "provider.list": r("get", "/api/providers"),
  "provider.get": r("get", "/api/providers/:id"),
  "provider.update": r("patch", "/api/providers/:id", { body: ProviderUpdateInput }),
  "provider.setKey": r("put", "/api/providers/:id/key", { body: z.object({ key: z.string().min(1).max(4096) }) }),
  "provider.removeKey": r("delete", "/api/providers/:id/key"),

  "agent.list": r("get", "/api/agents"),

  "skill.list": r("get", "/api/skills", { query: z.object({ directory: z.string().optional() }) }),
  "skill.update": r("patch", "/api/skills/:name", { body: Enabled }),

  "plugin.list": r("get", "/api/plugins"),
  "plugin.update": r("patch", "/api/plugins/:id", { body: Enabled }),
  "plugin.rescan": r("post", "/api/plugins/rescan"),

  "mcp.list": r("get", "/api/mcp"),
  "mcp.add": r("post", "/api/mcp", { body: McpConfig, status: 201 }),
  "mcp.update": r("patch", "/api/mcp/:name", { body: Enabled }),
  "mcp.remove": r("delete", "/api/mcp/:name"),
  "mcp.connect": r("post", "/api/mcp/:name/connect"),
  "mcp.disconnect": r("post", "/api/mcp/:name/disconnect"),

  "bot.list": r("get", "/api/bots"),
  "bot.create": r("post", "/api/bots", { body: BotCreateInput, status: 201 }),
  "bot.get": r("get", "/api/bots/:id"),
  "bot.update": r("patch", "/api/bots/:id", { body: BotUpdateInput }),
  "bot.delete": r("delete", "/api/bots/:id"),
  "bot.sessions": r("get", "/api/bots/:id/sessions"),
  "bot.session.create": r("post", "/api/bots/:id/sessions", { body: z.object({ title: z.string().optional(), directory: z.string().optional() }), status: 201 }),
  "bot.memory.list": r("get", "/api/bots/:id/memory"),
  "bot.memory.add": r("post", "/api/bots/:id/memory", { body: z.object({ content: z.string().min(1).max(10_000) }), status: 201 }),
  "bot.memory.delete": r("delete", "/api/bots/:id/memory/:memoryID"),

  "task.list": r("get", "/api/tasks", { query: z.object({ botID: z.string().optional() }) }),
  "task.create": r("post", "/api/tasks", { body: TaskCreateInput, status: 201 }),
  "task.get": r("get", "/api/tasks/:id"),
  "task.update": r("patch", "/api/tasks/:id", { body: TaskUpdateInput }),
  "task.delete": r("delete", "/api/tasks/:id"),
  "task.run": r("post", "/api/tasks/:id/run", { status: 202 }),

  "space.list": r("get", "/api/space", { query: z.object({ kind: SpaceItem.shape.kind.optional() }) }),
  "space.recents": r("get", "/api/space/recents", { query: z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }) }),
  "space.create": r("post", "/api/space", { body: SpaceCreateInput, status: 201 }),
  "space.get": r("get", "/api/space/:id"),
  "space.update": r("patch", "/api/space/:id", { body: SpaceUpdateInput }),
  "space.delete": r("delete", "/api/space/:id"),

  "connection.get": r("get", "/api/connection"),
  "connection.set": r("put", "/api/connection", { body: ConnectionMode }),
  "connection.probe": r("get", "/api/connection/probe"),
  "connection.auth.get": r("get", "/api/connection/auth"),
  "connection.auth.submit": r("post", "/api/connection/auth", { body: RemoteAuthInput }),
} as const

export type Routes = typeof routes
export type RouteName = keyof Routes
type Infer<T> = T extends z.ZodType ? z.output<T> : undefined
export interface HandlerInput<R extends RouteName> {
  params: Record<string, string>
  body: Infer<Routes[R]["body"]>
  query: Infer<Routes[R]["query"]>
  request: Request
  signal: AbortSignal
}
/** Return JSON-serialisable data, `undefined` (→ `{ok:true}`), or a raw Response (SSE). */
export type Handlers = { [R in RouteName]: (input: HandlerInput<R>) => unknown | Promise<unknown> }

export const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  not_found: 404,
  conflict: 409,
  session_busy: 409,
  model_not_found: 404,
  model_no_image_input: 422,
  model_no_pdf_input: 422,
  context_window_exceeded: 422,
  provider_unsupported: 422,
  provider_disabled: 422,
  provider_key_missing: 422,
  provider_auth_failed: 502,
  provider_rate_limited: 429,
  provider_error: 502,
  catalog_unavailable: 503,
  permission_rejected: 403,
  permission_denied: 403,
  aborted: 409,
  tool_failed: 500,
  mcp_connect_failed: 502,
  plugin_load_failed: 500,
  internal: 500,
}

export const errorBody = (code: ErrorCode, message: string): ApiError => ({ error: { code, message } })

/** Map any thrown value to the public shape. Unknown errors never leak their message. */
export function toApiError(err: unknown): { status: number; body: ApiError } {
  if (err instanceof z.ZodError) {
    const issue = err.issues[0]
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : ""
    return { status: 400, body: errorBody("invalid_request", `Invalid request${where}`) }
  }
  const e = err as { code?: unknown; message?: unknown } | undefined
  const parsed = ErrorCode.safeParse(e?.code)
  if (parsed.success) return { status: STATUS[parsed.data], body: errorBody(parsed.data, typeof e?.message === "string" ? e.message : parsed.data) }
  return { status: 500, body: errorBody("internal", "Internal error") }
}

/** Build the Hono app from the route table and injected handlers. */
export function createApi(handlers: Handlers): Hono {
  const app = new Hono()
  app.onError((err, c) => {
    const { status, body } = toApiError(err)
    return c.json(body, status as 400)
  })
  app.notFound((c) => c.json(errorBody("not_found", "Route not found"), 404))
  for (const [name, def] of Object.entries(routes) as [RouteName, RouteDef][]) {
    app.on(def.method.toUpperCase(), def.path, async (c: Context) => {
      let body: unknown
      if (def.body) {
        const raw = await c.req.json().catch(() => {
          throw Object.assign(new Error("Request body must be JSON"), { code: "invalid_request" })
        })
        body = def.body.parse(raw)
      }
      const query = def.query ? def.query.parse(c.req.query()) : undefined
      const out = await (handlers[name] as (i: HandlerInput<RouteName>) => unknown)({
        params: c.req.param() as Record<string, string>,
        body: body as never,
        query: query as never,
        request: c.req.raw,
        signal: c.req.raw.signal,
      })
      if (out instanceof Response) return out
      return c.json((out ?? { ok: true }) as object, (def.status ?? 200) as 200)
    })
  }
  return app
}

/** Encode one event for an SSE stream. */
export const sseFrame = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`
