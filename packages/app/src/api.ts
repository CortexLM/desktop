// Renderer access to the local engine. In Electron the preload exposes `window.cortex.fetch`,
// an IPC bridge to the in-process server (no socket, no CORS, no token in the renderer).
// In a plain browser (vite dev) requests go to /api through the dev proxy.
import { createClient } from "@cortex/client";

type Bridge = { fetch: typeof fetch; platform: string; appVersion: string; openExternal?: (url: string) => void; onMenu?: (cb: (cmd: string) => void) => () => void };
declare global { interface Window { cortex?: Bridge } }

export const bridge = (): Bridge | undefined => window.cortex;
export const isDesktop = () => !!window.cortex;
export const platform = () => window.cortex?.platform ?? "web";

export const api = createClient({ fetch: (...a: Parameters<typeof fetch>) => (window.cortex?.fetch ?? fetch)(...a), baseUrl: window.cortex ? "cortex://local" : location.origin });
export type Api = typeof api;
