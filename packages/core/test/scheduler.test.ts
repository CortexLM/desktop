import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { fakeOpenAI, testCore, toolCall } from "./helpers"

describe("scheduled run outcomes", () => {
  it("marks persisted running records interrupted when the scheduler restarts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-routine-reopen-"))
    const srv = await fakeOpenAI([{ deltas: [{ content: "recovered" }], finish: "stop" }])
    let core = testCore(srv.url, { dataDir: dir })
    try {
      const task = core.scheduler.create({ title: "Interrupted routine", prompt: "run", schedule: { type: "daily", time: "09:00" }, model: { providerID: "fake", modelID: "reasoner" } })
      const run = { id: "run-interrupted", taskID: task.id, status: "running", time: { start: Date.now() - 1000 } }
      core.storage.putDoc("run", run.id, run, task.id, run.time.start)
      await core.close()
      core = testCore(srv.url, { dataDir: dir })
      core.scheduler.start()
      expect(core.scheduler.get(task.id).runs[0]).toMatchObject({ status: "error", error: { code: "aborted" } })
      expect(core.scheduler.get(task.id).runs[0]?.time.end).toBeGreaterThanOrEqual(run.time.start)
      expect((await core.scheduler.run(task.id)).status).toBe("success")
      expect(core.scheduler.get(task.id).runs).toHaveLength(2)
    } finally { await core.close(); await srv.close(); rmSync(dir, { recursive: true, force: true }) }
  })

  it("persists interruption as an error instead of a successful routine run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-routine-"))
    const srv = await fakeOpenAI([{ deltas: [toolCall("wait", "bash", { command: "echo test" })], finish: "tool_calls" }])
    const core = testCore(srv.url)
    try {
      const task = core.scheduler.create({ title: "Interrupted routine", prompt: "run", schedule: { type: "daily", time: "09:00" }, model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
      const asked = new Promise<string>((resolve) => core.bus.on("permission.asked", ({ properties }) => resolve(properties.permission.sessionID)))
      const running = core.scheduler.run(task.id)
      const sessionID = await asked
      expect(core.scheduler.get(task.id).runs[0]?.status).toBe("running")
      core.scheduler.start()
      expect(core.scheduler.get(task.id).runs[0]?.status).toBe("running")
      await core.sessions.abort(sessionID)
      expect(await running).toMatchObject({ status: "error", error: { code: "aborted" } })
      expect(core.scheduler.get(task.id).runs[0]).toMatchObject({ status: "error", error: { code: "aborted" }, sessionID })
      expect(core.permissions.list()).toEqual([])
    } finally { await core.close(); await srv.close(); rmSync(dir, { recursive: true, force: true }) }
  })

  it("refuses duplicate starts before creating another session or run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-routine-"))
    const srv = await fakeOpenAI([{ deltas: [toolCall("wait", "bash", { command: "echo test" })], finish: "tool_calls" }])
    const core = testCore(srv.url)
    try {
      const task = core.scheduler.create({ title: "Single routine", prompt: "run", schedule: { type: "daily", time: "09:00" }, model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
      const asked = new Promise<string>((resolve) => core.bus.on("permission.asked", ({ properties }) => resolve(properties.permission.sessionID)))
      const running = core.scheduler.run(task.id)
      const sessionID = await asked
      const duplicate = Promise.resolve().then(() => core.scheduler.run(task.id))
      const refused = expect(duplicate).rejects.toMatchObject({ code: "conflict" })
      await core.sessions.abort(sessionID)
      await refused
      await running
      expect(core.scheduler.get(task.id).runs).toHaveLength(1)
      expect(core.sessions.list()).toHaveLength(1)
      expect(srv.requests).toHaveLength(1)
    } finally { await core.close(); await srv.close(); rmSync(dir, { recursive: true, force: true }) }
  })

  it("does not recreate deleted routine history when an active run finishes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cortex-routine-"))
    const srv = await fakeOpenAI([{ deltas: [toolCall("wait", "bash", { command: "echo test" })], finish: "tool_calls" }])
    const core = testCore(srv.url)
    try {
      const task = core.scheduler.create({ title: "Deleted routine", prompt: "run", schedule: { type: "daily", time: "09:00" }, model: { providerID: "fake", modelID: "reasoner" }, directory: dir })
      const asked = new Promise<string>((resolve) => core.bus.on("permission.asked", ({ properties }) => resolve(properties.permission.sessionID)))
      const running = core.scheduler.run(task.id)
      const sessionID = await asked
      core.scheduler.delete(task.id)
      const events: string[] = []
      core.bus.on("task.run", ({ properties }) => events.push(properties.run.status))
      await core.sessions.abort(sessionID)
      await running
      expect(core.storage.listDocs("run", task.id)).toEqual([])
      expect(events).toEqual([])
    } finally { await core.close(); await srv.close(); rmSync(dir, { recursive: true, force: true }) }
  })
})
