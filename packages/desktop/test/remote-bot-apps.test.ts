import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { createBotAppsBinding } from "../src/remote-bot-apps"
import { AppConsent, ToolRuleInput } from "@cortex/schema"

it("rule upsert returns re-listed stored IDs, verifies before deletion and never accepts deleted zero", async () => {
  const id = "00000000-0000-4000-8000-000000000001", stored = "00000000-0000-4000-8000-000000000002", attempt = "00000000-0000-4000-8000-000000000003"
  const effect = "deny", rule = { id: stored, effect, match_kind: "tool", match_value: "shell", reason: "" }
  const calls: string[] = []; let deleted = 1
  const network = vi.fn(async (request: Request) => {
    calls.push(request.method + " " + new URL(request.url).pathname)
    return Response.json(request.method === "POST" ? { ...rule, id: attempt } : request.method === "DELETE" ? { deleted } : { items: [rule] }, { status: request.method === "POST" ? 201 : 200 })
  })
  const client = createCortexClient({ baseUrl: "http://127.0.0.1:4040", fetch: network })
  const apps = createBotAppsBinding(client, () => {})
  expect(await apps.upsert(id, { effect: "deny", match_kind: "tool", match_value: "shell" })).toEqual({ items: [rule] })
  const prior = calls.length
  await expect(apps.remove(id, attempt)).rejects.toMatchObject({ code: "not_found" })
  expect(calls.slice(prior)).toEqual(["GET /v1/mascots/" + id + "/approvals"])
  expect(await apps.remove(id, stored)).toEqual({ deleted: 1 })
  expect(calls.slice(-2)).toEqual(["GET /v1/mascots/" + id + "/approvals", "DELETE /v1/mascots/" + id + "/approvals/" + stored])
  deleted = 0
  await expect(apps.remove(id, stored)).rejects.toMatchObject({ code: "conflict" })
})

it("public connection parsing excludes private response fields and never opens authorization automatically", async () => {
  const connection = { id: "pcn_01K3P7QW9XJ8ZB4T2M6N5R0VYD", slug: "googledrive", provider: "composio", status: "pending", surfaces: { chat: true, bot: true }, approval_mode: "changes", updated_at: "now" }
  const opened = vi.fn(async () => {})
  const client = createCortexClient({ baseUrl: "http://127.0.0.1:4040", fetch: async () => Response.json({ connection: { ...connection, external_id: "private", auth_config_id: "private", access_token: "private" }, redirect_url: "https://fixture.invalid/consent?token=private" }) })
  const apps = createBotAppsBinding(client, () => {}, opened)
  expect(await apps.connect("googledrive", { surfaces: { chat: true, bot: true }, approval_mode: "changes" })).toEqual(connection)
  expect(opened).not.toHaveBeenCalled()
  await apps.authorize("googledrive")
  expect(opened).toHaveBeenCalledWith("https://fixture.invalid/consent?token=private")
  expect(() => AppConsent.parse({ epoch: "a", surfaces: { chat: true, bot: true }, approval_mode: "always_allow" })).toThrow()
  expect(() => ToolRuleInput.parse({ epoch: "a", effect: "always", match_kind: "tool", match_value: "shell" })).toThrow()
})

it("late upsert cannot start rule re-list after owner cancellation", async () => {
  let arrive!: () => void, release!: (response: Response) => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<Response>(resolve => { release = resolve }), owner = new AbortController()
  const network = vi.fn(async () => { arrive(); return held })
  const client = createCortexClient({ baseUrl: "http://127.0.0.1:4040", fetch: network })
  const apps = createBotAppsBinding(client, () => owner.signal.throwIfAborted())
  const pending = apps.upsert("00000000-0000-4000-8000-000000000001", { effect: "deny", match_kind: "tool", match_value: "shell" }).catch(error => error)
  await entered; owner.abort(); release(Response.json({}, { status: 201 }))
  expect(await pending).toBeInstanceOf(Error)
  expect(network).toHaveBeenCalledOnce()
})
