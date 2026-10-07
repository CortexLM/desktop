import { CortexError } from "@cortex/core";
import { ContractCall, CONTRACT_OPS, type ContractOp, type ContractResult } from "@cortex/schema";

// Todo 3 Code/Bot contract routes. One closed operation table: the renderer names an operation and its path
// parameters; main builds the URL, validates every segment, and returns only a bounded JSON body or a typed refusal.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID = "[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}";
const SEGMENT: Record<string, RegExp> = {
  session: new RegExp(`^cnv_${ULID}$`), attempt: new RegExp(`^(?:msg|cnv)_${ULID}$`), runtime: new RegExp(`^crt_${ULID}$`), plan: new RegExp(`^tpl_${ULID}$`), step: new RegExp(`^tps_${ULID}$`),
  comment: UUID, bot: UUID, task: UUID, draft: UUID, approval: UUID,
  channel: UUID, automation: UUID, scheduled: UUID, mcp: UUID, token: /^[0-9a-f]{1,128}$/i,
  conversation: new RegExp(`^cnv_${ULID}$`), prompt: new RegExp(`^prm_${ULID}$`), file: new RegExp(`^lbf_${ULID}$`),
  provider: /^[a-z0-9][a-z0-9._-]{0,63}$/i, skill: /^[a-z0-9][a-z0-9-]{0,63}$/,
  secret: /^[A-Z_][A-Z0-9_]{0,63}$/, owner: /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/, repo: /^[A-Za-z0-9._-]{1,100}$/,
};
const REFUSAL: Record<number, CortexError["code"]> = { 400: "invalid_request", 404: "not_found", 409: "conflict", 413: "invalid_request", 422: "invalid_request", 429: "provider_rate_limited" };

export async function contractFetch(input: unknown, owner: { origin: string; fetch: typeof fetch; signal: AbortSignal; check(): void; unauthorized(): void }): Promise<ContractResult> {
  owner.check();
  const call = ContractCall.parse(input);
  const op: ContractOp = CONTRACT_OPS[call.op];
  const path = op.path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const value = call.params[key];
    if (typeof value !== "string" || !SEGMENT[key]?.test(value)) throw new CortexError("invalid_request", "Invalid contract parameter");
    return encodeURIComponent(value);
  });
  if (Object.keys(call.params).some(k => !op.path.includes(`{${k}}`))) throw new CortexError("invalid_request", "Invalid contract parameter");
  const signal = AbortSignal.any([owner.signal, AbortSignal.timeout(op.slow ? 120000 : 20000)]);
  let response: Response;
  try {
    response = await owner.fetch(new Request(`${owner.origin}/v1${path}`, {
      method: op.method, redirect: "error", credentials: "omit", signal,
      ...(op.method === "GET" || op.method === "DELETE" ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(call.body ?? {}) }),
    }));
  } catch { owner.check(); throw new CortexError("provider_error", "Remote request did not complete"); }
  owner.check();
  if (response.redirected || (response.url && new URL(response.url).origin !== owner.origin)) { void response.body?.cancel(); throw new CortexError("provider_error", "Remote request was redirected"); }
  const text = (await response.text().catch(() => "")).slice(0, 1024 * 1024);
  owner.check();
  if (response.status === 401) { owner.unauthorized(); throw new CortexError("provider_auth_failed", "Remote sign-in is required"); }
  if (!response.ok) {
    throw new CortexError(response.status === 403 ? "permission_denied" : REFUSAL[response.status] ?? "provider_error", "The remote request was not accepted");
  }
  let data: unknown = null;
  if (op.text) return { status: response.status, data: text };
  if (text) { try { data = JSON.parse(text); } catch { throw new CortexError("provider_error", "Invalid remote response"); } }
  return { status: response.status, data };
}
