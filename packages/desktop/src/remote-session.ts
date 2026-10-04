// Main-only, process-lifetime authentication. SDK clients, cookies and continuations stay private.
import { createCortexClient, type CortexClient } from "@cortex/sdk";
import { ConnectionUrl, RemoteAuthInput, type RemoteAuthState } from "@cortex/schema";
import { z } from "zod";
import { CortexError } from "@cortex/core";
import { createRemoteChatBinding, remoteChatFetch, type MainRemoteChatBinding } from "./remote-chat";

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

type Pending =
  | { status: "code_sent" }
  | { status: "verify_email"; token: string }
  | { status: "mfa_challenge" | "mfa_enrollment"; token: string; challengeID: string };
type Identity = {
  id: string;
  client: CortexClient;
  lifetime: AbortController;
  email: string;
  token?: string;
  expiresAt?: number;
  pending?: Pending;
  responseStatus: number;
  chat?: MainRemoteChatBinding;
  chatLifetime?: AbortController;
  expiry?: ReturnType<typeof setTimeout>;
};

const failure = (identity: Identity) => {
  if (identity.lifetime.signal.aborted) return new CortexError("invalid_request", "Sign-in was cancelled");
  if ([400, 401, 403, 422].includes(identity.responseStatus)) return new CortexError("provider_auth_failed", "Sign-in was not accepted");
  if (identity.responseStatus === 429) return new CortexError("provider_rate_limited", "Too many sign-in attempts");
  return new CortexError("provider_error", "Could not complete sign-in");
};

// ponytail: persistence/refresh await admitted contracts; Cloud expiry is not inferred from unverified token claims.
export class RemoteSession {
  #origin?: string;
  #revision: string = crypto.randomUUID();
  #active?: Identity;
  #candidate?: Identity;
  #busy?: Identity;
  #fetch: typeof fetch;

  constructor(options: { fetch?: typeof fetch } = {}) { this.#fetch = options.fetch ?? globalThis.fetch; }

  bind(origin: string): MainRemoteChatBinding {
    const parsed = ConnectionUrl.safeParse(origin);
    if (!parsed.success) throw new CortexError("invalid_request", "Invalid connection origin");
    if (new URL(parsed.data).origin !== this.#origin || !this.#active) throw new CortexError("provider_auth_failed", "Remote sign-in is required");
    this.#checkActive(this.#active);
    return this.#active.chat!;
  }

  #checkActive(identity: Identity): void {
    if (identity.expiresAt !== undefined && identity.expiresAt <= Date.now()) this.#invalidate(identity);
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
    if (remaining <= 0) { this.#invalidate(identity); return; }
    identity.expiry = setTimeout(() => this.#watchExpiry(identity), Math.min(remaining, 2147483647));
    identity.expiry.unref();
  }

  state(origin: string): RemoteAuthState {
    const parsed = ConnectionUrl.safeParse(origin);
    if (!parsed.success) throw new CortexError("invalid_request", "Invalid connection origin");
    const normalized = new URL(parsed.data).origin;
    if (normalized !== this.#origin) { this.clear(); this.#origin = normalized; }
    if (this.#active?.expiresAt !== undefined && this.#active.expiresAt <= Date.now()) this.#invalidate(this.#active);
    const candidate = this.#candidate;
    const stamp = { owner: { origin: this.#origin!, revision: this.#revision }, ...(candidate ? { candidate: candidate.id } : {}) };
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
    if (input.action === "email" || input.action === "local") {
      // Starting a replacement consumes the current revision as its cancellation identity.
      this.#cancelCandidate();
      this.#revision = input.owner.revision;
      candidate = this.#create(this.#origin!, input.email, input.owner.revision);
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
        candidate.token = result.access_token;
        candidate.expiresAt = "expires_at" in result ? Date.parse(result.expires_at) : undefined;
        candidate.pending = undefined;
        this.#active?.lifetime.abort();
        this.#active = candidate;
        this.#candidate = undefined;
        candidate.chatLifetime = new AbortController();
        candidate.chat = createRemoteChatBinding(candidate.client, this.#origin!, crypto.randomUUID(),
          AbortSignal.any([candidate.lifetime.signal, candidate.chatLifetime.signal]), () => this.#checkActive(candidate));
        this.#watchExpiry(candidate);
      } else if (result?.status === "verify_email") {
        candidate.email = result.email;
        candidate.pending = { status: result.status, token: result.pending_authentication_token };
      } else if (result) {
        // ponytail: enrollment is status-only until approved UI handles QR/TOTP material.
        candidate.pending = { status: result.status, token: result.pending_authentication_token, challengeID: result.authentication_challenge_id };
      } else {
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
          if (!new URL(request.url).pathname.startsWith("/v1/auth/")) return remoteChatFetch(request, {
            origin, fetch: this.#fetch, signal: lifetime.signal,
            check: () => this.#checkActive(identity), unauthorized: () => this.#invalidate(identity),
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
    if (!active) return this.state(origin);
    active.chatLifetime?.abort();
    // ponytail: Cloud logout is device-local; server revocation/refresh await an admitted contract.
    if (active.expiresAt === undefined) { active.lifetime.abort(); return this.state(origin); }
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
