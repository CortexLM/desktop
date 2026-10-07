import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type WorkBotBinding, type WorkActivityBinding } from "../src/index"

it("late activity page and hints stay inside the owner epoch", async () => {
  const unavailable = async (): Promise<never> => { throw Error("Unrelated operation") }, controller = new AbortController(), id = "00000000-0000-4000-8000-000000000001"
  let release!: () => void, arrive!: () => void, changed!: () => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<void>(resolve => { release = resolve })
  const list = vi.fn(async () => { arrive(); await held; return [] })
  const activity: WorkActivityBinding = { list, watch(_id, change) { changed = change; return { ready: Promise.resolve(), close() {} } } }
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, activity, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }) }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } }), events = vi.fn()
  core.connection.set({ mode: "cloud", signedIn: false }); core.bus.on("workActivity.changed", events)
  try {
    await core.workBot.activitySubscribe(id, { epoch: "old" })
    const result = core.workBot.activityList(id, { epoch: "old" }).catch(error => error.code)
    await entered; current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); changed(); release()
    expect(await result).toBe("aborted"); expect(events).not.toHaveBeenCalled()
    await expect(core.workBot.activityList(id, { epoch: "old" })).rejects.toMatchObject({ code: "aborted" })
    await expect(core.workBot.activityList("not-a-uuid", { epoch: "new" })).rejects.toThrow()
  } finally { release(); await core.close() }
})
