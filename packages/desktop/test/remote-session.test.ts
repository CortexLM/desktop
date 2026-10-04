// The real SDK and Node Fetch exercise cookies, bearer adoption and native response bodies.
import http from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CortexError } from "@cortex/core";
import type { RemoteAuthInput } from "@cortex/schema";
import { RemoteSession } from "../src/remote-session";

type Seen = { path: string; method?: string; body: Record<string, unknown>; cookie?: string; authorization?: string };
const seen: Seen[] = [];
const routes = new Map<string, (response: http.ServerResponse, request: Seen) => void>();
const sessions: RemoteSession[] = [];
let server: http.Server; let other: http.Server; let origin = ""; let otherOrigin = ""; let otherHits = 0;
const owner = (session: RemoteSession) => session.state(origin).owner!;
const stamp = { owner: { origin: expect.any(String), revision: expect.any(String) } };
const signedOut = { status: "signed_out", signedIn: false, ...stamp };
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
type Draft = RemoteAuthInput extends infer T ? T extends RemoteAuthInput ? Omit<T, "owner" | "origin" | "candidate"> : never : never;
// Sequential legacy scenarios capture the current owner at submission; race scenarios pass explicit captured stamps.
const submit = (session: RemoteSession, input: Draft, base = origin) => {
  const state = session.state(origin);
  return session.authenticate(base, input.action === "logout" ? input : input.action === "cancel"
    ? { ...input, origin, candidate: state.candidate ?? state.owner!.revision }
    : { ...input, owner: state.owner! });
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
    expect(await submit(session, begin)).toEqual({ status: "code_sent", signedIn: false, email: begin.email, ...stamp, candidate: expect.any(String) });
    expect(await submit(session, code)).toEqual({ status: "signed_in", signedIn: true, email: begin.email, ...stamp });
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
    expect(await submit(session, { action: "logout" })).toEqual(signedOut);
    expect(transport).toHaveBeenCalledTimes(2);
    await submit(session, begin);
    expect(seen[2].cookie).toBeUndefined();
    expect(seen[2].authorization).toBeUndefined();
  });

  it("retains the verified account on failed replacement and retains a rejected code for retry", async () => {
    const session = create();
    const active = { status: "signed_in", signedIn: true, email: local.email, ...stamp };
    expect(await submit(session, local)).toEqual(active);
    routes.set("/v1/auth/local", json({ detail: "test-secret-raw-error" }, 401));
    await expect(submit(session, { ...local, email: begin.email })).rejects.toMatchObject({ code: "provider_auth_failed" });
    expect(session.state(origin)).toEqual(active);
    const pending = await submit(session, begin);
    expect(pending).toEqual({ status: "code_sent", signedIn: true, email: begin.email, ...stamp, candidate: expect.any(String) });
    routes.set("/v1/auth/magic-auth/verify", json({ detail: "test-secret-raw-error" }, 401));
    await expect(session.authenticate(origin, { ...code, owner: pending.owner! })).rejects.toMatchObject({ code: "provider_auth_failed", message: "Sign-in was not accepted" });
    expect(session.state(origin)).toEqual(pending);
    routes.set("/v1/auth/magic-auth/verify", json(sessionBody));
    expect(await session.authenticate(origin, { ...code, owner: pending.owner! })).toEqual({ status: "signed_in", signedIn: true, email: begin.email, ...stamp });
    expect(seen.slice(1).every((request) => !request.authorization && !request.cookie)).toBe(true);
  });

  it("keeps email-verification and MFA challenges private across their typed continuations", async () => {
    const session = create();
    routes.set("/v1/auth/magic-auth/verify", json({ status: "verify_email", email: begin.email, pending_authentication_token: continuation.pending_authentication_token }));
    routes.set("/v1/auth/verify-email", json({ status: "mfa_challenge", ...continuation }));
    routes.set("/v1/auth/mfa/verify", json(sessionBody));
    await submit(session, begin);
    expect(await submit(session, code)).toEqual({ status: "verify_email", signedIn: false, email: begin.email, ...stamp, candidate: expect.any(String) });
    await expect(submit(session, { action: "mfa", code: code.code })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(2);
    expect(await submit(session, { action: "verify_email", code: "test-email-code" })).toEqual({ status: "mfa_challenge", signedIn: false, email: begin.email, ...stamp, candidate: expect.any(String) });
    expect(seen[2].body).toEqual({ code: "test-email-code", pending_authentication_token: continuation.pending_authentication_token });
    expect(await submit(session, { action: "mfa", code: code.code })).toEqual({ status: "signed_in", signedIn: true, email: begin.email, ...stamp });
    expect(seen[3].body).toEqual({ code: code.code, pending_authentication_token: continuation.pending_authentication_token, authentication_challenge_id: continuation.authentication_challenge_id });
    expect(seen.map((request) => request.path)).toEqual(["/v1/auth/magic-auth", "/v1/auth/magic-auth/verify", "/v1/auth/verify-email", "/v1/auth/mfa/verify"]);
  });

  it("reports enrollment without returning or accepting presentation secrets", async () => {
    const session = create();
    routes.set("/v1/auth/magic-auth/verify", json({ status: "mfa_enrollment", ...continuation, qr_code: "test-qr-code", totp_secret: "test-totp-secret" }));
    await submit(session, begin);
    const enrollment = { status: "mfa_enrollment", signedIn: false, email: begin.email, ...stamp, candidate: expect.any(String) };
    expect(await submit(session, code)).toEqual(enrollment);
    expect(session.state(origin)).toEqual(enrollment);
    await expect(submit(session, { action: "mfa", code: code.code })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(2);
    expect(await submit(session, { action: "cancel" })).toEqual(signedOut);
  });

  it("expires local sessions without a request and revokes a live local bearer through the typed logout", async () => {
    const session = create();
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    routes.set("/v1/auth/local", json({ ...sessionBody, token_type: "Bearer", expires_at: new Date(now + 1000).toISOString() }));
    expect(await submit(session, local)).toEqual({ status: "signed_in", signedIn: true, email: local.email, ...stamp });
    const activeOwner = owner(session);
    clock.mockReturnValue(now + 1000);
    expect(session.state(origin)).toEqual(signedOut);
    expect(owner(session)).not.toEqual(activeOwner);
    expect(seen).toHaveLength(1);
    await expect(submit(session, local)).rejects.toMatchObject({ code: "provider_error" });
    expect(session.state(origin)).toEqual(signedOut);
    clock.mockReturnValue(now);
    await submit(session, local);
    expect(await submit(session, { action: "logout" })).toEqual(signedOut);
    expect(seen.at(-1)).toMatchObject({ path: "/v1/auth/local/logout", method: "POST", body: {}, authorization: `Bearer ${sessionBody.access_token}` });
    expect(seen.at(-1)?.cookie).toBeUndefined();
    await submit(session, local);
    routes.set("/v1/auth/local/logout", json({ detail: "test-secret-logout-error" }, 500));
    await expect(submit(session, { action: "logout" })).rejects.toMatchObject({ code: "provider_error" });
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
      await submit(session, local);
      await submit(session, begin);
      const late = submit(session, code).catch((error: unknown) => error);
      await arrived.promise;
      if (action === "origin") expect(session.state(otherOrigin)).toEqual(signedOut);
      else if (action === "clear") session.clear();
      else await submit(session, { action });
      expect(held?.signal.aborted).toBe(true);
      if (action === "cancel") expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: local.email, ...stamp });
      else expect(session.state(action === "origin" ? otherOrigin : origin)).toEqual(signedOut);
      hold = false;
      await submit(session, { ...begin, email: "replacement@example.test" });
      expect(seen.at(-1)?.cookie).toBeUndefined();
      expect(seen.at(-1)?.authorization).toBeUndefined();
      await submit(session, code);
      release.resolve();
      expect(await late).toMatchObject({ code: "invalid_request" });
      expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: "replacement@example.test", ...stamp });
      session.clear();
    }
    expect(otherHits).toBe(0);
  });

  it("rejects duplicate requests and times out an unfinished native authentication body", async () => {
    const session = create();
    await submit(session, local);
    const arrived = deferred();
    let reply!: http.ServerResponse;
    routes.set("/v1/auth/magic-auth", (res) => { reply = res; arrived.resolve(); });
    const sending = submit(session, begin);
    await arrived.promise;
    const count = seen.length;
    await expect(submit(session, begin)).rejects.toMatchObject({ code: "conflict" });
    await expect(submit(session, local)).rejects.toMatchObject({ code: "conflict" });
    expect(seen).toHaveLength(count);
    empty(reply);
    await sending;
    const closed = deferred();
    routes.set("/v1/auth/magic-auth/verify", (res) => {
      res.on("close", closed.resolve);
      res.writeHead(200, { "content-type": "application/json" }); res.write('{"status":"session",');
    });
    const started = performance.now();
    await expect(submit(session, code)).rejects.toMatchObject({ code: "provider_error" });
    await closed.promise;
    expect(performance.now() - started).toBeGreaterThanOrEqual(9000);
    expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: local.email, ...stamp });
  });

  it("rejects malformed origins, redirects, malformed success and raw failures without replacing a verified account", async () => {
    const session = create();
    const active = { status: "signed_in", signedIn: true, email: local.email, ...stamp };
    await submit(session, local);
    for (const url of ["file:///", "ftp://example.test", "not a URL", "https://user:password@example.test", `${origin}/prefix`, `${origin}/?q=1`, `${origin}/#fragment`, `${origin}/?`, `${origin}/#`]) {
      expect(() => session.state(url)).toThrow(CortexError);
      await expect(submit(session, begin, url)).rejects.toMatchObject({ code: "invalid_request" });
    }
    await expect(submit(session, { action: "email", email: "not-an-email" })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(1);
    routes.set("/v1/auth/magic-auth", (res) => { res.writeHead(307, { location: `${otherOrigin}/target` }); res.end(); });
    await expect(submit(session, begin)).rejects.toMatchObject({ code: "provider_error" });
    expect(otherHits).toBe(0);
    routes.set("/v1/auth/magic-auth", (res) => { res.setHeader("set-cookie", "test_pending=test-cookie; HttpOnly; Path=/"); empty(res); });
    await submit(session, begin);
    routes.set("/v1/auth/magic-auth/verify", (res) => { res.writeHead(307, { location: `${otherOrigin}/target` }); res.end(); });
    await expect(submit(session, code)).rejects.toMatchObject({ code: "provider_error" });
    expect(seen.at(-1)?.cookie).toBe("test_pending=test-cookie");
    expect(otherHits).toBe(0);
    expect(await submit(session, { action: "cancel" })).toEqual(active);
    routes.set("/v1/auth/magic-auth", json({ unexpected: true }));
    await expect(submit(session, begin)).rejects.toMatchObject({ code: "provider_error" });
    routes.set("/v1/auth/magic-auth", empty);
    for (const body of [null, {}, { status: "session", access_token: "" }, { status: "session", access_token: "test-token\n" },
      { status: "verify_email", email: "not-an-email", pending_authentication_token: "test-pending" },
      { status: "mfa_challenge", pending_authentication_token: "test-pending" },
      { status: "mfa_enrollment", ...continuation, qr_code: "test-qr" },
      { status: "mfa_challenge", ...continuation, access_token: "test-unverified-token" },
      { status: "session", access_token: "x".repeat(1024 * 1024) },
    ]) {
      await submit(session, begin);
      routes.set("/v1/auth/magic-auth/verify", json(body));
      await expect(submit(session, code)).rejects.toMatchObject({ code: "provider_error" });
      expect(session.state(origin)).toEqual(active);
    }
    for (const fields of [{ expires_at: "not-a-date" }, { expires_at: "2030-02-31T00:00:00.000Z" }, { expires_at: "2030-01-01" }, { expires_at: "2030-01-01T00:00:00.000Z", token_type: "Basic" }]) {
      routes.set("/v1/auth/local", json({ ...sessionBody, token_type: "Bearer", ...fields }));
      await expect(submit(session, local)).rejects.toMatchObject({ code: "provider_error" });
      expect(session.state(origin)).toEqual(active);
    }
    for (const [status, expected] of [[500, "provider_error"], [429, "provider_rate_limited"], [401, "provider_auth_failed"]] as const) {
      routes.set("/v1/auth/magic-auth", json({ type: "about:blank", title: "test-secret-raw-title", detail: "test-secret-raw-detail", status: 401, code: "unauthenticated", request_id: "test-secret-id" }, status));
      const error = await submit(session, begin).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(CortexError);
      expect(error).toMatchObject({ code: expected });
      expect(JSON.stringify(error)).not.toContain("test-secret");
      expect(session.state(origin)).toEqual(active);
    }
    routes.set("/v1/auth/local/logout", (res) => { res.writeHead(307, { location: `${otherOrigin}/target` }); res.end(); });
    await expect(submit(session, { action: "logout" })).rejects.toMatchObject({ code: "provider_error" });
    expect(seen.at(-1)?.authorization).toBe(`Bearer ${sessionBody.access_token}`);
    expect(otherHits).toBe(0);
    expect(session.state(origin)).toEqual(signedOut);
    const broken = create(async () => { throw new Error("test-secret-transport-detail"); });
    await expect(submit(broken, begin)).rejects.toMatchObject({ code: "provider_error", message: "Could not complete sign-in" });
  });

  it("consumes initial cancel before dispatch, during dispatch and after pending acceptance", async () => {
    for (const timing of ["before", "during", "accepted"] as const) {
      const session = create(), start = owner(session), arrived = deferred(), release = deferred();
      const cancel = { action: "cancel" as const, origin, candidate: start.revision };
      const count = seen.length;
      if (timing === "before") {
        await session.authenticate(origin, cancel);
        await expect(session.authenticate(origin, { ...begin, owner: start })).rejects.toMatchObject({ code: "invalid_request" });
        expect(seen).toHaveLength(count);
      } else {
        routes.set("/v1/auth/magic-auth", (res) => { arrived.resolve(); void release.promise.then(() => empty(res)); });
        const sending = session.authenticate(origin, { ...begin, owner: start }).catch((error: unknown) => error);
        await arrived.promise;
        expect(session.state(origin).candidate).toBe(start.revision);
        expect(owner(session)).toEqual(start);
        if (timing === "accepted") { release.resolve(); await sending; expect(owner(session)).not.toEqual(start); }
        await session.authenticate(origin, cancel);
        release.resolve();
        if (timing === "during") expect(await sending).toMatchObject({ code: "invalid_request" });
      }
      expect(session.state(origin)).toEqual(signedOut);
      expect(owner(session)).not.toEqual(start);
      expect(owner(session)).toEqual(owner(session));
      await expect(session.authenticate(origin, cancel)).rejects.toMatchObject({ code: "invalid_request" });
    }
  });

  it("rejects old candidate cancel and stale code/resend while the replacement remains usable", async () => {
    const session = create();
    await submit(session, local);
    const a = await submit(session, begin), arrived = deferred(), release = deferred();
    const start = a.owner!;
    routes.set("/v1/auth/magic-auth", (res) => { arrived.resolve(); void release.promise.then(() => empty(res)); });
    const replacing = session.authenticate(origin, { ...begin, owner: start });
    await arrived.promise;
    const bDispatch = session.state(origin);
    await expect(session.authenticate(origin, { action: "cancel", origin, candidate: a.candidate! })).rejects.toMatchObject({ code: "invalid_request" });
    expect(session.state(origin)).toEqual(bDispatch);
    release.resolve();
    const b = await replacing, count = seen.length;
    for (const input of [code, begin]) await expect(session.authenticate(origin, { ...input, owner: start })).rejects.toMatchObject({ code: "invalid_request" });
    await expect(session.authenticate(origin, { ...code, owner: { ...b.owner!, origin: otherOrigin } })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(count);
    expect(session.state(origin)).toEqual(b);
    await session.authenticate(origin, { action: "cancel", origin, candidate: start.revision });
    expect(session.state(origin)).toEqual({ status: "signed_in", signedIn: true, email: local.email, ...stamp });
    routes.set("/v1/auth/magic-auth", empty);
    const c = await submit(session, begin);
    await session.authenticate(origin, { ...code, owner: c.owner! });
    const promoted = session.state(origin);
    await expect(session.authenticate(origin, { action: "cancel", origin, candidate: c.candidate! })).rejects.toMatchObject({ code: "invalid_request" });
    expect(session.state(origin)).toEqual(promoted);
    await session.authenticate(origin, { action: "logout" });
    expect(session.state(origin)).toEqual(signedOut);
  });

  it("rotates repeated continuation steps and rejects stale verification and MFA before SDK dispatch", async () => {
    const session = create();
    const verify = { status: "verify_email", email: begin.email, pending_authentication_token: continuation.pending_authentication_token };
    routes.set("/v1/auth/magic-auth/verify", json(verify));
    routes.set("/v1/auth/verify-email", json(verify));
    routes.set("/v1/auth/mfa/verify", json(sessionBody));
    await submit(session, begin);
    const a = await submit(session, code);
    const b = await session.authenticate(origin, { action: "verify_email", code: "first", owner: a.owner! });
    expect(b.status).toBe(a.status); expect(b.candidate).toBe(a.candidate); expect(b.owner).not.toEqual(a.owner);
    const count = seen.length;
    await expect(session.authenticate(origin, { action: "verify_email", code: "stale", owner: a.owner! })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(count);
    routes.set("/v1/auth/verify-email", json({ status: "mfa_challenge", ...continuation }));
    const mfaA = await session.authenticate(origin, { action: "verify_email", code: "fresh", owner: b.owner! });
    await submit(session, begin);
    const replacement = await submit(session, code);
    const mfaB = await session.authenticate(origin, { action: "verify_email", code: "replacement", owner: replacement.owner! });
    const before = seen.length;
    await expect(session.authenticate(origin, { action: "mfa", code: code.code, owner: mfaA.owner! })).rejects.toMatchObject({ code: "invalid_request" });
    expect(seen).toHaveLength(before); expect(session.state(origin)).toEqual(mfaB);
    await session.authenticate(origin, { action: "mfa", code: code.code, owner: mfaB.owner! });
    expect(session.state(origin).signedIn).toBe(true);
  });

  it("consumes an unused start stamp without cancelling the existing candidate and invalidates away-back authority", async () => {
    const session = create(), a = await submit(session, begin), start = a.owner!;
    await session.authenticate(origin, { action: "cancel", origin, candidate: start.revision });
    const retained = session.state(origin);
    expect(retained.candidate).toBe(a.candidate); expect(retained.status).toBe("code_sent"); expect(retained.owner).not.toEqual(start);
    await expect(session.authenticate(origin, { ...begin, owner: start })).rejects.toMatchObject({ code: "invalid_request" });
    session.state(otherOrigin); session.state(origin);
    const current = session.state(origin), count = seen.length;
    await expect(session.authenticate(origin, { ...begin, owner: retained.owner! })).rejects.toMatchObject({ code: "invalid_request" });
    await expect(session.authenticate(origin, { action: "cancel", origin, candidate: a.candidate! })).rejects.toMatchObject({ code: "invalid_request" });
    expect(session.state(origin)).toEqual(current); expect(seen).toHaveLength(count);
    await submit(session, begin); await submit(session, code);
    expect(session.state(origin).signedIn).toBe(true);
  });
});
