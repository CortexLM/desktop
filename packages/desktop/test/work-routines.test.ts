import { expect, it, vi } from "vitest"
import { createCortexClient } from "@cortex/sdk"
import { WorkRoutineInput, WorkRoutineEvent } from "@cortex/schema"
import { createWorkRoutinesBinding } from "../src/remote-work-routines"
import { workBotFetch } from "../src/remote-work-bot"

const id = "00000000-0000-4000-8000-000000000001", rid = "00000000-0000-4000-8000-000000000002", origin = "http://127.0.0.1:4040"
const row = { id: rid, name: "Saved", prompt: "Original", body: "Script", schedule: "0 9 * * *", trigger: { kind: "github", event: "push", extension: { safe: [1, null] } }, paused: false, quiet_if_empty: true, created_at: "now", last_run_at: null }

it("routine PATCH requires exact name/prompt and preserves full stored fields through typed SDK", async () => {
  const network = vi.fn(async (request: Request) => {
    expect(request.method).toBe("PATCH")
    expect(await request.json()).toEqual({ name: "Renamed", prompt: row.prompt, body: row.body, schedule: row.schedule, trigger: row.trigger, quiet_if_empty: true })
    return Response.json({ ...row, name: "Renamed" })
  })
  const client = createCortexClient({ baseUrl: origin, fetch: network as typeof fetch })
  const binding = createWorkRoutinesBinding(client, () => {})
  expect(WorkRoutineInput.safeParse({ epoch: "owner", routine: { name: "Renamed" } }).success).toBe(false)
  const input = WorkRoutineInput.parse({ epoch: "owner", routine: { name: "Renamed", prompt: row.prompt, body: row.body, schedule: row.schedule, trigger: row.trigger, quiet_if_empty: true } })
  expect((await binding.update(id, rid, input.routine)).name).toBe("Renamed")
  expect(network).toHaveBeenCalledOnce()
  expect(WorkRoutineEvent.safeParse({ epoch: "owner", kind: "github", event: "push", delivery_id: rid, mascot_id: id, payload: {} }).success).toBe(false)
})

it("routine allowlist keeps controls bodyless, excludes fabricated cancellation/tick and fences HTTP 200", async () => {
  const controller = new AbortController(), network = vi.fn(async () => Response.json(row))
  const owner = { origin, signal: controller.signal, fetch: network as typeof fetch, check() {}, unauthorized() {} }
  for (const path of [`/v1/mascots/${id}/routines/${rid}/cancel`, `/v1/mascots/${id}/routines/tick`, `/v1/mascots/${id}/routines/${rid}/runs/cancel`]) await expect(workBotFetch(new Request(origin + path, { method: "POST" }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  await expect(workBotFetch(new Request(origin + `/v1/mascots/${id}/routines/${rid}/pause`, { method: "POST", body: "{}" }), owner)).rejects.toMatchObject({ code: "invalid_request" })
  expect(network).not.toHaveBeenCalled()
  let release!: (response: Response) => void, arrive!: () => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<Response>(resolve => { release = resolve })
  network.mockImplementationOnce(async () => { arrive(); return held })
  const pending = workBotFetch(new Request(origin + `/v1/mascots/${id}/routines/${rid}`, { method: "PATCH", body: JSON.stringify({ name: "Saved", prompt: "Original", schedule: row.schedule }) }), owner).catch(error => error.code)
  await entered; controller.abort(); expect(await pending).toBe("aborted"); release(Response.json(row))
  expect(network).toHaveBeenCalledOnce()
})
