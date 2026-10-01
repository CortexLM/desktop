// Cortex Cloud and self-hosted backends, reached from main only (session material never crosses to the renderer).
// Uses the Cortex SDK; local mode never calls this module.
import { createCortexClient } from "@cortex/sdk";

export type RemoteModel = { id: string; name: string };
export type RemoteStatus =
  | { status: "reachable"; authRequired: boolean; models: RemoteModel[] }
  | { status: "unreachable" | "incompatible" };

/** Probes a backend and lists its models: `/readyz`, then `/v1/instance` (optional), then `models.list()`. */
export async function probeRemote(baseUrl: string, opts: { token?: string; fetch?: typeof fetch } = {}): Promise<RemoteStatus> {
  const f = opts.fetch ?? fetch;
  const origin = baseUrl.replace(/\/+$/, "");
  try {
    const ready = await f(`${origin}/readyz`, { signal: AbortSignal.timeout(5000) });
    if (!ready.ok) return { status: "unreachable" };
  } catch {
    return { status: "unreachable" };
  }
  let authRequired = true;
  try {
    const r = await f(`${origin}/v1/instance`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) authRequired = ((await r.json()) as { auth?: { required?: boolean } }).auth?.required !== false;
  } catch { /* older backends have no instance route: sign-in stays required */ }
  const client = createCortexClient({ baseUrl: origin, fetch: f, auth: opts.token ? { token: opts.token } : undefined });
  try {
    return { status: "reachable", authRequired, models: normalizeModels(await client.models.list()) };
  } catch (err) {
    const code = (err as { status?: number }).status;
    return code === 401 || code === 403 ? { status: "reachable", authRequired: true, models: [] } : { status: "incompatible" };
  }
}

function normalizeModels(data: unknown): RemoteModel[] {
  const list = Array.isArray(data) ? data : ((data as { items?: unknown[]; data?: unknown[]; models?: unknown[] }).items ?? (data as { data?: unknown[] }).data ?? (data as { models?: unknown[] }).models ?? []);
  return list.flatMap((m) => {
    const o = m as Record<string, unknown>;
    const id = String(o.slug ?? o.id ?? o.model ?? "");
    return id ? [{ id, name: String(o.name ?? o.display_name ?? id) }] : [];
  });
}
