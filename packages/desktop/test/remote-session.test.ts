// The real SDK and Node Fetch exercise cookies, bearer adoption and native response bodies.
import http from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CortexError } from "@cortex/core";
import { RemoteSession } from "../src/remote-session";

type Seen = { path: string; method?: string; body: Record<string, unknown>; cookie?: string; authorization?: string };
const seen: Seen[] = [];
const routes = new Map<string, (response: http.ServerResponse, request: Seen) => void>();
const sessions: RemoteSession[] = [];
let server: http.Server; let other: http.Server; let origin = ""; let otherOrigin = ""; let otherHits = 0;
const signedOut = { status: "signed_out", signedIn: false };
const local = { action: "local" as const, email: "operator@example.test", password: "test-local-password" };
const begin = { action: "email" as const, email: "member@example.test" };
const code = { action: "code" as const, code: "123456" };
const sessionBody = { status: "session", access_token: "test-access-token" };
const continuation = { pending_authentication_token: "test-pending-token", authentication_challenge_id: "test-challenge-id", authentication_factor_id: "test-factor-id" };
const json = (body: unknown, status = 200, cookie?: string) => (res: http.ServerResponse) => {
  res.writeHead(status, { "content-type": "application/json", ...(cookie ? { "set-cookie": cookie } : {}) });
  res.end(JSON.stringify(body));
};
const empty = (res: http.ServerResponse) => { res.writeHead(204); res.end(); };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const create = (transport?: typeof fetch) => {
  const session = new RemoteSession({ fetch: transport });
  sessions.push(session);
  return session;
};
const listen = async (target: http.Server) => {
  await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(target.address() as { port: number }).port}`;
};
beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const request: Seen = {
      path: req.url!, method: req.method, body: body ? JSON.parse(body) : {},
      cookie: req.headers.cookie, authorization: req.headers.authorization,
    };
    seen.push(request);
    const reply = routes.get(request.path);
    if (reply) reply(res, request);
    else { res.writeHead(404); res.end(); }
  });
  other = http.createServer((_req, res) => { otherHits++; empty(res); });
  [origin, otherOrigin] = await Promise.all([listen(server), listen(other)]);
});
beforeEach(() => {
  seen.length = 0;
  otherHits = 0;
  routes.clear();
  routes.set("/v1/auth/magic-auth", empty);
  routes.set("/v1/auth/magic-auth/verify", json(sessionBody, 200, "test_refresh=test-refresh-cookie; HttpOnly; Path=/"));
  routes.set("/v1/auth/local", json({ ...sessionBody, token_type: "Bearer", expires_at: new Date(Date.now() + 60000).toISOString() }));
  routes.set("/v1/auth/local/logout", empty);
});
afterEach(() => {
  for (const session of sessions.splice(0)) session.clear();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await Promise.all([server, other].map((target) => new Promise<void>((resolve, reject) => {
    target.closeAllConnections();
    target.close((error) => error ? reject(error) : resolve());
  })));
});

describe("process-lifetime remote authentication", () => {
  it("pins requests, keeps SDK cookies private and establishes sign-in only after a verified code", async () => {
    const transport = vi.fn<typeof fetch>(async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      expect(new URL(request.url).origin).toBe(origin);
      expect(request.redirect).toBe("error");
      expect(request.credentials).toBe("omit");
      expect(request.signal.aborted).toBe(false);
      return fetch(request);
    });
    const session = create(transport);
    expect(session.state(`${origin}/`)).toEqual(signedOut);
    expect(transport).not.toHaveBeenCalled();
    routes.set("/v1/auth/magic-auth", (res) => { res.setHeader("set-cookie", "test_pending=test-cookie; HttpOnly; Path=/"); empty(res); });
    expect(await session.authenticate(origin, begin)).toEqual({ status: "code_sent", signedIn: false, email: begin.email });
    expect(await session.authenticate(origin, code)).toEqual({ status: "signed_in", signedIn: true, email: begin.email });
    expect(seen.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: "POST", path: "/v1/auth/magic-auth", body: { email: begin.email } },
      { method: "POST", path: "/v1/auth/magic-auth/verify", body: { email: begin.email, code: code.code } },
    ]);
    expect(seen[1].cookie).toBe("test_pending=test-cookie");
    expect(seen.every((request) => !request.authorization)).toBe(true);
    const snapshot = session.state(origin);
    snapshot.email = "changed@example.test";
    expect(session.state(origin).email).toBe(begin.email);
    expect(Object.keys(session)).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(await session.authenticate(origin, { action: "logout" })).toEqual(signedOut);
    expect(transport).toHaveBeenCalledTimes(2);
    await session.authenticate(origin, begin);
    expect(seen[2].cookie).toBeUndefined();
    expect(seen[2].authorization).toBeUndefined();
  });

  it("retains the verified account on failed replacement and retains a rejected code for retry", async () => {
    const session = create();
    const active = { status: "signed_in", signedIn: true, email: local.email };
    expect(await session.authenticate(origin, local)).toEqual(active);
    routes.set("/v1/auth/local", json({ detail: "test-secret-raw-error" }, 401));
    await expect(session.authenticate(origin, { ...local, email: begin.email })).rejects.toMatchObject({ code: "provider_auth_failed" });
    expect(session.state(origin)).toEqual(active);
    const pending = { status: "code_sent", signedIn: true, email: begin.email };
    expect(await session.authenticate(origin, begin)).toEqual(pending);
    routes.set("/v1/auth/magic-auth/verify", json({ detail: "test-secret-raw-error" }, 401));
    await expect(session.authenticate(origin, code)).rejects.toMatchObject({ code: "provider_auth_failed", message: "Sign-in was not accepted" });
    expect(session.state(origin)).toEqual(pending);
    routes.set("/v1/auth/magic-auth/verify", json(sessionBody));
    expect(await session.authenticate(origin, code)).toEqual({ status: "signed_in", signedIn: true, email: begin.email });
    expect(seen.slice(1).every((request) => !request.authorization && !request.cookie)).toBe(true);
  });

  it("keeps email-verification and MFA challenges private across their typed continuations", async () => {
    const session = create();
    routes.set("/v1/auth/magic-auth/verify", json({ status: "verify_email", email: begin.email, pending_authentication_token: continuation.pending_authentication_token }));
    routes.set("/v1/auth/verify-email", json({ status: "mfa_challenge", ...continuation }));
    routes.set("/v1/auth/mfa/verify", json(sessionBody));
    await session.authenticate(origin, begin);
    expect(await session.authenticate(origin, code)).toEqual({ status: "verify_email", signedIn: false, email: begin.email });
    await expect(session.authenticate(origin, { action: "mfa", code: code.code })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(2);
    expect(await session.authenticate(origin, { action: "verify_email", code: "test-email-code" })).toEqual({ status: "mfa_challenge", signedIn: false, email: begin.email });
    expect(seen[2].body).toEqual({ code: "test-email-code", pending_authentication_token: continuation.pending_authentication_token });
    expect(await session.authenticate(origin, { action: "mfa", code: code.code })).toEqual({ status: "signed_in", signedIn: true, email: begin.email });
    expect(seen[3].body).toEqual({ code: code.code, pending_authentication_token: continuation.pending_authentication_token, authentication_challenge_id: continuation.authentication_challenge_id });
    expect(seen.map((request) => request.path)).toEqual(["/v1/auth/magic-auth", "/v1/auth/magic-auth/verify", "/v1/auth/verify-email", "/v1/auth/mfa/verify"]);
  });

  it("reports enrollment without returning or accepting presentation secrets", async () => {
    const session = create();
    routes.set("/v1/auth/magic-auth/verify", json({ status: "mfa_enrollment", ...continuation, qr_code: "test-qr-code", totp_secret: "test-totp-secret" }));
    await session.authenticate(origin, begin);
    const enrollment = { status: "mfa_enrollment", signedIn: false, email: begin.email };
    expect(await session.authenticate(origin, code)).toEqual(enrollment);
    expect(session.state(origin)).toEqual(enrollment);
    await expect(session.authenticate(origin, { action: "mfa", code: code.code })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(2);
    expect(await session.authenticate(origin, { action: "cancel" })).toEqual(signedOut);
  });

  it("expires local sessions without a request and revokes a live local bearer through the typed logout", async () => {
    const session = create();
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    routes.set("/v1/auth/local", json({ ...sessionBody, token_type: "Bearer", expires_at: new Date(now + 1000).toISOString() }));
    expect(await session.authenticate(origin, local)).toEqual({ status: "signed_in", signedIn: true, email: local.email });
    clock.mockReturnValue(now + 1000);
    expect(session.state(origin)).toEqual(signedOut);
    expect(seen).toHaveLength(1);
    await expect(session.authenticate(origin, local)).rejects.toMatchObject({ code: "provider_error" });
    expect(session.state(origin)).toEqual(signedOut);
    clock.mockReturnValue(now);
    await session.authenticate(origin, local);
    expect(await session.authenticate(origin, { action: "logout" })).toEqual(signedOut);
    expect(seen.at(-1)).toMatchObject({ path: "/v1/auth/local/logout", method: "POST", body: {}, authorization: `Bearer ${sessionBody.access_token}` });
    expect(seen.at(-1)?.cookie).toBeUndefined();
    await session.authenticate(origin, local);
    routes.set("/v1/auth/local/logout", json({ detail: "test-secret-logout-error" }, 500));
    await expect(session.authenticate(origin, { action: "logout" })).rejects.toMatchObject({ code: "provider_error" });
    expect(session.state(origin)).toEqual(signedOut);
  });

  it("aborts held native replies on cancel, logout, origin replacement and clear without late identity or cookie commits", async () => {
    for (const action of ["cancel", "logout", "origin", "clear"] as const) {
      const arrived = deferred(); const release = deferred();
      let held: Request | undefined;
      let hold = true;
      const session = create(async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        const response = await fetch(request);
        if (hold && request.url.endsWith("/magic-auth/verify")) {
          // Hold fully received native bytes; deliberately ignore abort while the account changes.
          const detached = new Response(await response.arrayBuffer(), response);
          held = request; arrived.resolve();
          await release.promise;
          return detached;
        }
        return response;
      });
      await session.authenticate(origin, local);
      await session.authenticate(origin, begin);
      const late = session.authenticate(origin, code).catch((error: unknown) => error);
      await arrived.promise;
      if (action === "origin") expect(session.state(otherOrigin)).toEqual(signedOut);
      else if (action === "clear") session.clear();
      else await session.authenticate(origin, { action });
      expect(held?.signal.aborted).toBe(true);
      if (action === "cancel") expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: local.email });
      else expect(session.state(action === "origin" ? otherOrigin : origin)).toEqual(signedOut);
      hold = false;
      await session.authenticate(origin, { ...begin, email: "replacement@example.test" });
      expect(seen.at(-1)?.cookie).toBeUndefined();
      expect(seen.at(-1)?.authorization).toBeUndefined();
      await session.authenticate(origin, code);
      release.resolve();
      expect(await late).toMatchObject({ code: "invalid_request" });
      expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: "replacement@example.test" });
      session.clear();
    }
    expect(otherHits).toBe(0);
  });

  it("rejects duplicate requests and times out an unfinished native authentication body", async () => {
    const session = create();
    await session.authenticate(origin, local);
    const arrived = deferred();
    let reply!: http.ServerResponse;
    routes.set("/v1/auth/magic-auth", (res) => { reply = res; arrived.resolve(); });
    const sending = session.authenticate(origin, begin);
    await arrived.promise;
    const count = seen.length;
    await expect(session.authenticate(origin, begin)).rejects.toMatchObject({ code: "conflict" });
    await expect(session.authenticate(origin, local)).rejects.toMatchObject({ code: "conflict" });
    expect(seen).toHaveLength(count);
    empty(reply);
    await sending;
    const closed = deferred();
    routes.set("/v1/auth/magic-auth/verify", (res) => {
      res.on("close", closed.resolve);
      res.writeHead(200, { "content-type": "application/json" }); res.write('{"status":"session",');
    });
    const started = performance.now();
    await expect(session.authenticate(origin, code)).rejects.toMatchObject({ code: "provider_error" });
    await closed.promise;
    expect(performance.now() - started).toBeGreaterThanOrEqual(9000);
    expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: local.email });
  });

  it("rejects malformed origins, redirects, malformed success and raw failures without replacing a verified account", async () => {
    const session = create();
    const active = { status: "signed_in", signedIn: true, email: local.email };
    await session.authenticate(origin, local);
    for (const url of ["file:///", "ftp://example.test", "not a URL", "https://user:password@example.test", `${origin}/prefix`, `${origin}/?q=1`, `${origin}/#fragment`, `${origin}/?`, `${origin}/#`]) {
      expect(() => session.state(url)).toThrow(CortexError);
      await expect(session.authenticate(url, begin)).rejects.toMatchObject({ code: "invalid_request" });
    }
    await expect(session.authenticate(origin, { action: "email", email: "not-an-email" })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(1);
    routes.set("/v1/auth/magic-auth", (res) => { res.writeHead(307, { location: `${otherOrigin}/target` }); res.end(); });
    await expect(session.authenticate(origin, begin)).rejects.toMatchObject({ code: "provider_error" });
    expect(otherHits).toBe(0);
    routes.set("/v1/auth/magic-auth", (res) => { res.setHeader("set-cookie", "test_pending=test-cookie; HttpOnly; Path=/"); empty(res); });
    await session.authenticate(origin, begin);
    routes.set("/v1/auth/magic-auth/verify", (res) => { res.writeHead(307, { location: `${otherOrigin}/target` }); res.end(); });
    await expect(session.authenticate(origin, code)).rejects.toMatchObject({ code: "provider_error" });
    expect(seen.at(-1)?.cookie).toBe("test_pending=test-cookie");
    expect(otherHits).toBe(0);
    expect(await session.authenticate(origin, { action: "cancel" })).toEqual(active);
    routes.set("/v1/auth/magic-auth", json({ unexpected: true }));
    await expect(session.authenticate(origin, begin)).rejects.toMatchObject({ code: "provider_error" });
    routes.set("/v1/auth/magic-auth", empty);
    for (const body of [null, {}, { status: "session", access_token: "" }, { status: "session", access_token: "test-token\n" },
      { status: "verify_email", email: "not-an-email", pending_authentication_token: "test-pending" },
      { status: "mfa_challenge", pending_authentication_token: "test-pending" },
      { status: "mfa_enrollment", ...continuation, qr_code: "test-qr" },
      { status: "mfa_challenge", ...continuation, access_token: "test-unverified-token" },
      { status: "session", access_token: "x".repeat(1024 * 1024) },
    ]) {
      await session.authenticate(origin, begin);
      routes.set("/v1/auth/magic-auth/verify", json(body));
      await expect(session.authenticate(origin, code)).rejects.toMatchObject({ code: "provider_error" });
      expect(session.state(origin)).toEqual(active);
    }
    for (const fields of [{ expires_at: "not-a-date" }, { expires_at: "2030-02-31T00:00:00.000Z" }, { expires_at: "2030-01-01" }, { expires_at: "2030-01-01T00:00:00.000Z", token_type: "Basic" }]) {
      routes.set("/v1/auth/local", json({ ...sessionBody, token_type: "Bearer", ...fields }));
      await expect(session.authenticate(origin, local)).rejects.toMatchObject({ code: "provider_error" });
      expect(session.state(origin)).toEqual(active);
    }
    for (const [status, expected] of [[500, "provider_error"], [429, "provider_rate_limited"], [401, "provider_auth_failed"]] as const) {
      routes.set("/v1/auth/magic-auth", json({ type: "about:blank", title: "test-secret-raw-title", detail: "test-secret-raw-detail", status: 401, code: "unauthenticated", request_id: "test-secret-id" }, status));
      const error = await session.authenticate(origin, begin).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(CortexError);
      expect(error).toMatchObject({ code: expected });
      expect(JSON.stringify(error)).not.toContain("test-secret");
      expect(session.state(origin)).toEqual(active);
    }
    routes.set("/v1/auth/local/logout", (res) => { res.writeHead(307, { location: `${otherOrigin}/target` }); res.end(); });
    await expect(session.authenticate(origin, { action: "logout" })).rejects.toMatchObject({ code: "provider_error" });
    expect(seen.at(-1)?.authorization).toBe(`Bearer ${sessionBody.access_token}`);
    expect(otherHits).toBe(0);
    expect(session.state(origin)).toEqual(signedOut);
    const broken = create(async () => { throw new Error("test-secret-transport-detail"); });
    await expect(broken.authenticate(origin, begin)).rejects.toMatchObject({ code: "provider_error", message: "Could not complete sign-in" });
  });
});
