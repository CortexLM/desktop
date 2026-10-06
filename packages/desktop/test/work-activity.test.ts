import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { createWorkActivityBinding } from "../src/remote-work-activity"
import { workBotFetch } from "../src/remote-work-bot"

const origin = "http://127.0.0.1:4040", bot = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002"
const event = (id: string, kind: string, payload: unknown, resource = "mascot", resource_id = bot) => ({ id: `00000000-0000-4000-8000-0000000000${id}`, kind, resource, resource_id, user_id: "SECRET_OWNER", payload, at: "2026-10-06T10:00:00.000Z" })

it("lists only SDK projections for the requested Bot; secrets, payloads and foreign resources never cross", async () => {
  const requests: Request[] = []
  const network = vi.fn(async (request: Request) => { requests.push(request); return Response.json({ stream: "sse", items: [
    event("11", "ask_user", { message_id: other, kind: "confirm", text: "SECRET_PROMPT", approval_id: "SECRET_APPROVAL" }),
    event("12", "video_ready", { video_id: other, title: "Demo", ticket: "SECRET_TICKET", url: "https://SECRET" }),
    event("13", "wake_fail", { error: "SECRET_ERROR" }),
    event("14", "future_kind", { action: "SECRET_ACTION" }),
    event("15", "ask_user", { message_id: other, kind: "confirm" }, "mascot", other),
    { id: "bad" },
  ] }) })
  const items = await createWorkActivityBinding(createCortexClient({ baseUrl: origin, fetch: network as typeof fetch }), new AbortController().signal, () => {}).list(bot)
  expect(new URL(requests[0]!.url).search).toBe("?limit=200")
  expect(items.map(item => [item.kind, item.opaque])).toEqual([["future_kind", true], ["wake_fail", true], ["video_ready", false], ["ask_user", false]])
  expect(JSON.stringify(items)).not.toMatch(/SECRET|payload|user_id/)
})

it("main allowlist admits only the exact Bot events page/stream", async () => {
  const owner = { origin, signal: new AbortController().signal, fetch: (async () => Response.json({ items: [], stream: "sse" })) as typeof fetch, check() {}, unauthorized() {} }
  await expect(workBotFetch(new Request(`${origin}/v1/mascots/${bot}/events?limit=200`), owner)).resolves.toBeInstanceOf(Response)
  for (const url of [`/v1/mascots/${bot}/events?since=${other}`, `/v1/mascots/${bot}/events?limit=500`, `/v1/code/runtimes/${bot}/events`, `/v1/mascots/not-a-uuid/events`]) await expect(workBotFetch(new Request(origin + url), owner)).rejects.toMatchObject({ code: "invalid_request" })
  await expect(workBotFetch(new Request(`${origin}/v1/mascots/${bot}/events?limit=1`, { headers: { accept: "text/event-stream" } }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  await expect(workBotFetch(new Request(`${origin}/v1/mascots/${bot}/events`, { method: "POST" }), owner)).rejects.toMatchObject({ code: "invalid_request" })
})

it("late SSE frames after owner replacement never invalidate the new owner", async () => {
  let send!: (text: string) => void, live = true, rejected!: () => void
  const fenced = new Promise<void>(resolve => { rejected = resolve })
  const body = new ReadableStream<Uint8Array>({ start(controller) { send = text => controller.enqueue(new TextEncoder().encode(text)) } })
  const network = vi.fn(async (request: Request) => { expect(new URL(request.url).search).toBe(""); return new Response(body, { headers: { "Content-Type": "text/event-stream" } }) })
  const changed = vi.fn(), disconnected = vi.fn()
  const watch = createWorkActivityBinding(createCortexClient({ baseUrl: origin, fetch: network as typeof fetch }), new AbortController().signal, () => { if (!live) { rejected(); throw Error("Old owner") } }).watch(bot, changed, () => {}, disconnected)
  await watch.ready
  send(`id: ${event("21", "ask_user", {}).id}\nevent: ask_user\ndata: ${JSON.stringify(event("21", "ask_user", { message_id: other, kind: "notice" }))}\n\n`)
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce())
  live = false
  send(`id: ${event("22", "ask_user", {}).id}\nevent: ask_user\ndata: ${JSON.stringify(event("22", "ask_user", { message_id: other, kind: "notice" }))}\n\n`)
  await fenced; watch.close(); expect(changed).toHaveBeenCalledOnce(); expect(disconnected).not.toHaveBeenCalled()
})
