import { expect, it, vi } from "vitest"
import { createCore, memoryCredentials, type WorkBotBinding, type BotAppsBinding } from "../src/index"

it("configuration refuses old epochs before mutations and suppresses a held old-owner catalog", async () => {
  let arrive!: () => void, release!: () => void
  const entered = new Promise<void>(resolve => { arrive = resolve }), held = new Promise<void>(resolve => { release = resolve }), controller = new AbortController()
  const unavailable = async (): Promise<never> => { throw Error("Unrelated method called") }
  const page = { items: [], is_live: true, provider: "fixture", source: "marketplace" as const }
  const apps: BotAppsBinding = { catalog: async () => { arrive(); await held; return page }, skills: unavailable, skillUpload: vi.fn(unavailable), skillEnable: vi.fn(unavailable), connections: unavailable, connect: vi.fn(unavailable), authorize: vi.fn(unavailable), consent: unavailable, revoke: vi.fn(unavailable), connectors: unavailable, enable: vi.fn(unavailable), rules: unavailable, upsert: vi.fn(unavailable), remove: vi.fn(unavailable), policy: unavailable, pending: unavailable, decide: unavailable, evaluations: unavailable }
  const binding: WorkBotBinding = { apps, epoch: "old", signal: controller.signal, list: unavailable, create: unavailable, update: unavailable, snapshot: unavailable, enqueue: unavailable, cancel: unavailable, parent: unavailable, watch: () => ({ ready: Promise.resolve(), close() {} }) }
  let current = binding
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteWorkBot: { bindWorkBot: () => current } })
  core.connection.set({ mode: "cloud", signedIn: false })
  try {
    const result = core.workBot.appCatalog({ epoch: "old" }).catch(error => error.code)
    await entered
    current = { ...binding, epoch: "new", signal: new AbortController().signal }; controller.abort(); release()
    expect(await result).toBe("aborted")
    await expect(core.workBot.appConnect("googledrive", { epoch: "old", surfaces: { chat: true, bot: true }, approval_mode: "changes" })).rejects.toMatchObject({ code: "aborted" })
    await expect(core.workBot.toolRuleSet("00000000-0000-4000-8000-000000000001", { epoch: "old", effect: "deny", match_kind: "tool", match_value: "shell" })).rejects.toMatchObject({ code: "aborted" })
    await expect(core.workBot.skillUpload({ epoch: "old", source: "---\nname: t8\ndescription: d\n---\nbody" })).rejects.toMatchObject({ code: "aborted" })
    expect(apps.connect).not.toHaveBeenCalled(); expect(apps.upsert).not.toHaveBeenCalled(); expect(apps.skillUpload).not.toHaveBeenCalled()
  } finally { release(); await core.close() }
})
