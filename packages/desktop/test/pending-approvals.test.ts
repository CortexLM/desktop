import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { createBotAppsBinding } from "../src/remote-bot-apps"
import { workBotFetch } from "../src/remote-work-bot"
import { ApprovalDecision } from "@cortex/schema"

const id = "00000000-0000-4000-8000-000000000001", message = "00000000-0000-4000-8000-000000000002"
const origin = "http://127.0.0.1:4040"

it("projects exact pending metadata and decision without private tool content", async () => {
  const row = { id, mascot_id: id, message_id: message, tool_name: "update_memory", created_at: "now" }
  const network = vi.fn(async (req: Request) => Response.json(req.method === "POST" ? { ok: true, dismissed: false, resumed: true, tool: "update_memory", content: "private", reply: "private" } : { items: [{ ...row, arguments: "secret", user_id: "secret" }] }))
  const apps = createBotAppsBinding(createCortexClient({ baseUrl: origin, fetch: network }), () => {})
  expect(await apps.pending()).toEqual({ items: [row] })
  expect(await apps.pending(id)).toEqual({ items: [row] })
  expect(await apps.decide(id, message, "allow")).toEqual({ ok: true, dismissed: false, resumed: true })
  expect(await network.mock.calls[2]![0].json()).toEqual({ action: "allow" })
  expect(network.mock.calls.map(([req]) => new URL(req.url).pathname)).toEqual(["/v1/bot/approvals", `/v1/mascots/${id}/approvals/pending`, `/v1/mascots/${id}/messages/${message}/respond`])
  expect(ApprovalDecision.parse({ epoch: "a", action: "allow", always: true })).toEqual({ epoch: "a", action: "allow", always: true })
  for (const bad of [{ action: "deny", always: true }, { action: "allow", always: false }, { action: "allow", always: true, ttl: 600 }]) expect(() => ApprovalDecision.parse({ epoch: "a", ...bad })).toThrow()
})

it("late real SDK decision cannot project after owner cancellation", async () => {
  let arrive!: () => void, release!: (response: Response) => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<Response>(resolve => { release = resolve }), owner = new AbortController()
  const network = vi.fn(async () => { arrive(); return held })
  const apps = createBotAppsBinding(createCortexClient({ baseUrl: origin, fetch: network }), () => owner.signal.throwIfAborted())
  const result = apps.decide(id, message, "deny").catch(error => error)
  await entered; owner.abort(); release(Response.json({ ok: true, dismissed: true, resumed: false, tool: "update_memory", content: null, reply: null }))
  expect(await result).toBeInstanceOf(Error)
  expect(network).toHaveBeenCalledOnce()
})

it("allows only precise pending and audit reads and explicit once decisions", async () => {
  const network = vi.fn(async () => Response.json({ items: [] }))
  const owner = { origin, fetch: network, signal: new AbortController().signal, check() {}, unauthorized() {} }
  for (const path of ["/v1/bot/approvals", `/v1/mascots/${id}/approvals/pending`, `/v1/mascots/${id}/tool-policy/evaluations?limit=50`]) await workBotFetch(new Request(origin + path), owner)
  for (const path of [`/v1/mascots/${id}/approvals/${message}`, `/v1/mascots/${id}/approvals/pending?cursor=next`, `/v1/mascots/${id}/tool-policy/evaluations?limit=1000`]) await expect(workBotFetch(new Request(origin + path), owner)).rejects.toMatchObject({ code: "invalid_request" })
  const url = origin + `/v1/mascots/${id}/messages/${message}/respond`
  await workBotFetch(new Request(url, { method: "POST", body: JSON.stringify({ action: "deny" }) }), owner)
  for (const body of [{ action: "answer" }, { action: "deny", always: true }, { action: "allow", always: false }, { action: "allow", always: true, extra: 1 }]) await expect(workBotFetch(new Request(url, { method: "POST", body: JSON.stringify(body) }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect((await workBotFetch(new Request(url, { method: "POST", body: JSON.stringify({ action: "allow", always: true }) }), owner)).status).toBe(200)
  expect(network).toHaveBeenCalledTimes(5)
})

it.each([404, 422])("preserves terminal or foreign refusal %s without resubmission", async status => {
  const network = vi.fn(async () => Response.json({}, { status }))
  const owner = { origin, fetch: network, signal: new AbortController().signal, check() {}, unauthorized() {} }
  await expect(workBotFetch(new Request(origin + `/v1/mascots/${id}/messages/${message}/respond`, { method: "POST", body: JSON.stringify({ action: "allow" }) }), owner)).rejects.toMatchObject({ code: status === 404 ? "not_found" : "invalid_request" })
  expect(network).toHaveBeenCalledOnce()
})
