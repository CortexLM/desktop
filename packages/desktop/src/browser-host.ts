// Loopback endpoint the Chrome extension talks to. The Electron main process owns it; the engine only sees the BrowserBridge.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { CortexError, type BrowserBridge } from "@cortex/core"

export const BROWSER_PORTS = [47821, 47822, 47823, 47824, 47825]
const MAX_BODY = 2_000_000
const POLL_MS = 20_000

const isExtensionOrigin = (o: string | undefined) => !!o && /^chrome-extension:\/\/[a-p]{32}$/.test(o)

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > MAX_BODY) throw new CortexError("invalid_request", "Body too large")
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString("utf8")
  try {
    const v = raw ? JSON.parse(raw) : {}
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>
  } catch {
    // fall through
  }
  throw new CortexError("invalid_request", "Invalid JSON")
}

/** `ports` defaults to the well-known range; tests pass [0] for an ephemeral port. */
export async function startBrowserHost(bridge: BrowserBridge, ports: number[] = BROWSER_PORTS): Promise<{ port: number; close(): Promise<void> }> {
  let port = 0
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}) })
      res.end(data === undefined ? "" : JSON.stringify(data))
    }
    // DNS-rebinding and drive-by web pages: only a literal loopback Host and a browser-extension Origin pass.
    const host = req.headers.host
    if (host !== `127.0.0.1:${port}` || !isExtensionOrigin(origin)) return send(403, { error: "forbidden" })
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": origin!, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST", "access-control-max-age": "600", vary: "Origin" })
      return void res.end()
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    try {
      if (req.method === "POST" && url.pathname === "/pair") return send(200, { token: bridge.pair(String((await body(req)).code ?? "")) })
      const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1]
      if (!bridge.authenticate(token)) return send(401, { error: "unauthorized" })
      if (req.method === "GET" && url.pathname === "/poll") {
        const abort = new AbortController()
        res.on("close", () => abort.abort())
        const commands = await bridge.poll(POLL_MS, abort.signal)
        return send(200, { commands })
      }
      if (req.method !== "POST") return send(405, { error: "method" })
      const b = await body(req)
      if (url.pathname === "/share") {
        bridge.share({ id: Number(b.id), title: String(b.title ?? ""), url: String(b.url ?? "") })
        return send(204)
      }
      if (url.pathname === "/revoke") {
        bridge.revoke(Number(b.tabId))
        return send(204)
      }
      if (url.pathname === "/result") {
        bridge.complete(String(b.id), b.ok === true ? { ok: true, title: String(b.title ?? ""), url: String(b.url ?? ""), text: String(b.text ?? "") } : { ok: false, error: String(b.error ?? "failed") })
        return send(204)
      }
      if (url.pathname === "/disconnect") {
        bridge.disconnect()
        return send(204)
      }
      return send(404, { error: "not_found" })
    } catch (e) {
      const code = e instanceof CortexError ? e.code : "internal"
      return send(code === "permission_denied" ? 403 : code === "invalid_request" ? 400 : 500, { error: code })
    }
  }
  const server: Server = createServer((req, res) => void handle(req, res).catch(() => res.destroy()))
  let lastError: unknown
  for (const candidate of ports) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject)
        server.listen(candidate, "127.0.0.1", () => (server.off("error", reject), resolve()))
      })
      port = (server.address() as AddressInfo).port
      bridge.setEndpoint({ listening: true, port })
      return { port, close: () => new Promise<void>((r) => (bridge.setEndpoint({ listening: false }), server.closeAllConnections(), server.close(() => r()))) }
    } catch (e) {
      lastError = e
    }
  }
  bridge.setEndpoint({ listening: false })
  throw lastError
}
