// Regression (Task15 E2E): Code routes failed with 500 after email-code sign-in because only device sign-in built the Code binding.
import { describe, expect, it, vi } from "vitest";
import { memoryCredentials } from "@cortex/core";
import { RemoteSession } from "../src/remote-session";

const origin = "https://code.example.test";
const account = "usr_00000000000000000000000001";
const access = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

function producer() {
  const seen: string[] = [];
  const transport: typeof fetch = vi.fn(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const path = new URL(request.url).pathname; seen.push(`${request.method} ${path}`);
    if (path === "/v1/auth/magic-auth") return new Response(null, { status: 204 });
    if (path === "/v1/auth/magic-auth/verify") return json({ status: "session", access_token: access });
    if (path === "/v1/auth/device") return json({ device_code: "fixture-device", user_code: "TEST-CODE", verification_uri: "https://verify.example.test", verification_uri_complete: "https://verify.example.test/approve", expires_in: 600, interval: 1 });
    if (path === "/v1/auth/device/token") return json({ access_token: access, refresh_token: "fixture-refresh", token_type: "Bearer" });
    if (path === "/v1/me") return json({ id: account, email: "member@example.test" });
    if (path === "/v1/code/sessions") return json({ items: [], has_more: false });
    return json({}, 404);
  });
  return { transport, seen };
}

const signIn = {
  async email(session: RemoteSession) {
    await session.authenticate(origin, { action: "email", email: "member@example.test", owner: session.state(origin).owner! });
    return session.authenticate(origin, { action: "code", code: "123456", owner: session.state(origin).owner! });
  },
  async device(session: RemoteSession) {
    const pending = await session.authenticate(origin, { action: "device", owner: session.state(origin).owner! });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1001);
    try { return await session.authenticate(origin, { action: "device_poll", owner: pending.owner! }); }
    finally { vi.restoreAllMocks(); }
  },
};

describe("Code binding after sign-in", () => {
  for (const method of ["email", "device"] as const) {
    it(`reaches the producer Code API after ${method} sign-in`, async () => {
      const f = producer();
      const session = new RemoteSession({ credentials: memoryCredentials(), fetch: f.transport });
      try {
        expect((await signIn[method](session)).signedIn).toBe(true);
        const code = session.bindCode(origin);
        expect(code.epoch).toBe(session.bind(origin).epoch);
        await expect(code.list()).resolves.toEqual([]);
        expect(f.seen).toContain("GET /v1/code/sessions");
      } finally { session.clear(); }
    });
  }
  it("refuses Code before sign-in without a producer request", () => {
    const f = producer();
    const session = new RemoteSession({ credentials: memoryCredentials(), fetch: f.transport });
    session.state(origin);
    expect(() => session.bindCode(origin)).toThrow("Remote sign-in is required");
    expect(f.seen).toEqual([]);
  });
});
