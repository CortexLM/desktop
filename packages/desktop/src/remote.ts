// Cortex Cloud and self-hosted backends, reached from main only (session material never crosses to the renderer).
// Uses the Cortex SDK; local mode never calls this module.
import { ApiError, createCortexClient } from "@cortex/sdk";
import { ConnectionUrl } from "@cortex/schema";
import { z } from "zod";

export type RemoteModel = { id: string; name: string };
export type RemoteStatus =
  | { status: "reachable"; authRequired: boolean; models: RemoteModel[] }
  | { status: "unreachable" | "incompatible" };

const Name = z.string().trim().min(1);
const Instance = z.object({
  mode: z.enum(["cloud", "self_host"]),
  auth: z.object({ mode: z.enum(["cortex", "local", "none"]), required: z.boolean(), providers: z.array(z.enum(["cortex", "local", "guest"])) }),
  version: Name,
  registry: z.object({ enabled: z.boolean() }),
}).refine((i) => i.auth.required === (i.auth.mode !== "none") && (i.mode === "self_host" || (i.auth.mode === "cortex" && !i.registry.enabled)));
const CloudModels = z.object({ items: z.array(z.object({ slug: Name, display_name: Name })), has_more: z.literal(false) });
const RegistryModels = z.object({
  items: z.array(z.object({ id: Name, name: Name, configured: z.literal(true) })),
  has_more: z.boolean(),
  next_cursor: Name.optional(),
  source: z.enum(["models.dev", "cache", "cache_stale", "unavailable"]),
});

/** Readiness, instance discovery, then its catalogue. Only a missing instance route permits legacy discovery. */
export async function probeRemote(baseUrl: string, opts: { token?: string; fetch?: typeof fetch } = {}): Promise<RemoteStatus> {
  const f = opts.fetch ?? fetch;
  let origin: string;
  try {
    // ponytail: backend URLs are origins; add a pinned base path only when deployment requires one.
    origin = new URL(ConnectionUrl.parse(baseUrl)).origin;
  } catch {
    return { status: "incompatible" };
  }
  const deadline = AbortSignal.timeout(5000);
  let responseStatus = 0;
  const safeFetch = async (request: Request) => {
    responseStatus = 0;
    if (new URL(request.url).origin !== origin) throw new Error("Invalid remote origin");
    deadline.throwIfAborted();
    const response = await f(new Request(request, { redirect: "error", credentials: "omit", signal: AbortSignal.any([request.signal, deadline]) }));
    responseStatus = response.status;
    return response;
  };
  try {
    const ready = await safeFetch(new Request(`${origin}/readyz`));
    await ready.body?.cancel();
    if (!ready.ok) return { status: "unreachable" };
  } catch {
    return { status: "unreachable" };
  }
  const client = createCortexClient({ baseUrl: origin, fetch: safeFetch, cookieJar: false, auth: opts.token ? { token: opts.token } : undefined });
  try {
    let instance: z.infer<typeof Instance> | undefined;
    try {
      instance = Instance.parse(await client.instance.list());
    } catch (err) {
      // Use the HTTP status, not a potentially inconsistent status in the problem body.
      if (!(err instanceof ApiError) || responseStatus !== 404) throw err;
    }
    const authRequired = instance?.auth.required ?? true;
    if (instance?.mode !== "self_host") {
      const page = CloudModels.parse(await client.models.list());
      return { status: "reachable", authRequired, models: page.items.map((m) => ({ id: m.slug, name: m.display_name })) };
    }
    const models: RemoteModel[] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const query = { configured: true, limit: 500, ...(cursor === undefined ? {} : { cursor }) };
      const page = RegistryModels.parse(await client.registry.models.list({ query }));
      models.push(...page.items.map(({ id, name }) => ({ id, name })));
      if (!page.has_more) return { status: "reachable", authRequired, models };
      if (!page.next_cursor || cursors.has(page.next_cursor)) return { status: "incompatible" };
      cursor = page.next_cursor;
      cursors.add(cursor);
    }
  } catch (err) {
    if (err instanceof ApiError && (responseStatus === 401 || responseStatus === 403)) return { status: "reachable", authRequired: true, models: [] };
    return { status: deadline.aborted ? "unreachable" : "incompatible" };
  }
}
