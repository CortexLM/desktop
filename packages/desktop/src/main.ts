// Electron main: hosts the local engine in-process and serves it to the renderer over IPC.
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, protocol, net, safeStorage, shell } from "electron";
import { createCore, findCuaDriver } from "@cortex/core";
import { createServer } from "@cortex/server";
import { createTranslator, resolveLocale } from "@cortex/i18n";
import { nodeCatalogs } from "@cortex/i18n/node";
import { fileCredentials } from "./credentials";
import { buildMenu } from "./menu";
import { probeRemote } from "./remote";

const APP_NAME = "Cortex";
app.setName(APP_NAME);
const dataDir = process.env.CORTEX_DATA_DIR ?? path.join(app.getPath("userData"), "engine");
const resources = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "../../..");
const rendererDir = app.isPackaged ? path.join(process.resourcesPath, "app.asar", "packages/app/dist") : path.resolve(__dirname, "../../app/dist");

protocol.registerSchemesAsPrivileged([{ scheme: "cortex", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

let win: BrowserWindow | undefined;

async function boot() {
  const core = createCore({
    dataDir,
    credentials: fileCredentials(path.join(dataDir, "credentials.json"), safeStorage),
    catalogUrl: process.env.CORTEX_CATALOG_URL,
    remoteProbe: (url) => probeRemote(url),
    skills: { builtin: path.join(resources, "skills"), personal: path.join(app.getPath("home"), ".cortex", "skills") },
    plugins: { personal: path.join(app.getPath("home"), ".cortex", "plugins") },
  });
  await core.start({ computerUse: findCuaDriver() });
  // Test hook: route one provider to a local endpoint (E2E streaming without network). Ignored in packaged builds.
  const testBase = !app.isPackaged && process.env.CORTEX_TEST_PROVIDER_BASEURL;
  if (testBase) { const [id, url] = testBase.split("="); await core.providers.update(id, { baseURL: url }); }
  const server = createServer(core);

  // Renderer → engine. Requests are rebuilt in main; only /api paths are routed.
  ipcMain.handle("cortex:fetch", async (_e, req: { url: string; method: string; headers: [string, string][]; body?: string }) => {
    const u = new URL(req.url, "cortex://local");
    if (!u.pathname.startsWith("/api/")) return { status: 404, headers: [], body: "" };
    const res = await server.fetch(new Request(`http://local${u.pathname}${u.search}`, { method: req.method, headers: req.headers, body: req.body }));
    return { status: res.status, headers: [...res.headers], body: await res.text() };
  });
  // Server-sent events cannot cross invoke(); they are pumped over a dedicated channel.
  const streams = new Map<number, ReadableStreamDefaultReader<Uint8Array>>();
  ipcMain.on("cortex:events:stop", (e) => { void streams.get(e.sender.id)?.cancel(); streams.delete(e.sender.id); });
  ipcMain.on("cortex:events", async (e) => {
    void streams.get(e.sender.id)?.cancel();
    const res = await server.fetch(new Request("http://local/api/events"));
    const reader = res.body!.getReader();
    streams.set(e.sender.id, reader);
    const dec = new TextDecoder();
    e.sender.once("destroyed", () => void reader.cancel());
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done || e.sender.isDestroyed()) break;
      e.sender.send("cortex:events:chunk", dec.decode(value));
    }
  });
  ipcMain.handle("cortex:pick-directory", async () => {
    if (process.env.CORTEX_TEST_PICK_DIRECTORY) return process.env.CORTEX_TEST_PICK_DIRECTORY;
    const r = await dialog.showOpenDialog(win!, { properties: ["openDirectory", "createDirectory"] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.on("cortex:open-external", (_e, url: string) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); });

  // Static renderer served from cortex://app so absolute asset paths resolve.
  protocol.handle("cortex", (req) => {
    const u = new URL(req.url);
    const file = path.normalize(path.join(rendererDir, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname)));
    if (!file.startsWith(rendererDir)) return new Response("", { status: 403 });
    return net.fetch("file://" + file);
  });

  app.on("before-quit", () => void core.close());
}

function createWindow() {
  const mac = process.platform === "darwin";
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 640,
    title: APP_NAME,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1b1b1b" : "#f2f2f2",
    titleBarStyle: mac ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 20, y: 15 },
    ...(mac ? {} : { titleBarOverlay: { color: "#00000000", symbolColor: nativeTheme.shouldUseDarkColors ? "#ffffff" : "#000000", height: 44 } }),
    webPreferences: { additionalArguments: [`--cortex-version=${app.getVersion()}`], preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  win.once("ready-to-show", () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("cortex://app")) e.preventDefault(); });
  const dev = process.env.CORTEX_RENDERER_URL;
  void win.loadURL(dev ?? `cortex://app/index.html${process.env.CORTEX_START_HASH ?? ""}`);
}

app.whenReady().then(async () => {
  await boot();
  const locale = resolveLocale([process.env.CORTEX_LOCALE ?? "", ...app.getPreferredSystemLanguages()]);
  buildMenu(createTranslator(locale, nodeCatalogs(path.join(resources, app.isPackaged ? "locales" : "packages/i18n/locales"))), () => win, APP_NAME);
  createWindow();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
