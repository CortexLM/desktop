import { expect, it, vi } from "vitest"
import { workBotFetch } from "../src/remote-work-bot"

it("connector and rule transport preserves exact statuses and refuses policy writes or unknown catalog queries", async () => {
  const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001", connection = "pcn_01K3P7QW9XJ8ZB4T2M6N5R0VYD"
  const network = vi.fn(async (request: Request) => { const path = new URL(request.url).pathname; const status = request.method === "DELETE" && path === "/v1/plugins/googledrive" ? 204 : request.method === "POST" && path.endsWith("/approvals") ? 201 : 200; return new Response(status === 204 ? null : "{}", { status }) })
  const owner = { origin, fetch: network as typeof fetch, signal: new AbortController().signal, check() {}, unauthorized() {} }
  for (const [method, path, status] of [["GET", "/v1/plugins/catalog?q=drive&limit=100", 200], ["GET", "/v1/plugins/connections", 200], ["POST", "/v1/plugins/googledrive/connect", 200], ["PATCH", "/v1/plugins/googledrive", 200], ["DELETE", "/v1/plugins/googledrive", 204], ["PUT", `/v1/mascots/${id}/connectors/${connection}`, 200], ["POST", `/v1/mascots/${id}/approvals`, 201], ["DELETE", `/v1/mascots/${id}/approvals/${id}`, 200], ["GET", `/v1/mascots/${id}/tool-policy`, 200]] as const) expect((await workBotFetch(new Request(origin + path, { method }), owner)).status).toBe(status)
  const count = network.mock.calls.length
  for (const [method, path] of [["GET", "/v1/plugins/catalog?owner=foreign"], ["PUT", "/v1/approval-policy"], ["GET", "/v1/plugins/connections?credentials=true"], ["POST", "/v1/plugins/googledrive/install"], ["PUT", `/v1/mascots/${id}/connectors/not-a-connection`]]) await expect(workBotFetch(new Request(origin + path, { method }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect(network).toHaveBeenCalledTimes(count)
})

it("independent copy transport preserves exact statuses and refuses public token calls", async () => {
  const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001"
  const network = vi.fn(async (request: Request) => new Response(request.method === "DELETE" ? null : "{}", { status: request.method === "DELETE" ? 204 : request.method === "POST" ? 201 : 200 }))
  const owner = { origin, fetch: network as typeof fetch, signal: new AbortController().signal, check() {}, unauthorized() {} }
  for (const [method, path] of [["GET", `/v1/mascots/${id}/share`], ["POST", `/v1/mascots/${id}/share`], ["POST", `/v1/mascots/${id}/share/invites`], ["DELETE", `/v1/mascots/${id}/share`], ["GET", "/v1/bot/share-invites"], ["GET", `/v1/bot/share-invites/${id}`], ["POST", `/v1/bot/share-invites/${id}/accept`]]) expect((await workBotFetch(new Request(origin + path, { method }), owner)).status).toBe(method === "DELETE" ? 204 : method === "POST" ? 201 : 200)
  const count = network.mock.calls.length
  for (const path of [`/v1/bot/shares/${id}/clone`, `/v1/mascots/${id}/share?visibility=public`]) await expect(workBotFetch(new Request(origin + path, { method: "POST" }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect(network).toHaveBeenCalledTimes(count)
})

it("decline admits only bodyless exact POST with 200 and fences a held old-owner response", async () => {
  const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001", path = `/v1/bot/share-invites/${id}/decline`
  const network = vi.fn(async () => Response.json({ id, state: "declined", declined_at: "2026-10-05T00:00:00+00:00" }))
  const controller = new AbortController(), owner = { origin, fetch: network as typeof fetch, signal: controller.signal, check() {}, unauthorized() {} }
  expect((await workBotFetch(new Request(origin + path, { method: "POST" }), owner)).status).toBe(200)
  const count = network.mock.calls.length
  for (const request of [new Request(origin + path, { method: "POST", body: "{}" }), new Request(origin + path, { method: "GET" }), new Request(origin + path + "?reason=no", { method: "POST" }), new Request(origin + path.replace(id, "bad-id"), { method: "POST" }), new Request("http://127.0.0.1:4041" + path, { method: "POST" })]) await expect(workBotFetch(request, owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect(network).toHaveBeenCalledTimes(count)
  network.mockImplementationOnce(async () => new Response("{}", { status: 201 }))
  await expect(workBotFetch(new Request(origin + path, { method: "POST" }), owner)).rejects.toMatchObject({ code: "provider_error" })
  let release!: (response: Response) => void, arrived!: () => void
  const held = new Promise<Response>(resolve => { release = resolve }), entered = new Promise<void>(resolve => { arrived = resolve })
  network.mockImplementationOnce(async () => { arrived(); return held })
  const result = workBotFetch(new Request(origin + path, { method: "POST" }), owner).catch(error => error.code)
  await entered; controller.abort()
  expect(await result).toBe("aborted")
  release(Response.json({ id, state: "declined", declined_at: "2026-10-05T00:00:00+00:00" }))
})

it("Work Bot transport admits only exact typed methods paths and expected statuses", async () => {
  const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001"
  const network = vi.fn(async (request: Request) => new Response("{}", { status: request.method === "POST" && request.url.endsWith("/tasks") ? 202 : 200 }))
  const owner = { origin, fetch: network as typeof fetch, signal: new AbortController().signal, check() {}, unauthorized() {} }
  for (const [method, path] of [["GET", `/v1/mascots/${id}/messages`], ["POST", `/v1/mascots/${id}/messages`], ["POST", `/v1/mascots/${id}/tasks`], ["PATCH", `/v1/mascots/${id}`]]) expect((await workBotFetch(new Request(origin + path, { method }), owner)).ok).toBe(true)
  const count = network.mock.calls.length
  for (const [method, path] of [["GET", `/v1/mascots/${id}/secrets`], ["DELETE", `/v1/mascots/${id}`], ["POST", `/v1/mascots/${id}/messages/other/respond`], ["GET", "/v1/mascots?owner=foreign"], ["POST", "/v1/jobs"], ["GET", "/v1/mascots/not-an-id"]]) await expect(workBotFetch(new Request(origin + path, { method }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect(network).toHaveBeenCalledTimes(count)
})

it("Work Bot transport settles replacement before a noncooperative late fetch", async () => {
  const controller = new AbortController(); let release!: (response: Response) => void, entered!: () => void
  const arrival = new Promise<void>(resolve => { entered = resolve })
  const held = new Promise<Response>(resolve => { release = resolve })
  const request = workBotFetch(new Request("http://127.0.0.1:4040/v1/mascots"), { origin: "http://127.0.0.1:4040", signal: controller.signal, check() {}, unauthorized() {}, fetch: vi.fn(async () => { entered(); return held }) as typeof fetch })
  const result = request.catch(error => error.code)
  await arrival; controller.abort()
  expect(await result).toBe("aborted")
  release(new Response('{"items":[]}'))
})
