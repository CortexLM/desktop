import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { createWorkChannelsBinding } from "../src/remote-work-channels"
import { workBotFetch } from "../src/remote-work-bot"

const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001"
it("channels preserve nullable replacement wire, safe metadata and narrow status allowlist", async () => {
  const requests: Request[] = [], wire = { id, name: "Group", members: [id], user_id: id, secret: "private" }
  const network = vi.fn(async (request: Request) => { requests.push(request); return Response.json(request.method === "DELETE" ? { deleted: true } : request.method === "GET" && new URL(request.url).pathname === "/v1/channels" ? { items: [wire] } : wire, { status: request.method === "POST" ? 201 : 200 }); })
  const owner = { origin, signal: new AbortController().signal, fetch: network as typeof fetch, check() {}, unauthorized() {} }
  const client = createCortexClient({ baseUrl: origin, fetch: ((request: Request) => workBotFetch(request, owner)) as typeof fetch }), binding = createWorkChannelsBinding(client, () => {})
  expect(await binding.list()).toEqual([{ id, name: "Group", members: [id] }]); await binding.create({ name: "Group", members: null }); await binding.get(id)
  await binding.update(id, { name: null, members: null }); expect(await requests[3]!.json()).toEqual({ name: null, members: null })
  await binding.update(id, { members: [] }); expect(await requests[4]!.json()).toEqual({ members: [] })
  expect(await binding.remove(id)).toEqual({ deleted: true }); expect(await requests[5]!.text()).toBe("")
  for (const path of [`/v1/channels/${id}/messages`, `/v1/channels/${id}/enable`, "/v1/channels?cursor=x"]) await expect(workBotFetch(new Request(origin + path), owner)).rejects.toMatchObject({ code: "invalid_request" })
  for (const [status, code] of [[404, "not_found"], [422, "invalid_request"], [409, "conflict"]] as const) await expect(workBotFetch(new Request(origin + `/v1/channels/${id}`, { method: "PATCH", body: "{}" }), { ...owner, fetch: (async () => new Response(null, { status })) as typeof fetch })).rejects.toMatchObject({ code })
})
