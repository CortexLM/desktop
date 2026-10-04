import { afterEach, describe, expect, it, vi } from "vitest"
import { createClient } from "@cortex/client"
import { RemoteAuthState, type RemoteAuthInput } from "@cortex/schema"
import { createServer } from "../../server/src/index"
import { CLOUD_URL, CortexError, createCore, memoryCredentials, type Core } from "../src/index"

const owner = { origin: CLOUD_URL, revision: "00000000-0000-4000-8000-000000000001" }
const signedOut: RemoteAuthState = { status: "signed_out", signedIn: false, owner }
const localState: RemoteAuthState = { status: "signed_out", signedIn: false, owner: null }
const request = (body: unknown) => new Request("cortex://engine/api/connection/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

describe("connection auth boundary", () => {
  let core: Core | undefined
  afterEach(async () => { await core?.close(); core = undefined })

  it("returns only public host state; keeps active sign-in distinct from candidate status", async () => {
    let state = signedOut
    const privateFields = { access_token: "private-access", cookie: "private-cookie", pending_authentication_token: "private-pending", authentication_challenge_id: "private-challenge", qr_code: "private-qr", totp_secret: "private-totp" }
    const host = {
      state: vi.fn((_origin: string) => ({ ...state, ...privateFields, owner: { ...owner, ...privateFields } })),
      authenticate: vi.fn(async (_origin: string, _input: RemoteAuthInput) => ({ ...state, ...privateFields })),
      clear: vi.fn(() => { state = signedOut }),
    }
    core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: host })
    const app = createServer(core)
    const client = createClient({ baseUrl: "cortex://engine", fetch: (r) => app.fetch(r) })
    expect(await client.connection.set({ mode: "cloud", signedIn: true })).toEqual({ mode: "cloud", signedIn: false })
    expect(await client.connection.auth.get()).toEqual(signedOut)
    const stored = core.storage.db.prepare("SELECT data FROM doc UNION ALL SELECT data FROM event").all()
    state = { status: "signed_in", signedIn: true, email: "person@example.test", owner }
    const input = { action: "local" as const, owner, email: state.email!, password: "private-password", ...privateFields, signedIn: true }
    expect(await client.connection.auth.submit(input)).toEqual(state)
    expect(host.authenticate).toHaveBeenLastCalledWith(CLOUD_URL, { action: "local", owner, email: input.email, password: input.password })
    expect(await client.connection.auth.get()).toEqual(state)
    for (const status of ["code_sent", "verify_email", "mfa_challenge", "mfa_enrollment"] as const) {
      state = { ...state, status, candidate: owner.revision }
      expect(await client.connection.auth.get()).toEqual(state)
      expect((await client.connection.get()).signedIn).toBe(true)
    }
    for (const input of [{ action: "email", owner, email: "person@example.test" }, { action: "code", owner, code: "123456" }, { action: "verify_email", owner, code: "verification-code" }, { action: "mfa", owner, code: "123456" }, { action: "cancel", origin: owner.origin, candidate: owner.revision }, { action: "logout" }] satisfies RemoteAuthInput[]) {
      expect(await client.connection.auth.submit(input)).toEqual(state)
      expect(host.authenticate).toHaveBeenLastCalledWith(CLOUD_URL, input)
    }
    state = { status: "mfa_challenge", signedIn: false, owner, candidate: owner.revision }
    expect((await client.connection.get()).signedIn).toBe(false)
    expect(core.storage.db.prepare("SELECT data FROM doc UNION ALL SELECT data FROM event").all()).toEqual(stored)
  })

  it("validates input before the host; rejects malformed host output without reflecting it", async () => {
    const host = { state: vi.fn(() => signedOut), authenticate: vi.fn(async () => signedOut), clear: vi.fn() }
    core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: host })
    core.connection.set({ mode: "cloud", signedIn: false })
    const app = createServer(core)
    for (const input of [
      { action: "email", owner, email: "private-invalid" },
      { action: "email", owner, email: `${"a".repeat(243)}@example.test` },
      { action: "code", owner, code: "12345" }, { action: "code", owner, code: "123456\n" },
      { action: "local", owner, email: "person@example.test", password: "" },
      { action: "local", owner, email: "person@example.test", password: "p".repeat(4097) },
      { action: "verify_email", owner, code: " " }, { action: "verify_email", owner, code: "v".repeat(129) },
      { action: "mfa", owner, code: "1234567" }, { action: "mfa", owner, code: "abcdef" },
      { action: "private-action" },
      ...["email", "local", "code", "verify_email", "mfa"].flatMap((action) => [
        { action, email: "person@example.test", password: "test", code: "123456" },
        { action, email: "person@example.test", password: "test", code: "123456", owner: null },
        { action, email: "person@example.test", password: "test", code: "123456", owner: { ...owner, revision: "private-invalid" } },
        { action, email: "person@example.test", password: "test", code: "123456", owner: { ...owner, origin: "https://private-user:private-password@example.test" } },
      ]),
      { action: "cancel" }, { action: "cancel", origin: owner.origin, candidate: "private-invalid" },
      { action: "cancel", origin: "https://example.test/path", candidate: owner.revision },
    ]) {
      const response = await app.fetch(request(input))
      expect(response.status).toBe(400)
      expect(await response.text()).not.toContain("private-")
    }
    await expect(core.connection.authenticate({ action: "code", owner, code: "invalid" })).rejects.toThrow()
    expect(host.authenticate).not.toHaveBeenCalled()
    host.authenticate.mockResolvedValueOnce({ status: "signed_in", signedIn: true, owner, email: "private-invalid" })
    const response = await app.fetch(request({ action: "email", owner, email: "person@example.test" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: "invalid_request", message: "Invalid request at email" } })
    host.state.mockReturnValueOnce({ status: "signed_in", signedIn: true, owner, email: "private-invalid" })
    expect(() => core!.connection.auth()).toThrow()
    for (const state of [
      { status: "signed_out", signedIn: false },
      { ...signedOut, owner: { ...owner, revision: "invalid" } },
      { ...localState, candidate: owner.revision },
      { ...localState, status: "code_sent" },
      { ...localState, signedIn: true },
    ]) expect(RemoteAuthState.safeParse(state).success).toBe(false)
  })

  it("never calls the host or network for local or malformed legacy selections", async () => {
    const host = { state: vi.fn(() => signedOut), authenticate: vi.fn(async () => signedOut), clear: vi.fn() }
    const fetchImpl = vi.fn<typeof fetch>()
    core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: host, fetch: fetchImpl })
    for (const selection of [
      { mode: "local", signedIn: true }, { mode: "selfhost", signedIn: true },
      { mode: "selfhost", url: "https://person:private-password@example.test", signedIn: true },
      { mode: "selfhost", url: "not-a-url", signedIn: true },
    ]) {
      core.storage.putDoc("connection", "mode", selection)
      expect(core.connection.auth()).toEqual(localState)
      expect(core.connection.get().signedIn).toBe(false)
      await expect(core.connection.authenticate({ action: "email", owner, email: "person@example.test" })).rejects.toMatchObject({ code: "invalid_request" })
    }
    expect(host.state).not.toHaveBeenCalled()
    expect(host.authenticate).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("refuses sign-in without a host instead of accepting renderer metadata", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), fetch: fetchImpl })
    const app = createServer(core)
    const client = createClient({ baseUrl: "cortex://engine", fetch: (r) => app.fetch(r) })
    expect(await client.connection.auth.get()).toEqual(localState)
    await expect(client.connection.auth.submit({ action: "logout" })).rejects.toMatchObject({ code: "invalid_request" })
    expect((await client.connection.set({ mode: "cloud", signedIn: true })).signedIn).toBe(false)
    expect(await client.connection.auth.get()).toEqual(localState)
    await expect(client.connection.auth.submit({ action: "email", owner, email: "person@example.test" })).rejects.toMatchObject({ code: "provider_unsupported" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("clears only after accepted mode/origin changes, preserves equivalent origins, clears on close", async () => {
    let cancel = () => {}
    const host = {
      state: vi.fn(() => signedOut),
      authenticate: vi.fn(() => new Promise<RemoteAuthState>((_resolve, reject) => { cancel = () => reject(new CortexError("aborted", "Request aborted")) })),
      clear: vi.fn(() => cancel()),
    }
    core = createCore({ dataDir: ":memory:", credentials: memoryCredentials(), remoteAuth: host })
    expect(core.connection.set({ mode: "selfhost", url: "https://API.CORTEX.FOUNDATION:443/", signedIn: true })).toEqual({ mode: "selfhost", url: CLOUD_URL, signedIn: false })
    host.clear.mockClear()
    const pending = expect(core.connection.authenticate({ action: "email", owner, email: "person@example.test" })).rejects.toMatchObject({ code: "aborted" })
    expect(host.authenticate).toHaveBeenLastCalledWith(CLOUD_URL, { action: "email", owner, email: "person@example.test" })
    expect(() => core!.connection.set({ mode: "selfhost", url: "https://other.test/path", signedIn: false })).toThrow()
    const write = vi.spyOn(core.storage, "putDoc").mockImplementationOnce(() => { throw new Error("disk full") })
    expect(() => core!.connection.set({ mode: "selfhost", url: "https://other.test", signedIn: false })).toThrow("disk full")
    expect(core.connection.get()).toEqual({ mode: "selfhost", url: CLOUD_URL, signedIn: false })
    core.connection.set({ mode: "selfhost", url: `${CLOUD_URL}/`, signedIn: false })
    expect(host.clear).not.toHaveBeenCalled()
    core.connection.set({ mode: "cloud", signedIn: false })
    expect(host.clear).toHaveBeenCalledTimes(1)
    expect(host.clear.mock.invocationCallOrder[0]).toBeGreaterThan(write.mock.invocationCallOrder.at(-1)!)
    await pending
    core.connection.set({ mode: "selfhost", url: "http://EXAMPLE.test:80/", signedIn: false })
    expect(core.connection.get().url).toBe("http://example.test")
    expect(host.clear).toHaveBeenCalledTimes(2)
    core.connection.set({ mode: "selfhost", url: "http://other.test", signedIn: false })
    expect(host.clear).toHaveBeenCalledTimes(3)
    await core.close()
    core = undefined
    expect(host.clear).toHaveBeenCalledTimes(4)
  })
})
