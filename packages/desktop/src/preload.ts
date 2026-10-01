// Context bridge: a fetch that reaches the in-process engine, the event stream, and menu commands.
import { contextBridge, ipcRenderer } from "electron";

type Wire = { status: number; headers: [string, string][]; body: string };

async function bridgeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input, init);
  const path = new URL(req.url).pathname;
  if (path === "/api/events") {
    let onChunk: (_: unknown, s: string) => void;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        onChunk = (_e, s) => c.enqueue(enc.encode(s));
        ipcRenderer.on("cortex:events:chunk", onChunk);
        ipcRenderer.send("cortex:events");
      },
      cancel() { ipcRenderer.removeListener("cortex:events:chunk", onChunk); },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const res: Wire = await ipcRenderer.invoke("cortex:fetch", { url: req.url, method: req.method, headers: [...req.headers], body });
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: res.headers });
}

contextBridge.exposeInMainWorld("cortex", {
  fetch: bridgeFetch,
  platform: process.platform,
  appVersion: process.env.npm_package_version ?? "",
  openExternal: (url: string) => ipcRenderer.send("cortex:open-external", url),
  onMenu: (cb: (cmd: string) => void) => {
    const f = (_: unknown, cmd: string) => cb(cmd);
    ipcRenderer.on("cortex:menu", f);
    return () => ipcRenderer.removeListener("cortex:menu", f);
  },
});
