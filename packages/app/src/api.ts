// Renderer access to the local engine. In Electron the preload exposes a plain-data IPC bridge to the
// in-process server (no socket, no CORS, no key in the renderer); this module turns it back into fetch().
// In a plain browser (vite dev) requests go to /api through the dev proxy.
import { createClient } from "@cortex/client";
import type { UpdateState } from "@cortex/schema";

type Wire = { status: number; headers: [string, string][]; body: string };
type Bridge = {
  platform: string;
  appVersion: string;
  request: (req: { url: string; method: string; headers: [string, string][]; body?: string }) => Promise<Wire>;
  events: (onChunk: (text: string) => void) => () => void;
  openExternal?: (url: string) => void;
  pickDirectory?: () => Promise<string | null>;
  onMenu?: (cb: (cmd: string) => void) => () => void;
  update?: { status: () => Promise<UpdateState>; check: () => Promise<UpdateState>; install: () => Promise<boolean>; onState: (cb: (s: UpdateState) => void) => () => void };
};
declare global { interface Window { cortex?: Bridge } }

export const bridge = (): Bridge | undefined => window.cortex;
export const isDesktop = () => !!window.cortex;
export const platform = () => window.cortex?.platform ?? "web";

/** fetch() over the desktop bridge; the event stream becomes a streaming Response body. */
export async function bridgeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const b = window.cortex!;
  const req = new Request(input, init);
  if (new URL(req.url).pathname === "/api/events") {
    let stop = () => {};
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start: (c) => { stop = b.events((s) => c.enqueue(enc.encode(s))); }, cancel: () => stop() });
    req.signal.addEventListener("abort", () => stop(), { once: true });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const res = await b.request({ url: req.url, method: req.method, headers: [...req.headers], body });
  return new Response(res.status === 204 || res.status === 304 ? null : res.body, { status: res.status, headers: res.headers });
}

export const api = createClient({ fetch: (r: Request) => (window.cortex ? bridgeFetch(r) : fetch(r)), baseUrl: window.cortex ? "cortex://local" : location.origin });
export type Api = typeof api;
