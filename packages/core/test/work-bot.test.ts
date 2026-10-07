import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type WorkBotBinding } from "../src/index"

it("independent copy validates exact inputs and fences held previous-owner preview", async () => {
  const id = "00000000-0000-4000-8000-000000000001", controller = new AbortController()
  let release!: () => void, arrived!: () => void
  const entered = new Promise<void>(resolve => { arrived = resolve }), held = new Promise<void>(resolve => { release = resolve })
  const unavailable = async (): Promise<never> => { throw Error("Unrelated operation unexpectedly called") }
  const preview = { kind: "template" as const, name: "Copy", look: "meadow", shape: "dots", description: "", label: "", plugins: [], skills: [], routines: [], copies_independent: true as const, reconnect_required: true as const }
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }), copy: { status: unavailable, create: vi.fn(unavailable), invite: vi.fn(unavailable), revoke: vi.fn(unavailable), inbox: unavailable, accept: vi.fn(unavailable), decline: vi.fn(unavailable), preview: vi.fn(async () => { arrived(); await held; return preview }) } }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    expect(() => core.workBot.copyCreate(id, { epoch: "old", visibility: "public" })).toThrow()
    expect(() => core.workBot.copyInvite(id, { epoch: "old", email: "invalid" })).toThrow()
    const pending = core.workBot.copyPreview(id, { epoch: "old" }).catch(error => error.code)
    await entered
    current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); release()
    expect(await pending).toBe("aborted")
    await expect(core.workBot.copyAccept(id, { epoch: "old" })).rejects.toMatchObject({ code: "aborted" })
    expect(binding.copy!.create).not.toHaveBeenCalled(); expect(binding.copy!.invite).not.toHaveBeenCalled(); expect(binding.copy!.accept).not.toHaveBeenCalled()
  } finally { release(); await core.close() }
})

it("decline validates owner-only input and rejects late decisions after replacement or local selection", async () => {
  const id = "00000000-0000-4000-8000-000000000001", controller = new AbortController()
  let release!: () => void, arrived!: () => void
  const held = new Promise<void>(resolve => { release = resolve }), entered = new Promise<void>(resolve => { arrived = resolve })
  const unavailable = async (): Promise<never> => { throw Error("Unrelated operation unexpectedly called") }
  const decline = vi.fn(async () => { arrived(); await held; return { id, state: "declined" as const, declined_at: "2026-10-05T00:00:00+00:00" } })
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }), copy: { status: unavailable, create: unavailable, invite: unavailable, revoke: unavailable, inbox: unavailable, preview: unavailable, accept: unavailable, decline } }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    expect(() => core.workBot.copyDecline("bad-id", { epoch: "old" })).toThrow()
    expect(() => core.workBot.copyDecline(id, { epoch: "old", recipient_id: id })).toThrow()
    expect(decline).not.toHaveBeenCalled()
    const pending = core.workBot.copyDecline(id, { epoch: "old" }).catch(error => error.code)
    await entered; current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); release()
    expect(await pending).toBe("aborted")
    await expect(core.workBot.copyDecline(id, { epoch: "old" })).rejects.toMatchObject({ code: "aborted" })
    core.connection.set({ mode: "local", signedIn: false })
    await expect(core.workBot.copyDecline(id, { epoch: "new" })).rejects.toThrow()
    expect(decline).toHaveBeenCalledOnce()
  } finally { release(); await core.close() }
})

it("Work Bot late admission cannot cross owner epochs or duplicate active enqueue", async () => {
  const id = "00000000-0000-4000-8000-000000000001", controller = new AbortController()
  let release!: () => void, arrived!: () => void
  const entered = new Promise<void>(resolve => { arrived = resolve }), held = new Promise<void>(resolve => { release = resolve })
  const bot = { id, lead_id: null, name: "Owner", label: "", description: "", look: "meadow" as const, shape: "dots" as const, notifications: true, status: "idle", computer_kind: "cloud", updated_at: "now" }
  const job = { id, kind: "explore", goal: "fixture", status: "queued" as const, created_at: "now" }
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, list: async () => [bot], create: async () => bot, update: async () => bot, snapshot: async () => ({ bot, jobs: [job], messages: [], computerAvailable: false }), enqueue: vi.fn(async () => { arrived(); await held; return job }), parent: vi.fn(async () => ({ message: { id, sender: "user", kind: "text", text: "parent", at: "now", responded: false, dismissed: false }, replies: [] })), cancel: vi.fn(async () => job), watch: () => ({ ready: Promise.resolve(), close: vi.fn() }) }
  let current = binding
  let disconnected!: () => void, ready!: () => void
  const subscriptionReady = new Promise<void>(resolve => { ready = resolve })
  binding.snapshot = vi.fn(binding.snapshot)
  binding.watch = vi.fn((_changed, ended) => { disconnected = ended; return { ready: subscriptionReady, close: vi.fn() } })
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    const snapshot = core.workBot.snapshot(id, { epoch: "old" })
    expect(binding.snapshot).not.toHaveBeenCalled()
    ready(); await snapshot
    disconnected(); await core.workBot.snapshot(id, { epoch: "old" })
    expect(binding.watch).toHaveBeenCalledTimes(2)
    const pending = core.workBot.enqueue(id, { epoch: "old", kind: "explore", goal: "fixture" })
    const result = pending.catch(error => error.code)
    await entered
    await expect(core.workBot.enqueue(id, { epoch: "old", kind: "explore", goal: "duplicate" })).rejects.toMatchObject({ code: "session_busy" })
    await expect(core.workBot.parent(id, { epoch: "old", text: "parent" })).rejects.toMatchObject({ code: "session_busy" })
    current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); release()
    expect(await result).toBe("aborted")
    await expect(core.workBot.cancel(id, id, { epoch: "old" })).rejects.toMatchObject({ code: "aborted" })
    await expect(core.workBot.parent(id, { epoch: "old", text: "parent" })).rejects.toMatchObject({ code: "aborted" })
    expect(binding.parent).not.toHaveBeenCalled()
    expect(binding.cancel).not.toHaveBeenCalled(); expect(binding.enqueue).toHaveBeenCalledOnce()
  } finally { release(); await core.close() }
})

it("Work Bot late explicit parent reply is refused after owner replacement", async () => {
  const id = "00000000-0000-4000-8000-000000000001", controller = new AbortController()
  let release!: () => void, arrived!: () => void
  const held = new Promise<void>(resolve => { release = resolve }), entered = new Promise<void>(resolve => { arrived = resolve })
  const message = { id, sender: "user", kind: "text", text: "parent", at: "now", responded: false, dismissed: false }
  const unavailable = async (): Promise<never> => { throw Error("Unrelated operation unexpectedly called") }
  const binding: WorkBotBinding = { epoch: "old", signal: controller.signal, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: vi.fn(async () => { arrived(); await held; return { message, replies: [] } }), watch: () => ({ ready: Promise.resolve(), close() {} }) }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    await expect(core.workBot.parent(id, { epoch: "old", text: " \n " })).rejects.toThrow()
    expect(binding.parent).not.toHaveBeenCalled()
    const pending = core.workBot.parent(id, { epoch: "old", text: "parent" }).catch(error => error.code)
    await entered
    await expect(core.workBot.parent(id, { epoch: "old", text: "duplicate" })).rejects.toMatchObject({ code: "session_busy" })
    current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); release()
    expect(await pending).toBe("aborted")
    expect(binding.parent).toHaveBeenCalledOnce()
  } finally { release(); await core.close() }
})
