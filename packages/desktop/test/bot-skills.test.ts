import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { createBotAppsBinding } from "../src/remote-bot-apps"
import { workBotFetch } from "../src/remote-work-bot"

const id = "00000000-0000-4000-8000-000000000001", origin = "http://127.0.0.1:4040"
const skill = { slug: "t8-skill", name: "t8-skill", description: "d", body: "private body", enabled: false, owner: "user", scan_verdict: "clean", scan_findings: [], surfaces: { chat: false, bot: false } }

it("admits only exact skills routes and maps producer refusals", async () => {
  const network = vi.fn(async (input: RequestInfo | URL) => (input as Request).method === "POST" ? Response.json(skill, { status: 201 }) : Response.json({ items: [skill] }))
  const owner = { origin, fetch: network as unknown as typeof fetch, signal: new AbortController().signal, check() {}, unauthorized() {} }
  for (const req of [new Request(origin + "/v1/skills"), new Request(origin + "/v1/skills", { method: "POST", body: "{}" }), new Request(origin + `/v1/mascots/${id}/skills`), new Request(origin + `/v1/mascots/${id}/skills/t8-skill`, { method: "PUT", body: "{}" })]) await workBotFetch(req, owner)
  for (const req of [new Request(origin + "/v1/skills/t8-skill", { method: "DELETE" }), new Request(origin + `/v1/mascots/${id}/skills/t8-skill/run`, { method: "POST" }), new Request(origin + `/v1/mascots/${id}/skills/..%2Fx`, { method: "PUT" }), new Request(origin + "/v1/skills?surface=chat")]) await expect(workBotFetch(req, owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect(network).toHaveBeenCalledTimes(4)
  for (const [status, code] of [[409, "conflict"], [422, "invalid_request"], [400, "invalid_request"], [404, "not_found"], [500, "provider_error"]] as const) {
    const refusing = { ...owner, fetch: vi.fn(async () => Response.json({ error: { code: "x" } }, { status })) as unknown as typeof fetch }
    await expect(workBotFetch(new Request(origin + "/v1/skills", { method: "POST", body: "{}" }), refusing)).rejects.toMatchObject({ code })
  }
})

it("binding sends the uploaded source and projects only public skill fields", async () => {
  const bodies: unknown[] = []
  const network = vi.fn(async (req: Request) => { if (req.method !== "GET") bodies.push(await req.json()); return req.method === "PUT" ? Response.json({ ok: true, enabled: true }) : req.method === "POST" ? Response.json(skill, { status: 201 }) : Response.json({ items: [skill] }) })
  const apps = createBotAppsBinding(createCortexClient({ baseUrl: origin, fetch: network }), () => undefined)
  const up = await apps.skillUpload("---\nname: t8-skill\ndescription: d\n---\nbody")
  expect(up).not.toHaveProperty("body"); expect(up.slug).toBe("t8-skill")
  expect((await apps.skills(id)).items[0]).not.toHaveProperty("body")
  expect(await apps.skillEnable(id, "t8-skill", { enabled: true, acknowledged: "clean", findings: [] })).toEqual({ ok: true, enabled: true })
  expect(bodies).toEqual([{ source: "---\nname: t8-skill\ndescription: d\n---\nbody" }, { enabled: true, acknowledged: "clean", findings: [] }])
})
