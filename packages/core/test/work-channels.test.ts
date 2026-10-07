import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type WorkBotBinding, type WorkChannelsBinding } from "../src/index"

it("held channel updates and stale reads cannot cross owner epochs", async () => {
  const id = "00000000-0000-4000-8000-000000000001", unavailable = async (): Promise<never> => { throw Error("Unrelated") }
  let arrive!: () => void, release!: () => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<void>(resolve => { release = resolve })
  const update = vi.fn(async () => { arrive(); await held; return { id, name: "Old", members: [id] } })
  const channels: WorkChannelsBinding = { list: unavailable, get: unavailable, create: unavailable, update, remove: unavailable }
  const binding: WorkBotBinding = { epoch: "old", signal: new AbortController().signal, channels, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }) }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    const result = core.workBot.channelUpdate(id, { epoch: "old", channel: { name: null, members: [] } }).catch(error => error.code)
    await entered; current = { ...binding, epoch: "new" }; release()
    expect(await result).toBe("aborted"); await expect(core.workBot.channelGet(id, { epoch: "old" })).rejects.toMatchObject({ code: "aborted" }); expect(update).toHaveBeenCalledOnce()
  } finally { release(); await core.close() }
})
