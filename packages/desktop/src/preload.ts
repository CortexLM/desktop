// Context bridge. Only plain data crosses it (a Response object would be cloned into an empty object),
// so the renderer rebuilds Response objects around `request` / `events` (see packages/app/src/api.ts).
import { contextBridge, ipcRenderer } from "electron";
import type { UpdateState } from "@cortex/schema";

export type Wire = { status: number; headers: [string, string][]; body: string };
export type WireRequest = { url: string; method: string; headers: [string, string][]; body?: string };

contextBridge.exposeInMainWorld("cortex", {
  platform: process.platform,
  appVersion: process.argv.find((a) => a.startsWith("--cortex-version="))?.slice(17) ?? "",
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
  onMenu: (cb: (cmd: string) => void) => {
    const f = (_: unknown, cmd: string) => cb(cmd);
    ipcRenderer.on("cortex:menu", f);
    return () => ipcRenderer.removeListener("cortex:menu", f);
  },
});
