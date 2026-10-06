import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { WorkBotCreate, WorkBotUpdate, WorkBotView } from "@cortex/schema"
import { createRemoteWorkBotBinding, workBotFetch } from "../src/remote-work-bot"
import type { MainRemoteChatBinding } from "../src/remote-chat"

it("hierarchy uses required nullable response and omission-aware typed create/PATCH without unrelated defaults", async () => {
  const id = "00000000-0000-4000-8000-000000000001", lead = "00000000-0000-4000-8000-000000000002"
  let stored: string | null = null
  const bodies: object[] = []
  const network = vi.fn(async (request: Request) => {
    const body = await request.json(); bodies.push(body)
    if (Object.hasOwn(body, "lead_id")) stored = body.lead_id
    return Response.json({ id, lead_id: stored, name: "Owned", description: "", label: "", look: "meadow", shape: "dots", notifications: true, status: "idle", computer_kind: "cloud", updated_at: "now" }, { status: request.method === "POST" ? 201 : 200 })
  })
  const controller = new AbortController(), client = createCortexClient({ baseUrl: "http://127.0.0.1:4040", fetch: network as typeof fetch })
  const binding = createRemoteWorkBotBinding(client, { epoch: "owner", signal: controller.signal } as MainRemoteChatBinding, () => {})
  const created = await binding.create(WorkBotCreate.parse({ epoch: "owner", config: { name: "Owned" } }).config)
  expect(created.lead_id).toBeNull(); expect(bodies[0]).not.toHaveProperty("lead_id")
  await binding.update(id, WorkBotUpdate.parse({ epoch: "owner", config: { lead_id: lead } }).config)
  expect(bodies[1]).toEqual({ lead_id: lead })
  expect((await binding.update(id, WorkBotUpdate.parse({ epoch: "owner", config: { label: "Specialist" } }).config)).lead_id).toBe(lead)
  expect(bodies[2]).toEqual({ label: "Specialist" })
  expect((await binding.update(id, { lead_id: null })).lead_id).toBeNull()
  expect(bodies[3]).toEqual({ lead_id: null })
  const { lead_id: _lead, ...missing } = created
  expect(WorkBotView.safeParse(missing).success).toBe(false)
  expect(WorkBotUpdate.safeParse({ epoch: "owner", config: { lead_id: "bad" } }).success).toBe(false)
  expect(WorkBotUpdate.safeParse({ epoch: "owner", config: { lead_id: lead, user_id: id } }).success).toBe(false)
})

it("failed hierarchy writes never retry; held responses cannot cross ownership", async () => {
  const origin = "http://127.0.0.1:4040", id = "00000000-0000-4000-8000-000000000001", controller = new AbortController()
  const network = vi.fn(async () => new Response("{}", { status: 422 }))
  const owner = { origin, fetch: network as typeof fetch, signal: controller.signal, check() {}, unauthorized() {} }
  for (const status of [422, 404, 500]) {
    network.mockImplementationOnce(async () => new Response("{}", { status }))
    await expect(workBotFetch(new Request(origin + `/v1/mascots/${id}`, { method: "PATCH", body: JSON.stringify({ lead_id: null }) }), owner)).rejects.toMatchObject({ code: "provider_error" })
  }
  expect(network).toHaveBeenCalledTimes(3)
  let release!: (response: Response) => void, arrived!: () => void
  const held = new Promise<Response>(resolve => { release = resolve }), entered = new Promise<void>(resolve => { arrived = resolve })
  network.mockImplementationOnce(async () => { arrived(); return held })
  const pending = workBotFetch(new Request(origin + `/v1/mascots/${id}`, { method: "PATCH", body: "{}" }), owner).catch(error => error.code)
  await entered; controller.abort(); expect(await pending).toBe("aborted"); release(Response.json({ lead_id: null }))
  expect(network).toHaveBeenCalledTimes(4)
})
