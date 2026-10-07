import { CortexError } from "@cortex/core";
import { ChatFeatureCall, CHAT_FEATURE_OPS, type ChatFeatureResult } from "@cortex/schema";

// Trunk Chat feature routes (shares, canvases, search, research, audio/live capability reads). Main builds the URL from
// the closed table, validates every segment and returns a bounded JSON body or a typed refusal.
const ULID = "[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}";
const SEGMENT: Record<string, RegExp> = { conversation: new RegExp(`^cnv_${ULID}$`), canvas: new RegExp(`^cvs_${ULID}$`), share: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i };
const REFUSAL: Record<number, CortexError["code"]> = { 400: "invalid_request", 404: "not_found", 409: "conflict", 422: "invalid_request", 429: "provider_rate_limited" };

export async function chatFeatureFetch(input: unknown, owner: { origin: string; fetch: typeof fetch; signal: AbortSignal; check(): void; unauthorized(): void }): Promise<ChatFeatureResult> {
  owner.check();
  const call = ChatFeatureCall.parse(input);
  const op = CHAT_FEATURE_OPS[call.op];
  if (Object.keys(call.params).some(k => !op.path.includes(`{${k}}`)) || (call.q !== undefined && call.op !== "search")) throw new CortexError("invalid_request", "Invalid chat parameter");
  const path = op.path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const value = call.params[key];
    if (typeof value !== "string" || !SEGMENT[key]?.test(value)) throw new CortexError("invalid_request", "Invalid chat parameter");
    return encodeURIComponent(value);
  });
  const url = new URL(`${owner.origin}/v1${path}`);
  if (call.q !== undefined) url.searchParams.set("q", call.q);
  let response: Response;
  try {
    response = await owner.fetch(new Request(url, { method: op.method, redirect: "error", credentials: "omit", signal: AbortSignal.any([owner.signal, AbortSignal.timeout(20000)]),
      ...(op.method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}) }));
  } catch { owner.check(); throw new CortexError("provider_error", "Remote request did not complete"); }
  owner.check();
  if (response.redirected || (response.url && new URL(response.url).origin !== owner.origin)) { void response.body?.cancel(); throw new CortexError("provider_error", "Remote request was redirected"); }
  const text = (await response.text().catch(() => "")).slice(0, 1024 * 1024);
  if (response.status === 401) { owner.unauthorized(); throw new CortexError("provider_auth_failed", "Remote sign-in is required"); }
  if (!response.ok) throw new CortexError(response.status === 403 ? "permission_denied" : REFUSAL[response.status] ?? "provider_error", "The remote request was not accepted");
  let data: unknown = null;
  if (text) { try { data = JSON.parse(text); } catch { throw new CortexError("provider_error", "Invalid remote response"); } }
  return { status: response.status, data };
}
