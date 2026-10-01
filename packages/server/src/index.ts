import { createServer as createHttpServer, type Server } from "node:http"
import type { Event } from "@cortex/schema"
import { CortexError, type Core } from "@cortex/core"
import { createApi, sseFrame, type Handlers } from "@cortex/protocol"
import type { Hono } from "hono"

const HEARTBEAT_MS = 15_000

function sse(core: Core, signal: AbortSignal): Response {
  const enc = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (s: string) => {
        try {
          ctrl.enqueue(enc.encode(s))
        } catch {
          cleanup()
        }
      }
      send(": connected\n\n")
      const off = core.bus.subscribe((e: Event) => send(sseFrame(e)))
      const beat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS)
      beat.unref?.()
      cleanup = () => {
        off()
        clearInterval(beat)
        try {
          ctrl.close()
        } catch {
          // already closed
        }
        cleanup = () => {}
      }
      signal.addEventListener("abort", () => cleanup(), { once: true })
    },
    cancel() {
      cleanup()
    },
  })
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } })
}

const must = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new CortexError("not_found", `Unknown ${what}`)
  return v
}

/** Hono app over the core facade. Desktop main calls `app.fetch(request)` from IPC; no socket needed. */
export function createServer(core: Core): Hono {
  const h: Handlers = {
    health: () => ({ ok: true, version: "0.2.0" }),
    events: ({ signal }) => sse(core, signal),

    "session.list": ({ query }) => core.sessions.list(query),
    "session.create": ({ body }) => core.sessions.create(body),
    "session.get": ({ params }) => core.sessions.get(params.id!),
    "session.update": ({ params, body }) => core.sessions.update(params.id!, body),
    "session.delete": async ({ params }) => void (await core.sessions.delete(params.id!)),
    "session.messages": ({ params }) => core.sessions.messages(params.id!),
    "session.prompt": async ({ params, body }) => {
      const { messageID } = await core.sessions.prompt(params.id!, body)
      return { messageID }
    },
    "session.abort": async ({ params }) => {
      core.sessions.get(params.id!)
      await core.sessions.abort(params.id!)
    },

    "permission.list": () => core.permissions.list(),
    "permission.rules.get": () => core.permissionRules.get(),
    "permission.rules.set": ({ body }) => core.permissionRules.set(body.rules),
    "permission.reply": ({ params, body }) => void core.permissions.reply(params.id!, body.reply),

    "catalog.providers": () => core.catalog.providers(),
    "catalog.models": ({ params }) => core.catalog.models(params.id!),
    "catalog.search": ({ query }) => core.catalog.search(query.q, query.limit),
    "catalog.refresh": async () => {
      await core.catalog.refresh()
      return { source: core.catalog.source }
    },

    "provider.list": () => core.providers.list(),
    "provider.get": ({ params }) => core.providers.get(params.id!),
    "provider.update": ({ params, body }) => core.providers.update(params.id!, body),
    "provider.setKey": ({ params, body }) => core.providers.setKey(params.id!, body.key),
    "provider.removeKey": ({ params }) => core.providers.removeKey(params.id!),

    "agent.list": () => core.agents(),

    "skill.list": ({ query }) => core.skills.list(query.directory),
    "skill.update": ({ params, body }) => void core.skills.setEnabled(params.name!, body.enabled),

    "plugin.list": () => core.plugins.list(),
    "plugin.update": ({ params, body }) => must(core.plugins.setEnabled(params.id!, body.enabled), "plugin"),
    "plugin.rescan": async () => {
      await core.plugins.scan()
      return core.plugins.list()
    },

    "mcp.list": () => core.mcp.list(),
    "mcp.add": ({ body }) => core.mcp.add(body),
    "mcp.update": ({ params, body }) => core.mcp.setEnabled(params.name!, body.enabled),
    "mcp.remove": async ({ params }) => {
      if (!(await core.mcp.remove(params.name!))) throw new CortexError("not_found", "Unknown MCP server")
    },
    "mcp.connect": ({ params }) => core.mcp.connect(params.name!),
    "mcp.disconnect": async ({ params }) => {
      must(core.mcp.get(params.name!), "MCP server")
      await core.mcp.disconnect(params.name!)
      return core.mcp.get(params.name!)
    },

    "bot.list": () => core.bots.list(),
    "bot.create": ({ body }) => core.bots.create(body),
    "bot.get": ({ params }) => core.bots.get(params.id!),
    "bot.update": ({ params, body }) => core.bots.update(params.id!, body),
    "bot.delete": ({ params }) => void core.bots.delete(params.id!),
    "bot.sessions": ({ params }) => (core.bots.get(params.id!), core.sessions.list({ kind: "bot", botID: params.id! })),
    "bot.session.create": ({ params, body }) => {
      const bot = core.bots.get(params.id!)
      return core.sessions.create({ title: body.title, directory: body.directory, model: bot.model, kind: "bot", botID: bot.id })
    },
    "bot.memory.list": ({ params }) => (core.bots.get(params.id!), core.bots.memory(params.id!)),
    "bot.memory.add": ({ params, body }) => core.bots.remember(params.id!, body.content),
    "bot.memory.delete": ({ params }) => void core.bots.forget(params.id!, params.memoryID!),

    "task.list": ({ query }) => core.scheduler.list(query),
    "task.create": ({ body }) => core.scheduler.create(body),
    "task.get": ({ params }) => core.scheduler.get(params.id!),
    "task.update": ({ params, body }) => core.scheduler.update(params.id!, body),
    "task.delete": ({ params }) => void core.scheduler.delete(params.id!),
    "task.run": ({ params }) => {
      core.scheduler.get(params.id!)
      void core.scheduler.run(params.id!)
      return { accepted: true }
    },

    "space.list": ({ query }) => core.space.list(query.kind),
    "space.recents": ({ query }) => core.space.recents(query.limit),
    "space.create": ({ body }) => core.space.create(body),
    "space.get": ({ params }) => core.space.get(params.id!),
    "space.update": ({ params, body }) => core.space.update(params.id!, body),
    "space.delete": ({ params }) => void core.space.delete(params.id!),

    "connection.get": () => core.connection.get(),
    "connection.set": ({ body }) => core.connection.set(body),
    "connection.probe": () => core.connection.probe(),
  }
  return createApi(h)
}

/** Dev/test helper: serve an app on 127.0.0.1. */
export function listen(app: { fetch: (r: Request) => Response | Promise<Response> }, port = 0): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const server = createHttpServer(async (req, res) => {
    const ctrl = new AbortController()
    res.on("close", () => ctrl.abort())
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = chunks.length ? Buffer.concat(chunks) : undefined
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v)
    const response = await app.fetch(
      new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : body, signal: ctrl.signal }),
    )
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (!response.body) return res.end()
    const reader = response.body.getReader()
    res.on("close", () => void reader.cancel().catch(() => undefined))
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    } catch {
      // client went away
    }
    res.end()
  })
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address() as { port: number }
      resolve({
        server,
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((r) => (server.closeAllConnections(), server.close(() => r()))),
      })
    }),
  )
}
