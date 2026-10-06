import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type WorkBotBinding, type WorkRoutinesBinding } from "../src/index"

it("routine history and mutation results cannot cross owner replacement", async () => {
  const id = "00000000-0000-4000-8000-000000000001", controller = new AbortController()
  let release!: () => void, arrive!: () => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<void>(resolve => { release = resolve })
  const unavailable = async (): Promise<never> => { throw Error("Unrelated operation unexpectedly called") }
  const history = vi.fn(async () => { arrive(); await held; return [] })
  const routines: WorkRoutinesBinding = { list: unavailable, get: unavailable, create: unavailable, update: unavailable, remove: unavailable, pause: unavailable, resume: unavailable, history, event: unavailable }
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, routines, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }) }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    const result = core.workBot.routineHistory(id, id, { epoch: "old" }).catch(error => error.code)
    await entered; current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); release()
    expect(await result).toBe("aborted")
    await expect(core.workBot.routinePause(id, id, { epoch: "old" })).rejects.toMatchObject({ code: "aborted" })
    expect(history).toHaveBeenCalledOnce()
  } finally { release(); await core.close() }
})
