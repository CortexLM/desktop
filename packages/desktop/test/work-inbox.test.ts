import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { createWorkInboxBinding } from "../src/remote-work-inbox"
import { workBotFetch } from "../src/remote-work-bot"

const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001", ntf = "ntf_00000000000000000000000001"

it("safe snapshots strip arbitrary projection and exact notification reads are bodyless204", async () => {
  const requests: Request[] = []
  const network = vi.fn(async (request: Request) => {
    requests.push(request)
    const path = new URL(request.url).pathname
    if (path === "/v1/bot/inbox") return Response.json({ items: [{ id, mascot_id: id, kind: "approval", tool_name: "safe-tool", at: "now", unread: true, payload: { credential: "never crosses" } }], working_mascot_ids: [id] })
    if (path === "/v1/notifications") return Response.json({ items: [{ id: ntf, kind: "future_kind", title: "Public", body: "Metadata", read: false, created_at: "now", arbitrary: { secret: "never crosses" } }], has_more: false })
    if (path === "/v1/bot/inbox/read") return Response.json({ ok: true, updated: 0 })
    expect(request.method).toBe("POST"); expect(await request.text()).toBe(""); return new Response(null, { status: 204 })
  })
  const client = createCortexClient({ baseUrl: origin, fetch: network as typeof fetch }), binding = createWorkInboxBinding(client, new AbortController().signal, () => {})
  const snapshot = await binding.snapshot()
  expect(snapshot.items[0]).not.toHaveProperty("payload"); expect(snapshot.notifications.items[0]).not.toHaveProperty("arbitrary")
  expect(new URL(requests[1]!.url).searchParams.get("limit")).toBe("100")
  expect(await binding.read({ item_ids: [id], unread: true })).toEqual({ ok: true, updated: 0 })
  await binding.notificationRead(ntf); await binding.notificationsReadAll()
  const owner = { origin, signal: new AbortController().signal, fetch: network as typeof fetch, check() {}, unauthorized() {} }
  await expect(workBotFetch(new Request(origin + `/v1/notifications/${ntf}/read`, { method: "POST", body: "{}" }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  await expect(workBotFetch(new Request(origin + "/v1/notifications?cursor=forbidden"), owner)).rejects.toMatchObject({ code: "invalid_request" })
  const missing = { ...owner, fetch: (async () => new Response(null, { status: 404 })) as typeof fetch }
  await expect(workBotFetch(new Request(origin + `/v1/notifications/${ntf}/read`, { method: "POST" }), missing)).rejects.toMatchObject({ code: "not_found" })
})

it("late real SSE data cannot invalidate a replacement owner and notification identity is not a resume cursor", async () => {
  let send!: (text: string) => void, started!: () => void, rejected!: () => void, live = true
  const opened = new Promise<void>(resolve => { started = resolve })
  const fenced = new Promise<void>(resolve => { rejected = resolve })
  const body = new ReadableStream<Uint8Array>({ start(controller) { send = text => controller.enqueue(new TextEncoder().encode(text)); } })
  const network = vi.fn(async (request: Request) => { expect(new URL(request.url).search).toBe(""); expect(request.headers.has("last-event-id")).toBe(false); return new Response(body, { headers: { "Content-Type": "text/event-stream" } }) })
  const client = createCortexClient({ baseUrl: origin, fetch: network as typeof fetch }), changed = vi.fn(), disconnected = vi.fn()
  const binding = createWorkInboxBinding(client, new AbortController().signal, () => { if (!live) { rejected(); throw Error("Old owner") } })
  const watch = binding.watch(changed, started, disconnected)
  await opened; await watch.ready; live = false
  send(`id: 1\ndata: ${JSON.stringify({ type: "notification", id: ntf, kind: "bot_share_invite", title: "Late", body: "Public" })}\n\n`)
  await fenced; watch.close(); expect(changed).not.toHaveBeenCalled(); expect(disconnected).not.toHaveBeenCalled(); expect(network).toHaveBeenCalledOnce()
})
