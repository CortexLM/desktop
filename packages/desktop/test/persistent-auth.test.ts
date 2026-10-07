import { describe, expect, it, vi } from "vitest";
import { memoryCredentials } from "@cortex/core";
import { RemoteSession } from "../src/remote-session";

const origin = "https://native.example.test";
const account = "usr_00000000000000000000000001";
const token = (version: number, exp = Math.floor(Date.now() / 1000) + 3600) => `fixture.${Buffer.from(JSON.stringify({ exp, version })).toString("base64url")}.fixture`;
const pair = (version: number) => ({ access_token: token(version), refresh_token: `fixture-refresh-${version}`, token_type: "Bearer" });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function fixture() {
  let owner = account, version = 0, revoked = false;
  const seen: string[] = [];
  const transport: typeof fetch = vi.fn(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    expect(new URL(request.url).origin).toBe(origin);
    expect(request.redirect).toBe("error");
    expect(request.credentials).toBe("omit");
    const path = new URL(request.url).pathname; seen.push(path);
    if (path === "/v1/auth/device") return json({ device_code: "fixture-private-device", user_code: "TEST-CODE", verification_uri: "https://verify.example.test", verification_uri_complete: "https://verify.example.test/approve", expires_in: 600, interval: 1 });
    if (path === "/v1/auth/device/token") return json(pair(++version));
    if (path === "/v1/me") return revoked ? json({}, 401) : json({ id: owner, email: "native@example.test" });
    if (path === "/v1/auth/refresh") {
      const body = await request.json();
      expect(request.headers.has("Authorization")).toBe(false);
      if (revoked || body.refresh_token !== `fixture-refresh-${version}`) return json({}, 401);
      return json(pair(++version));
    }
    if (path === "/v1/auth/logout") { revoked = true; return new Response(null, { status: 204 }); }
    if (path === "/v1/auth/magic-auth") return new Response(null, { status: 204 });
    if (path === "/v1/auth/magic-auth/verify") { ++version; return new Response(JSON.stringify({ status: "session", access_token: token(version) }), { status: 200, headers: [["Content-Type", "application/json"], ["Set-Cookie", `cortex_rt=fixture-refresh-${version}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`]] }); }
    if (path === "/v1/instance") return json({ mode: "cloud", auth: { mode: "cortex", required: true } });
    if (path === "/v1/models") return json({ items: [], has_more: false });
    return json({}, 404);
  });
  return { transport, seen, changeOwner: () => { owner = "usr_00000000000000000000000002"; }, revoke: () => { revoked = true; } };
}
async function login(session: RemoteSession) {
  const pending = await session.authenticate(origin, { action: "device", owner: session.state(origin).owner! });
  expect(JSON.stringify(pending)).not.toContain("fixture-private-device");
  const real = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(real + 1001);
  try { return await session.authenticate(origin, { action: "device_poll", owner: pending.owner! }); }
  finally { vi.restoreAllMocks(); }
}
describe("persistent main native device authentication", () => {
  it("single-flights expiry rotation and completes logout without storage resurrection", async () => {
    const credentials = memoryCredentials(), f = fixture();
    let held = false;
    const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((yes) => { resolve = yes; }); return { resolve, promise }; };
    const entered = deferred(), released = deferred();
    const transport: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (held && new URL(request.url).pathname === "/v1/auth/refresh") { entered.resolve(); await released.promise; }
      const response = await f.transport(request);
      if (new URL(request.url).pathname === "/v1/auth/refresh" && response.status === 200) {
        const pair = await response.json();
        return json({ ...pair, access_token: token(2, Math.floor(Date.now() / 1000) + 3600) });
      }
      return response;
    };
    const session = new RemoteSession({ credentials, fetch: transport });
    try {
      await login(session);
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3601000);
      held = true;
      const binding = session.bind(origin);
      const first = binding.models().catch(() => undefined), second = binding.models().catch(() => undefined);
      await Promise.race([entered.promise, new Promise<never>((_yes, no) => AbortSignal.timeout(5000).addEventListener("abort", () => no(new Error("Refresh event missing")), { once: true }))]);
      const logout = session.authenticate(origin, { action: "logout" });
      released.resolve();
      await Promise.all([first, second, logout]);
      expect(f.seen.filter((path) => path === "/v1/auth/refresh")).toHaveLength(1);
      expect(credentials.get("remote-session")).toBeUndefined();
      expect(session.state(origin).signedIn).toBe(false);
    } finally { released.resolve(); session.clear(); vi.restoreAllMocks(); }
  });
  it("rotates on restart, verifies stable owner, erases on logout, never restores revoked credentials", async () => {
    const credentials = memoryCredentials(), f = fixture();
    const first = new RemoteSession({ credentials, fetch: f.transport });
    try {
      expect((await login(first)).signedIn).toBe(true);
      expect(first.bind(origin).accountID).toBe(account);
      first.clear();
      const next = new RemoteSession({ credentials, fetch: f.transport });
      try {
        await next.restore(origin);
        expect(next.bind(origin).accountID).toBe(account);
        expect(f.seen.filter((path) => path === "/v1/auth/refresh")).toHaveLength(1);
        await next.authenticate(origin, { action: "logout" });
        expect(credentials.get("remote-session")).toBeUndefined();
        await next.restore(origin);
        expect(next.state(origin).signedIn).toBe(false);
      } finally { next.clear(); }
    } finally { first.clear(); }
  });
  it("persists email-code sign-in as a durable account-bound pair that survives restart", async () => {
    const credentials = memoryCredentials(), f = fixture();
    const first = new RemoteSession({ credentials, fetch: f.transport });
    try {
      const sent = await first.authenticate(origin, { action: "email", owner: first.state(origin).owner!, email: "native@example.test" });
      expect((await first.authenticate(origin, { action: "code", owner: sent.owner!, code: "424242" })).signedIn).toBe(true);
      expect(first.bind(origin).accountID).toBe(account);
      const stored = JSON.parse(credentials.get("remote-session")!);
      expect(stored.accountID).toBe(account);
      expect(JSON.stringify(first.state(origin))).not.toContain("fixture-refresh");
      first.clear();
      const next = new RemoteSession({ credentials, fetch: f.transport });
      try {
        await next.restore(origin);
        expect(next.state(origin).signedIn).toBe(true);
        expect(next.bind(origin).accountID).toBe(account);
        expect(next.bindCode(origin).accountID).toBe(account);
      } finally { next.clear(); }
    } finally { first.clear(); }
  });
  it("refuses owner changes after rotation and clears revoked storage without new device login", async () => {
    for (const refusal of ["owner", "revoked"]) {
      const credentials = memoryCredentials(), f = fixture();
      const first = new RemoteSession({ credentials, fetch: f.transport });
      await login(first); first.clear();
      if (refusal === "owner") f.changeOwner(); else f.revoke();
      const next = new RemoteSession({ credentials, fetch: f.transport });
      try {
        await next.restore(origin);
        expect(next.state(origin).signedIn).toBe(false);
        expect(credentials.get("remote-session")).toBeUndefined();
        expect(f.seen.filter((path) => path === "/v1/auth/device")).toHaveLength(1);
      } finally { next.clear(); }
    }
  });
  it("does not send credentials to another selected origin", async () => {
    const credentials = memoryCredentials(), f = fixture();
    const first = new RemoteSession({ credentials, fetch: f.transport });
    await login(first); first.clear();
    const next = new RemoteSession({ credentials, fetch: f.transport });
    try {
      const count = f.seen.length;
      await next.restore("https://other.example.test");
      expect(next.state("https://other.example.test").signedIn).toBe(false);
      expect(f.seen).toHaveLength(count);
    } finally { next.clear(); }
  });
});
