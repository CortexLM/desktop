// Context bridge. Only plain data crosses it (a Response object would be cloned into an empty object),
// so the renderer rebuilds Response objects around `request` / `events` (see packages/app/src/api.ts).
import { contextBridge, ipcRenderer } from "electron";
import type { UpdateState } from "@cortex/schema";

export type Wire = { status: number; headers: [string, string][]; body: string };
export type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };

contextBridge.exposeInMainWorld("cortex", {
  platform: process.platform,
  appVersion: process.argv.find((a) => a.startsWith("--cortex-version="))?.slice(17) ?? "",
  locale: process.argv.find((a) => a.startsWith("--cortex-locale="))?.slice(16) ?? "",
  request: (req: WireRequest): Promise<Wire> => ipcRenderer.invoke("cortex:fetch", req),
  /** Opens the engine event stream; chunks arrive on `onChunk` until the returned function is called. */
  events: (onChunk: (text: string) => void) => {
    const f = (_: unknown, s: string) => onChunk(s);
    ipcRenderer.on("cortex:events:chunk", f);
    ipcRenderer.send("cortex:events");
    return () => { ipcRenderer.removeListener("cortex:events:chunk", f); ipcRenderer.send("cortex:events:stop"); };
  },
  openExternal: (url: string) => ipcRenderer.send("cortex:open-external", url),
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke("cortex:pick-directory"),
  update: {
    status: (): Promise<UpdateState> => ipcRenderer.invoke("cortex:update:status"),
    check: (): Promise<UpdateState> => ipcRenderer.invoke("cortex:update:check"),
    install: (): Promise<boolean> => ipcRenderer.invoke("cortex:update:install"),
    onState: (cb: (s: UpdateState) => void) => {
      const f = (_: unknown, s: UpdateState) => cb(s);
      ipcRenderer.on("cortex:update:state", f);
      return () => ipcRenderer.removeListener("cortex:update:state", f);
    },
  },
  /** Chrome extension bridge: pairing code and shared tabs. Page text never reaches the renderer. */
  browser: {
    status: () => ipcRenderer.invoke("cortex:browser:status"),
    pair: () => ipcRenderer.invoke("cortex:browser:pair"),
    revoke: (tabId: number) => ipcRenderer.invoke("cortex:browser:revoke", tabId),
    disconnect: () => ipcRenderer.invoke("cortex:browser:disconnect"),
    extensionDir: (): Promise<string> => ipcRenderer.invoke("cortex:browser:extension-dir"),
    revealExtension: (): Promise<string> => ipcRenderer.invoke("cortex:browser:reveal-extension"),
    onChange: (cb: (s: unknown) => void) => {
      const f = (_: unknown, s: unknown) => cb(s);
      ipcRenderer.on("cortex:browser:changed", f);
      return () => ipcRenderer.removeListener("cortex:browser:changed", f);
    },
  },
  /** Bot call: main holds the ticket and socket; this side only moves PCM and controls. */
  call: {
    available: (): Promise<"offer" | "unavailable" | "hidden"> => ipcRenderer.invoke("cortex:call:available"),
    start: (botId: string, on: { snapshot(s: unknown): void; play(pcm: Uint8Array, sequence: number, generation: number): void; flush(): void }) => {
      const snapshot = (_: unknown, s: unknown) => on.snapshot(s);
      const play = (_: unknown, pcm: Uint8Array, sequence: number, generation: number) => on.play(pcm, sequence, generation);
      const flush = () => on.flush();
      ipcRenderer.on("cortex:call:snapshot", snapshot);
      ipcRenderer.on("cortex:call:play", play);
      ipcRenderer.on("cortex:call:flush", flush);
      const stop = () => {
        ipcRenderer.removeListener("cortex:call:snapshot", snapshot);
        ipcRenderer.removeListener("cortex:call:play", play);
        ipcRenderer.removeListener("cortex:call:flush", flush);
      };
      return { started: ipcRenderer.invoke("cortex:call:start", botId), stop };
    },
    capture: (pcm: Uint8Array) => ipcRenderer.send("cortex:call:capture", pcm),
    played: (sequence: number, generation: number) => ipcRenderer.send("cortex:call:played", sequence, generation),
    mute: (muted: boolean) => ipcRenderer.send("cortex:call:mute", muted),
    interrupt: () => ipcRenderer.send("cortex:call:interrupt"),
    end: () => ipcRenderer.send("cortex:call:end"),
  },
  onMenu: (cb: (cmd: string) => void) => {
    const f = (_: unknown, cmd: string) => cb(cmd);
    ipcRenderer.on("cortex:menu", f);
    return () => ipcRenderer.removeListener("cortex:menu", f);
  },
});
