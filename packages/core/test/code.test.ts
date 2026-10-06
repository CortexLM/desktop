import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type CodeBinding } from "../src/index"
import type { CodeSessionView } from "@cortex/schema"

it("Code fences owner changes, preserves refusals and never invokes the local executor", async () => {
  const controller = new AbortController(), id = "cnv_00000000000000000000000001"
  let current!: CodeBinding, admitted!: () => void, finish!: () => void, fail!: (error: unknown) => void
  let called!: () => void
  const firstCall = new Promise<void>(resolve => { called = resolve })
  const view: CodeSessionView = { id, epoch: "first", runtime: "cloud", modelSlug: "model", title: "", state: "cloud_only", delivery: "ready" }
  const binding: CodeBinding = {
    epoch: "first", signal: controller.signal, cloud: async () => ({ available: false, reason: "code_compute_not_configured" as const }),
    models: async () => [{ slug: "model", name: "Model", reasoning: false, vision: false, tools: true, source: "cloud" }],
    list: async () => [view], create: async () => view,
    snapshot: async () => ({ session: view, messages: [], permissions: [] }),
    watch: () => ({ ready: Promise.resolve(), close: vi.fn() }),
    turn: vi.fn((_id, _message, onAdmission) => { admitted = onAdmission; called(); return { done: new Promise<void>((resolve, reject) => { finish = resolve; fail = reject }), detach: vi.fn() } }),
    decide: vi.fn(), stop: vi.fn(), environment: vi.fn(), usage: vi.fn(), settings: vi.fn(), setDefaultModel: vi.fn(), prepare: vi.fn(), instructions: vi.fn(),
  }
  current = binding
  const network = vi.fn(() => { throw Error("Unexpected local inference") })
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteCode: { bindCode: () => current }, fetch: network })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    await core.code.create({ epoch: "first", runtime: "cloud", modelSlug: "model" })
    const request = core.code.prompt(id, { epoch: "first", message: "Exact draft" })
    await firstCall
    fail(Error("No farm"))
    await expect(request).rejects.toMatchObject({ code: "provider_error" })
    expect((await core.code.snapshot(id, { epoch: "first" })).session).toMatchObject({ delivery: "ready", errorCode: "provider_error" })
    const secondCall = new Promise<void>(resolve => { called = resolve })
    const next = core.code.prompt(id, { epoch: "first", message: "Exact draft" })
    await secondCall
    admitted(); await next
    controller.abort(); current = { ...binding, epoch: "second", signal: new AbortController().signal }
    finish()
    await expect(core.code.snapshot(id, { epoch: "first" })).rejects.toMatchObject({ code: "aborted" })
    expect(network).not.toHaveBeenCalled()
    expect(core.sessions.list()).toEqual([])
  } finally { await core.close() }
})

it("Stop fences pending admission and concurrent prompts before any turn dispatch", async () => {
  const id = "cnv_00000000000000000000000001", epoch = "first"
  let arrived!: () => void, release!: () => void
  const snapshotStarted = new Promise<void>(resolve => { arrived = resolve })
  const snapshotHeld = new Promise<void>(resolve => { release = resolve })
  const view: CodeSessionView = { id, epoch, runtime: "local", modelSlug: "model", title: "", state: "waiting", delivery: "ready" }
  const binding: CodeBinding = {
    epoch, signal: new AbortController().signal, cloud: async () => ({ available: true }), models: async () => [], list: async () => [], create: async () => view,
    snapshot: async () => { arrived(); await snapshotHeld; return { session: { ...view }, messages: [], permissions: [] } },
    watch: () => ({ ready: Promise.resolve(), close: vi.fn() }),
    turn: vi.fn((_id, _message, admitted) => { queueMicrotask(admitted); return { done: Promise.resolve(), detach: vi.fn() } }),
    decide: vi.fn(), stop: vi.fn(), environment: vi.fn(), usage: vi.fn(), settings: vi.fn(), setDefaultModel: vi.fn(), prepare: vi.fn(), instructions: vi.fn(),
  }
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteCode: { bindCode: () => binding } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    const prompt = core.code.prompt(id, { epoch, message: "pending" })
    const settled = prompt.then(() => "dispatched", error => error.code)
    await snapshotStarted
    const duplicate = core.code.prompt(id, { epoch, message: "duplicate" }).then(() => "dispatched", error => error.code)
    await core.code.stop(id, { epoch })
    expect(binding.stop).toHaveBeenCalledOnce()
    expect(binding.turn).not.toHaveBeenCalled()
    release()
    expect(await settled).toBe("aborted")
    expect(await duplicate).toBe("session_busy")
    expect(binding.turn).not.toHaveBeenCalled()
  } finally { release(); await core.close() }
})

it("fences Code environment/settings/prepare by owner epoch and validates before the producer is called", async () => {
  const id = "cnv_00000000000000000000000001", epoch = "first"
  const view: CodeSessionView = { id, epoch, runtime: "local", modelSlug: "model", title: "Fix greeting", state: "local", delivery: "ready", branch: "t8/greeting", baseBranch: "main" }
  const binding: CodeBinding = {
    epoch, signal: new AbortController().signal, cloud: async () => ({ available: false }), models: async () => [], list: async () => [], create: async () => view,
    snapshot: async () => ({ session: view, messages: [], permissions: [] }), watch: () => ({ ready: Promise.resolve(), close: vi.fn() }),
    turn: vi.fn(), decide: vi.fn(), stop: vi.fn(),
    environment: vi.fn(async () => ({ epoch, cloud: { available: false }, runtimes: [], images: [] })), usage: vi.fn(), instructions: vi.fn(),
    settings: vi.fn(async () => ({ epoch, defaultModel: "p/m", models: [] })), setDefaultModel: vi.fn(async () => {}), prepare: vi.fn(async () => view),
  }
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteCode: { bindCode: () => binding } })
  core.connection.set({ mode: "cloud", signedIn: false })
  const changed = vi.fn(); const off = core.bus.subscribe(e => { if (e.type === "code.session.changed") changed(e.properties) })
  try {
    await expect(core.code.environment({ epoch: "stale" })).rejects.toMatchObject({ code: "aborted" })
    expect(binding.environment).not.toHaveBeenCalled()
    expect(await core.code.environment({ epoch })).toMatchObject({ cloud: { available: false } })
    await expect(core.code.setDefaultModel({ epoch, defaultModel: "no-slash" })).rejects.toBeDefined()
    await expect(core.code.prepare(id, { epoch, branch: "x", pushed: true })).rejects.toBeDefined()
    await expect(core.code.instructions(id, { epoch, path: ".env" })).rejects.toBeDefined()
    expect(binding.setDefaultModel).not.toHaveBeenCalled(); expect(binding.prepare).not.toHaveBeenCalled(); expect(binding.instructions).not.toHaveBeenCalled()
    expect(await core.code.setDefaultModel({ epoch, defaultModel: "p/m" })).toMatchObject({ defaultModel: "p/m" })
    expect(binding.setDefaultModel).toHaveBeenCalledWith("p/m")
    expect(await core.code.prepare(id, { epoch, title: "Fix greeting", branch: "t8/greeting", baseBranch: "main" })).toMatchObject({ branch: "t8/greeting" })
    expect(binding.prepare).toHaveBeenCalledWith(id, { title: "Fix greeting", branch: "t8/greeting", baseBranch: "main" })
    expect(changed).toHaveBeenCalledWith({ sessionID: id, epoch })
  } finally { off(); await core.close() }
})
