import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type WorkBotBinding, type WorkInboxBinding } from "../src/index"

it("late inbox snapshot/read and stream invalidations stay inside owner epoch", async () => {
  const unavailable = async (): Promise<never> => { throw Error("Unrelated operation") }, controller = new AbortController()
  let release!: () => void, arrive!: () => void, changed!: () => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<void>(resolve => { release = resolve })
  const snapshot = vi.fn(async () => { arrive(); await held; return { items: [], working_mascot_ids: [], notifications: { items: [], has_more: false as const } } })
  const inbox: WorkInboxBinding = { snapshot, read: unavailable, notificationRead: unavailable, notificationsReadAll: unavailable, watch(change) { changed = change; return { ready: Promise.resolve(), close() {} } } }
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, inbox, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }) }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } }), events = vi.fn()
  core.connection.set({ mode: "cloud", signedIn: false }); core.bus.on("workInbox.changed", events)
  try {
    await core.workBot.inboxSubscribe({ epoch: "old" })
    const result = core.workBot.inboxSnapshot({ epoch: "old" }).catch(error => error.code)
    await entered; current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); changed(); release()
    expect(await result).toBe("aborted"); expect(events).not.toHaveBeenCalled()
    await expect(core.workBot.inboxRead({ epoch: "old", read: { all: true } })).rejects.toMatchObject({ code: "aborted" })
    expect(snapshot).toHaveBeenCalledOnce()
  } finally { release(); await core.close() }
})
