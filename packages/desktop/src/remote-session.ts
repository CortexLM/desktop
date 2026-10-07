// Main-only authentication. Native device pairs persist encrypted; SDK cookies and continuations stay private.
import { createCortexClient, type CortexClient } from "@cortex/sdk";
import { ConnectionUrl, RemoteAuthInput, type RemoteAuthState } from "@cortex/schema";
import { z } from "zod";
import { CortexError, type Credentials } from "@cortex/core";
import { isId } from "@cortex/api-types";
import { createRemoteChatBinding, remoteChatFetch, type MainRemoteChatBinding } from "./remote-chat";
import { createRemoteCodeBinding } from "./remote-code";
import type { CodeBinding } from "@cortex/core";
import type { WorkBotBinding } from "@cortex/core";
import { createRemoteWorkBotBinding, workBotFetch } from "./remote-work-bot";
import { contractFetch } from "./remote-contracts";

const Secret = z.string().min(1).refine((value) => !/\s/.test(value));
const Session = z.object({ status: z.literal("session"), access_token: Secret.regex(/^[A-Za-z0-9._~+/-]+=*$/) }).strict();
const VerifyEmail = z.object({
  status: z.literal("verify_email"), email: z.string().email().max(254), pending_authentication_token: Secret,
}).strict();
const Challenge = z.object({
  status: z.literal("mfa_challenge"), pending_authentication_token: Secret,
  authentication_challenge_id: Secret, authentication_factor_id: Secret,
}).strict();
const Enrollment = Challenge.extend({
  status: z.literal("mfa_enrollment"), qr_code: z.string().min(1), totp_secret: Secret,
});
const Interactive = z.discriminatedUnion("status", [Session, VerifyEmail, Challenge, Enrollment]);
const LocalSession = Session.extend({ token_type: z.literal("Bearer"), expires_at: z.iso.datetime() });
const Empty = z.void();
const SessionCompletions = new Set(["/v1/auth/magic-auth/verify", "/v1/auth/verify-email", "/v1/auth/mfa/verify"]);
const NativeSession = z.object({ access_token: Secret, refresh_token: Secret, token_type: z.literal("Bearer") }).strict();
const Account = z.object({ id: z.string().refine((id) => isId("usr", id)), email: z.string().email() });
const Saved = NativeSession.extend({ origin: ConnectionUrl, accountID: Account.shape.id });
const Device = z.object({ device_code: Secret, user_code: z.string().min(1), verification_uri: z.string().url(), verification_uri_complete: z.string().url(), expires_in: z.number().int().positive(), interval: z.number().int().positive() });

type Pending =
  | { status: "device_pending"; code: string; userCode: string; verificationURL: string; expiresAt: number; nextPoll: number; interval: number }
  | { status: "code_sent" }
  | { status: "verify_email"; token: string }
  | { status: "mfa_challenge" | "mfa_enrollment"; token: string; challengeID: string };
type Identity = {
  id: string;
  client: CortexClient;
  lifetime: AbortController;
  email: string;
  token?: string;
  refreshToken?: string;
  accountID?: string;
  refreshing?: Promise<void>;
  expiresAt?: number;
  pending?: Pending;
  responseStatus: number;
  chat?: MainRemoteChatBinding;
  code?: CodeBinding;
  workBot?: WorkBotBinding;
  chatLifetime?: AbortController;
  expiry?: ReturnType<typeof setTimeout>;
};

const failure = (identity: Identity) => {
  if (identity.lifetime.signal.aborted) return new CortexError("invalid_request", "Sign-in was cancelled");
  if ([400, 401, 403, 422].includes(identity.responseStatus)) return new CortexError("provider_auth_failed", "Sign-in was not accepted");
  if (identity.responseStatus === 429) return new CortexError("provider_rate_limited", "Too many sign-in attempts");
  return new CortexError("provider_error", "Could not complete sign-in");
};

// JWT exp schedules rotation only; authenticated /me establishes account authority.
export class RemoteSession {
  #origin?: string;
  #revision: string = crypto.randomUUID();
  #active?: Identity;
  #candidate?: Identity;
  #busy?: Identity;
  #fetch: typeof fetch;

  #credentials?: Credentials;
  #openExternal?: (url: string) => Promise<void>;
  #writes: Promise<void> = Promise.resolve();
  constructor(options: { fetch?: typeof fetch; credentials?: Credentials; openExternal?: (url: string) => Promise<void> } = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#credentials = options.credentials;
    this.#openExternal = options.openExternal;
  }

  #store(value?: z.infer<typeof Saved>, identity?: Identity): Promise<void> {
    const write = this.#writes.then(() => {
      identity?.lifetime.signal.throwIfAborted();
      return value ? this.#credentials?.set("remote-session", JSON.stringify(value)) : this.#credentials?.delete("remote-session");
    });
    this.#writes = write.catch(() => undefined);
    return write;
  }

  async #native(identity: Identity, origin: string, path: "/v1/auth/device" | "/v1/auth/device/token" | "/v1/auth/refresh" | "/v1/auth/logout" | "/v1/me", body?: unknown, operation?: AbortSignal): Promise<Response> {
    const signal = AbortSignal.any([identity.lifetime.signal, AbortSignal.timeout(10000), ...(operation ? [operation] : [])]);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let abort!: () => void;
    const cancelled = new Promise<never>((_yes, no) => {
      abort = () => { void reader?.cancel().catch(() => undefined); no(new Error("Native authentication cancelled")); };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    try {
      return await Promise.race([cancelled, (async () => {
        const response = await this.#fetch(new Request(`${origin}${path}`, {
          method: path === "/v1/me" || path.startsWith("/v1/conversations?") ? "GET" : "POST", redirect: "error", credentials: "omit", signal,
          headers: { "Content-Type": "application/json", ...(identity.token && (path === "/v1/me" || path === "/v1/auth/logout" || path.startsWith("/v1/conversations?")) ? { Authorization: `Bearer ${identity.token}` } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }));
        identity.responseStatus = response.status;
        if (response.redirected || (response.url && new URL(response.url).origin !== origin)) throw new Error("Native authentication refused");
        reader = response.body?.getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        while (reader) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 1024 * 1024) throw new Error("Invalid native authentication response");
          chunks.push(chunk.value);
        }
        signal.throwIfAborted();
        return new Response(response.status === 204 ? null : Buffer.concat(chunks), { status: response.status, headers: response.headers });
      })()]);
    } finally { signal.removeEventListener("abort", abort); void reader?.cancel().catch(() => undefined); }
  }

  async #pair(identity: Identity, origin: string, value: unknown): Promise<void> {
    const pair = NativeSession.parse(value);
    const exp: unknown = JSON.parse(Buffer.from(pair.access_token.split(".")[1] ?? "", "base64url").toString()).exp;
    if (typeof exp !== "number" || !Number.isSafeInteger(exp) || exp * 1000 <= Date.now()) throw new Error("Invalid access expiry");
    const probe = this.#create(origin, "", crypto.randomUUID());
    const cancel = () => probe.lifetime.abort();
    identity.lifetime.signal.addEventListener("abort", cancel, { once: true });
    probe.token = pair.access_token;
    try {
      const response = await this.#native(probe, origin, "/v1/me");
      if (response.status !== 200) throw new Error("Native identity refused");
      const account = Account.parse(await response.json());
      identity.lifetime.signal.throwIfAborted();
      if (this.#origin !== origin || (identity.accountID && identity.accountID !== account.id)) throw new Error("Native identity changed");
      await this.#store({ ...pair, origin, accountID: account.id }, identity);
      identity.lifetime.signal.throwIfAborted();
      identity.token = pair.access_token; identity.refreshToken = pair.refresh_token;
      identity.accountID = account.id; identity.email = account.email; identity.expiresAt = exp * 1000;
    } finally { identity.lifetime.signal.removeEventListener("abort", cancel); probe.lifetime.abort(); }
  }

  async #refresh(identity: Identity, origin: string): Promise<void> {
    if (identity.refreshing) return identity.refreshing;
    identity.refreshing = (async () => {
      // Network errors, timeouts, 429 and 5xx keep the saved pair for a later retry; every other failure revokes it.
      let transient = false;
      try {
        const response = await this.#native(identity, origin, "/v1/auth/refresh", { refresh_token: identity.refreshToken }).catch((error: unknown) => { transient = true; throw error; });
        if (response.status === 429 || response.status >= 500) { transient = true; throw new Error("Native refresh unavailable"); }
        if (response.status !== 200) throw new Error("Native refresh refused");
        await this.#pair(identity, origin, await response.json());
        clearTimeout(identity.expiry);
        this.#watchExpiry(identity);
      } catch {
        const owned = this.#active === identity || this.#candidate === identity;
        this.#invalidate(identity);
        if (owned && !transient) await this.#store();
        throw transient ? new CortexError("provider_error", "Remote sign-in is temporarily unavailable") : new CortexError("provider_auth_failed", "Remote sign-in is required");
      } finally { identity.refreshing = undefined; }
    })();
    return identity.refreshing;
  }

  #promote(identity: Identity): void {
    this.#active?.lifetime.abort();
    this.#active = identity; this.#candidate = undefined; identity.pending = undefined;
    identity.chatLifetime = new AbortController();
    identity.chat = createRemoteChatBinding(identity.client, this.#origin!, crypto.randomUUID(),
      AbortSignal.any([identity.lifetime.signal, identity.chatLifetime.signal]), () => this.#checkActive(identity), identity.accountID);
    const code = createRemoteCodeBinding(identity.client, identity.chat, () => this.#checkActive(identity));
    identity.code = { ...code, contract: (call) => contractFetch(call, {
      origin: this.#origin!, signal: identity.chat!.signal, check: () => this.#checkActive(identity),
      unauthorized: () => { this.#invalidate(identity); void this.#store().catch(() => undefined); },
      fetch: async (input: RequestInfo | URL) => {
        const request = new Request(input);
        if (identity.refreshToken && identity.expiresAt! <= Date.now()) await this.#refresh(identity, this.#origin!);
        const headers = new Headers(request.headers); headers.set("Authorization", `Bearer ${identity.token}`);
        return this.#fetch(new Request(request, { headers }));
      },
    }) };
    this.#watchExpiry(identity);
  }

  async restore(origin: string): Promise<void> {
    this.state(origin);
    const selected = this.#origin!;
    const candidate = this.#create(selected, "", crypto.randomUUID());
    this.#candidate = candidate;
    try {
      const raw = await this.#credentials?.get("remote-session");
      if (!raw) { this.#cancelCandidate(); return; }
      const saved = Saved.parse(JSON.parse(raw));
      if (saved.origin !== selected) { this.#cancelCandidate(); return; }
      candidate.accountID = saved.accountID; candidate.refreshToken = saved.refresh_token;
      await this.#refresh(candidate, selected);
      candidate.lifetime.signal.throwIfAborted();
      if (this.#candidate !== candidate) throw new Error("Native identity changed");
      this.#promote(candidate);
      this.#revision = crypto.randomUUID();
    } catch (error) {
      // A transient refresh failure keeps the saved pair so the next restore can retry.
      if (this.#candidate === candidate) { this.#cancelCandidate(); if (!(error instanceof CortexError && error.code === "provider_error")) await this.#store(); }
    }
  }

  bind(origin: string): MainRemoteChatBinding {
    const parsed = ConnectionUrl.safeParse(origin);
    if (!parsed.success) throw new CortexError("invalid_request", "Invalid connection origin");
    if (new URL(parsed.data).origin !== this.#origin || !this.#active) throw new CortexError("provider_auth_failed", "Remote sign-in is required");
    this.#checkActive(this.#active);
    return this.#active.chat!;
  }

  bindCode(origin: string): CodeBinding {
    this.bind(origin);
    return this.#active!.code!;
  }

  bindWorkBot(origin: string): WorkBotBinding {
    const chat = this.bind(origin), identity = this.#active!;
    return identity.workBot ??= createRemoteWorkBotBinding(identity.client, chat, () => this.#checkActive(identity), this.#openExternal);
  }

  /** Bearer for the active identity's Bot call (refreshed when due) and the lifetime that ends it on logout/switch. */
  async callAuth(origin: string): Promise<{ token: string; signal: AbortSignal }> {
    const identity = this.#active;
    if (!identity || this.#origin !== origin) throw new CortexError("provider_auth_failed", "Remote sign-in is required");
    this.#checkActive(identity);
    if (identity.refreshToken && identity.expiresAt! <= Date.now()) await this.#refresh(identity, origin);
    this.#checkActive(identity);
    if (!identity.token) throw new CortexError("provider_auth_failed", "Remote sign-in is required");
    return { token: identity.token, signal: identity.lifetime.signal };
  }

  #checkActive(identity: Identity): void {
    if (!identity.refreshToken && identity.expiresAt !== undefined && identity.expiresAt <= Date.now()) this.#invalidate(identity);
    if (identity.lifetime.signal.aborted) {
      const reason: unknown = identity.lifetime.signal.reason;
      throw reason instanceof CortexError ? reason : new CortexError("aborted", "Remote account changed");
    }
    if (this.#active !== identity) throw new CortexError("aborted", "Remote account changed");
  }

  #invalidate(identity: Identity): void {
    if (this.#active === identity) { this.#active = undefined; this.#revision = crypto.randomUUID(); }
    identity.lifetime.abort(new CortexError("provider_auth_failed", "Remote sign-in is required"));
  }

  #watchExpiry(identity: Identity): void {
    if (this.#active !== identity || identity.expiresAt === undefined) return;
    const remaining = identity.expiresAt - Date.now();
    if (remaining <= 0) {
      if (identity.refreshToken) void this.#refresh(identity, this.#origin!).catch(() => undefined);
      else this.#invalidate(identity);
      return;
    }
    identity.expiry = setTimeout(() => this.#watchExpiry(identity), Math.min(remaining, 2147483647));
    identity.expiry.unref();
  }

  state(origin: string): RemoteAuthState {
    const parsed = ConnectionUrl.safeParse(origin);
    if (!parsed.success) throw new CortexError("invalid_request", "Invalid connection origin");
    const normalized = new URL(parsed.data).origin;
    if (normalized !== this.#origin) { this.clear(); this.#origin = normalized; }
    if (this.#active && !this.#active.refreshToken && this.#active.expiresAt !== undefined && this.#active.expiresAt <= Date.now()) this.#invalidate(this.#active);
    const candidate = this.#candidate;
    const stamp = { owner: { origin: this.#origin!, revision: this.#revision }, ...(candidate ? { candidate: candidate.id } : {}) };
    if (candidate?.pending?.status === "device_pending") return { ...stamp, status: "device_pending", signedIn: !!this.#active, device: { userCode: candidate.pending.userCode, verificationURL: candidate.pending.verificationURL } };
    if (candidate?.pending) return { ...stamp, status: candidate.pending.status, signedIn: !!this.#active, email: candidate.email };
    return this.#active
      ? { ...stamp, status: "signed_in", signedIn: true, email: this.#active.email }
      : { ...stamp, status: "signed_out", signedIn: false };
  }

  async authenticate(origin: string, input: RemoteAuthInput): Promise<RemoteAuthState> {
    const parsed = RemoteAuthInput.safeParse(input);
    if (!parsed.success) throw new CortexError("invalid_request", "Invalid sign-in request");
    input = parsed.data;
    this.state(origin);
    if (input.action === "logout") return this.#logout(origin);
    if (input.action === "cancel") {
      if (new URL(input.origin).origin !== this.#origin) throw new CortexError("invalid_request", "Sign-in owner changed");
      if (input.candidate === this.#candidate?.id) this.#cancelCandidate();
      else if (input.candidate === this.#revision) this.#revision = crypto.randomUUID();
      else throw new CortexError("invalid_request", "Sign-in owner changed");
      return this.state(origin);
    }
    if (new URL(input.owner.origin).origin !== this.#origin || input.owner.revision !== this.#revision) {
      throw new CortexError("invalid_request", "Sign-in owner changed");
    }
    if (this.#busy) throw new CortexError("conflict", "Sign-in is already in progress");

    let candidate = this.#candidate;
    if (input.action === "email" || input.action === "local" || input.action === "device") {
      // Starting a replacement consumes the current revision as its cancellation identity.
      this.#cancelCandidate();
      this.#revision = input.owner.revision;
      candidate = this.#create(this.#origin!, "email" in input ? input.email : "", input.owner.revision);
      this.#candidate = candidate;
    }
    if (!candidate || (input.action === "code" && candidate.pending?.status !== "code_sent")
      || (input.action === "verify_email" && candidate.pending?.status !== "verify_email")
      || (input.action === "mfa" && candidate.pending?.status !== "mfa_challenge")) {
      throw new CortexError("invalid_request", "No matching sign-in step");
    }
    this.#busy = candidate;
    candidate.responseStatus = 0;
    const selectedOrigin = this.#origin;
    try {
      let result: z.infer<typeof Interactive> | z.infer<typeof LocalSession> | undefined;
      switch (input.action) {
        case "device": {
          const response = await this.#native(candidate, this.#origin!, "/v1/auth/device", {});
          if (response.status !== 200) throw new Error("Native authorization refused");
          const device = Device.parse(await response.json());
          if (new URL(device.verification_uri_complete).protocol !== "https:") throw new Error("Invalid verification URL");
          candidate.pending = { status: "device_pending", code: device.device_code, userCode: device.user_code, verificationURL: device.verification_uri_complete, expiresAt: Date.now() + device.expires_in * 1000, nextPoll: Date.now() + device.interval * 1000, interval: device.interval };
          break;
        }
        case "device_poll": {
          const pending = candidate.pending;
          if (pending?.status !== "device_pending" || pending.expiresAt <= Date.now()) throw new Error("Device authorization expired");
          if (pending.nextPoll > Date.now()) return this.state(origin);
          pending.nextPoll = Date.now() + pending.interval * 1000;
          const response = await this.#native(candidate, this.#origin!, "/v1/auth/device/token", { device_code: pending.code });
          if (response.status === 202) {
            z.object({ status: z.literal("authorization_pending"), interval: z.number().int().positive() }).parse(await response.json());
            return this.state(origin);
          }
          if (response.status === 429) {
            const slowdown = z.object({ interval: z.number().int().positive() }).parse(await response.json());
            pending.interval = Math.max(pending.interval, slowdown.interval);
            pending.nextPoll = Date.now() + pending.interval * 1000;
            return this.state(origin);
          }
          if (response.status !== 200) throw new Error("Native authorization refused");
          await this.#pair(candidate, this.#origin!, await response.json());
          this.#promote(candidate);
          this.#revision = crypto.randomUUID();
          return this.state(origin);
        }
        case "email":
          Empty.parse(await candidate.client.auth.magicAuth.create({ body: { email: candidate.email } }));
          break;
        case "local": {
          const local = LocalSession.parse(await candidate.client.auth.local.create({ body: { email: candidate.email, password: input.password } }));
          if (Date.parse(local.expires_at) <= Date.now()) throw new Error("Expired session");
          result = local;
          break;
        }
        case "code":
          result = Interactive.parse(await candidate.client.auth.magicAuth.verify.create({ body: { email: candidate.email, code: input.code } }));
          break;
        case "verify_email":
          if (candidate.pending?.status !== "verify_email") throw new Error("Invalid sign-in step");
          result = Interactive.parse(await candidate.client.auth.verifyEmail.create({ body: {
            code: input.code, pending_authentication_token: candidate.pending.token,
          } }));
          break;
        case "mfa":
          if (candidate.pending?.status !== "mfa_challenge") throw new Error("Invalid sign-in step");
          result = Session.parse(await candidate.client.auth.mfa.verify.create({ body: {
            code: input.code, pending_authentication_token: candidate.pending.token,
            authentication_challenge_id: candidate.pending.challengeID,
          } }));
          break;
      }
      candidate.lifetime.signal.throwIfAborted();
      if (this.#candidate !== candidate || this.#origin !== selectedOrigin) throw new Error("Sign-in owner changed");
      if (result?.status === "session") {
        await this.#store();
        candidate.lifetime.signal.throwIfAborted();
        candidate.token = result.access_token;
        candidate.expiresAt = "expires_at" in result ? Date.parse(result.expires_at) : undefined;
        // Durable email-code identity: rotate the cookie grant once into a stored native pair bound to the verified account.
        if (candidate.refreshToken && input.action !== "local") {
          // A producer that refuses the rotation keeps the previous process-local session; the cookie grant is dropped.
          try {
            const rotated = await this.#native(candidate, selectedOrigin, "/v1/auth/refresh", { refresh_token: candidate.refreshToken });
            if (rotated.status !== 200) throw new Error("Native refresh refused");
            await this.#pair(candidate, selectedOrigin, await rotated.json());
          } catch { candidate.refreshToken = undefined; }
          candidate.lifetime.signal.throwIfAborted();
        }
        // One promotion path for email-code and device sign-in, so Chat and Code bindings always exist together.
        this.#promote(candidate);
      } else if (result?.status === "verify_email") {
        candidate.email = result.email;
        candidate.pending = { status: result.status, token: result.pending_authentication_token };
      } else if (result) {
        // ponytail: enrollment is status-only until approved UI handles QR/TOTP material.
        candidate.pending = { status: result.status, token: result.pending_authentication_token, challengeID: result.authentication_challenge_id };
      } else if (input.action !== "device") {
        candidate.pending = { status: "code_sent" };
      }
      this.#revision = crypto.randomUUID();
      return this.state(origin);
    } catch {
      const error = failure(candidate);
      // The SDK may have adopted cookies/token before a malformed success failed validation.
      if (this.#candidate === candidate && (!candidate.pending || (candidate.responseStatus >= 200 && candidate.responseStatus < 400))) this.#cancelCandidate();
      throw error;
    } finally {
      if (this.#busy === candidate) this.#busy = undefined;
    }
  }

  clear(): void {
    this.#busy?.lifetime.abort();
    this.#candidate?.lifetime.abort();
    this.#active?.lifetime.abort();
    this.#busy = this.#candidate = this.#active = undefined;
    this.#origin = undefined;
    this.#revision = crypto.randomUUID();
  }

  #cancelCandidate(): void {
    this.#candidate?.lifetime.abort();
    if (this.#busy === this.#candidate) this.#busy = undefined;
    this.#candidate = undefined;
    this.#revision = crypto.randomUUID();
  }

  #create(origin: string, email: string, id: string): Identity {
    const lifetime = new AbortController();
    const identity: Identity = {
      id, email, lifetime, responseStatus: 0,
      client: createCortexClient({
        baseUrl: origin, cookieJar: true, auth: { token: () => identity.token, signal: lifetime.signal },
        fetch: async (request) => {
          if (!new URL(request.url).pathname.startsWith("/v1/auth/") && identity.refreshToken && identity.expiresAt! <= Date.now()) {
            await this.#refresh(identity, origin);
            const headers = new Headers(request.headers);
            headers.set("Authorization", `Bearer ${identity.token}`);
            request = new Request(request, { headers });
          }
          if (new URL(request.url).pathname.startsWith("/v1/channels") || new URL(request.url).pathname.startsWith("/v1/mascots") || new URL(request.url).pathname.startsWith("/v1/plugins/") || new URL(request.url).pathname.startsWith("/v1/bot/share-invites") || new URL(request.url).pathname.startsWith("/v1/notifications") || ["/v1/bot/inbox", "/v1/bot/inbox/read", "/v1/bot/capabilities", "/v1/bot/approvals", "/v1/bot/routines/events", "/v1/realtime/events", "/v1/skills"].includes(new URL(request.url).pathname)) return workBotFetch(request, {
            origin, fetch: this.#fetch, signal: lifetime.signal,
            check: () => this.#checkActive(identity), unauthorized: () => { this.#invalidate(identity); void this.#store().catch(() => undefined); },
          });
          if (!new URL(request.url).pathname.startsWith("/v1/auth/")) return remoteChatFetch(request, {
            origin, fetch: this.#fetch, signal: lifetime.signal,
            check: () => this.#checkActive(identity), unauthorized: () => { this.#invalidate(identity); void this.#store().catch(() => undefined); },
          });
          identity.responseStatus = 0;
          if (new URL(request.url).origin !== origin) throw new Error("Invalid connection origin");
          const signal = AbortSignal.any([request.signal, lifetime.signal, AbortSignal.timeout(10000)]);
          signal.throwIfAborted();
          let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
          let abort!: () => void;
          const stopped = new Promise<never>((_resolve, reject) => {
            abort = () => { void reader?.cancel().catch(() => undefined); reject(new Error("Sign-in transport cancelled")); };
            signal.addEventListener("abort", abort, { once: true });
          });
          try {
            // Bound the complete small auth body: Node 22 can leave SDK body parsing pending after Fetch abort.
            return await Promise.race([stopped, (async () => {
              const response = await this.#fetch(new Request(request, { redirect: "error", credentials: "omit", signal }));
              if (signal.aborted || response.redirected || (response.url && new URL(response.url).origin !== origin)) {
                await response.body?.cancel();
                throw new Error("Sign-in transport refused");
              }
              identity.responseStatus = response.status;
              const path = new URL(request.url).pathname;
              // Email-code completions carry the refresh grant only as a cookie; keep it main-only so promotion can rotate it into a durable native pair.
              // ponytail: default producer cookie name; read it from /v1/instance if deployments rename it.
              if (response.ok && SessionCompletions.has(path)) identity.refreshToken = response.headers.getSetCookie().map(c => /^cortex_rt=([^;\s]+)/.exec(c)?.[1]).find(Boolean) ?? identity.refreshToken;
              const status = path === "/v1/auth/magic-auth" || path === "/v1/auth/local/logout" ? 204 : 200;
              if (response.ok && !z.literal(status).safeParse(response.status).success) {
                await response.body?.cancel();
                throw new Error("Invalid sign-in response");
              }
              reader = response.body?.getReader();
              const chunks: Uint8Array[] = [];
              let size = 0;
              while (reader) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                // ponytail: auth replies are capped at 1 MiB; raise only for a larger admitted auth contract.
                if (size > 1024 * 1024) throw new Error("Invalid sign-in response");
                chunks.push(chunk.value);
              }
              signal.throwIfAborted();
              return new Response(response.status === 204 ? null : Buffer.concat(chunks), response);
            })()]);
          } finally {
            signal.removeEventListener("abort", abort);
            void reader?.cancel().catch(() => undefined);
          }
        },
      }),
    };
    lifetime.signal.addEventListener("abort", () => clearTimeout(identity.expiry), { once: true });
    return identity;
  }

  async #logout(origin: string): Promise<RemoteAuthState> {
    if (this.#busy && this.#busy !== this.#candidate) throw new CortexError("conflict", "Sign-out is already in progress");
    this.#cancelCandidate();
    const active = this.#active;
    this.#active = undefined;
    const clearing = this.#store();
    if (!active) { await clearing; return this.state(origin); }
    this.#busy = active;
    this.#revision = crypto.randomUUID();
    active.chatLifetime?.abort();
    if (active.refreshToken) {
      try {
        await clearing;
        if (active.refreshing) await active.refreshing;
        if (active.expiresAt! <= Date.now()) await this.#refresh(active, origin);
        const response = await this.#native(active, origin, "/v1/auth/logout", {});
        if (response.status !== 204) throw failure(active);
        return this.state(origin);
      } catch { throw failure(active); }
      finally {
        active.lifetime.abort();
        try { await this.#store(); } finally { if (this.#busy === active) this.#busy = undefined; }
      }
    }
    try { await clearing; } catch { active.lifetime.abort(); this.#busy = undefined; throw failure(active); }
    // ponytail: access-only web grants remain process-local; persistent sign-in uses the explicit native device grant.
    if (active.expiresAt === undefined) { active.lifetime.abort(); this.#busy = undefined; return this.state(origin); }
    this.#busy = active;
    active.responseStatus = 0;
    try {
      Empty.parse(await active.client.auth.local.logout.create());
      active.lifetime.signal.throwIfAborted();
      return this.state(origin);
    } catch {
      throw failure(active);
    } finally {
      active.lifetime.abort();
      if (this.#busy === active) this.#busy = undefined;
    }
  }
}
