// Electron main: hosts the local engine in-process and serves it to the renderer over IPC.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, autoUpdater, BrowserWindow, dialog, ipcMain, nativeTheme, protocol, net, safeStorage, session, shell } from "electron";
import { createCore, findCuaDriver } from "@cortex/core";
import { createServer } from "@cortex/server";
import { createTranslator, resolveLocale } from "@cortex/i18n";
import { nodeCatalogs } from "@cortex/i18n/node";
import { fileCredentials } from "./credentials";
import { buildMenu } from "./menu";
import { probeRemote } from "./remote";
import { RemoteSession } from "./remote-session";
import { createUpdater } from "./updater";
import { createCallHost } from "./remote-call";

const APP_NAME = "Cortex";
declare const __CORTEX_RELEASE_CHANNEL__: string;
app.setName(APP_NAME);
if (typeof __CORTEX_RELEASE_CHANNEL__ !== "undefined" && __CORTEX_RELEASE_CHANNEL__ === "staging" && !app.commandLine.hasSwitch("user-data-dir")) {
  app.setPath("userData", path.join(app.getPath("appData"), "Cortex-staging"));
}
const dataDir = process.env.CORTEX_DATA_DIR ?? path.join(app.getPath("userData"), "engine");
const resources = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "../../..");
const rendererDir = app.isPackaged ? path.join(process.resourcesPath, "app.asar", "packages/app/dist") : path.resolve(__dirname, "../../app/dist");
const testBase = !app.isPackaged && process.env.CORTEX_TEST_PROVIDER_BASEURL;
// ponytail: main-only test snapshot covers startup; no renderer bridge or persistent diagnostics.
const bootDiagnostic: { stage: string; errorName?: string } = { stage: "START" };
function bootStage(stage: string) {
  if (!testBase) return;
  bootDiagnostic.stage = stage;
  console.error("cortex:test:boot", JSON.stringify(bootDiagnostic));
}
if (testBase) {
  Object.assign(globalThis, { cortexTestBoot: bootDiagnostic });
  bootStage("START");
}

protocol.registerSchemesAsPrivileged([{ scheme: "cortex", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

let win: BrowserWindow | undefined;

async function boot() {
  // No runtime dictionary download: Linux Hunspell files load only from bundled resources/dictionaries.
  // ponytail: none are bundled yet, so Linux spellcheck has no dictionary; ship .bdic files there to enable it.
  if (process.platform === "linux") session.defaultSession.setSpellCheckerDictionaryDownloadURL(pathToFileURL(path.join(resources, "dictionaries") + path.sep).href);
  // ponytail: the feed comes from CORTEX_UPDATE_FEED_URL only; bake a release feed into build.mjs once one is published.
  const updates = createUpdater({ squirrel: autoUpdater, platform: process.platform, version: app.getVersion(), feed: process.env.CORTEX_UPDATE_FEED_URL });
  ipcMain.handle("cortex:update:status", () => updates.status());
  ipcMain.handle("cortex:update:check", () => updates.check());
  ipcMain.handle("cortex:update:install", () => updates.install());
  updates.on((s) => win?.webContents.send("cortex:update:state", s));
  const remote = new RemoteSession({ openExternal: url => shell.openExternal(url), credentials: fileCredentials(path.join(dataDir, "remote-credentials.json"), {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
    encryptString: (value) => safeStorage.encryptString(value), decryptString: (value) => safeStorage.decryptString(value),
  }, true) });
  const core = createCore({
    dataDir,
    credentials: fileCredentials(path.join(dataDir, "credentials.json"), safeStorage),
    mcpCredentials: fileCredentials(path.join(dataDir, "mcp-credentials.json"), safeStorage),
    catalogUrl: process.env.CORTEX_CATALOG_URL,
    remoteProbe: (url) => probeRemote(url),
    remoteAuth: remote,
    remoteChat: remote,
    remoteCode: remote,
    remoteWorkBot: remote,
    skills: { builtin: path.join(resources, "skills"), personal: path.join(app.getPath("home"), ".cortex", "skills") },
    plugins: { personal: path.join(app.getPath("home"), ".cortex", "plugins") },
  });
  bootStage("core-created");
  await core.start({ computerUse: findCuaDriver() });
  bootStage("core-started");
  if (core.connection.get().mode !== "local") await remote.restore(core.connection.remoteOrigin());
  // Test hook: route one provider to a local endpoint (E2E streaming without network). Ignored in packaged builds.
  if (testBase) {
    bootStage("provider-update");
    const [id, url] = testBase.split("="); await core.providers.update(id, { baseURL: url });
    bootStage("provider-updated");
  }
  const server = createServer(core);

  // Renderer → engine. Requests are rebuilt in main; only /api paths are routed.
  ipcMain.handle("cortex:fetch", async (_e, req: { url: string; method: string; headers: [string, string][]; body?: string }) => {
    const u = new URL(req.url, "cortex://local");
    if (!u.pathname.startsWith("/api/")) return { status: 404, headers: [], body: "" };
    const res = await server.fetch(new Request(`http://local${u.pathname}${u.search}`, { method: req.method, headers: req.headers, body: req.body }));
    return { status: res.status, headers: [...res.headers], body: await res.text() };
  });
  // Bot calls: main owns the ticket, socket and bearer; the renderer only moves PCM.
  const calls = createCallHost((origin) => remote.callAuth(origin));
  const callOrigin = () => { if (core.connection.get().mode === "local") throw new Error("Bot calls need a Cortex account"); return core.connection.remoteOrigin(); };
  ipcMain.handle("cortex:call:available", () => { try { return calls.available(callOrigin()); } catch { return "hidden"; } });
  // One call per host: only the renderer that started it may drive it.
  let callOwner: number | undefined;
  const owns = (e: Electron.IpcMainEvent) => e.sender.id === callOwner;
  ipcMain.handle("cortex:call:start", async (e, botId: string) => {
    callOwner = e.sender.id;
    const send = (channel: string, ...args: unknown[]) => { if (!e.sender.isDestroyed() && !e.sender.isCrashed()) e.sender.send(channel, ...args); };
    await calls.start(callOrigin(), String(botId), {
      snapshot: (s) => send("cortex:call:snapshot", s),
      play: (pcm, sequence, generation) => send("cortex:call:play", pcm, sequence, generation),
      flush: () => send("cortex:call:flush"),
    }, e.sender);
  });
  ipcMain.on("cortex:call:capture", (e, pcm: Uint8Array) => { if (owns(e) && pcm instanceof Uint8Array && pcm.byteLength === 640) calls.capture(pcm); });
  ipcMain.on("cortex:call:played", (e, sequence: number, generation: number) => { if (owns(e)) calls.played(Number(sequence), Number(generation)); });
  ipcMain.on("cortex:call:mute", (e, muted: boolean) => { if (owns(e)) calls.mute(muted === true); });
  ipcMain.on("cortex:call:interrupt", (e) => { if (owns(e)) calls.interrupt(); });
  ipcMain.on("cortex:call:end", (e) => { if (owns(e)) calls.end(); });
  // Test hook for E2E receipts (frame counts). Ignored in packaged builds.
  if (!app.isPackaged) ipcMain.handle("cortex:call:stats", () => calls.stats() ?? null);
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
    const relative = path.relative(rendererDir, file);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return new Response("", { status: 403 });
    return net.fetch(pathToFileURL(file).href);
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
  bootStage("app-ready");
  await boot();
  bootStage("menu");
  const locale = resolveLocale([process.env.CORTEX_LOCALE ?? "", ...app.getPreferredSystemLanguages()]);
  buildMenu(createTranslator(locale, nodeCatalogs(path.join(resources, app.isPackaged ? "locales" : "packages/i18n/locales"))), () => win, APP_NAME);
  bootStage("window");
  createWindow();
  bootStage("ready");
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch((error: unknown) => {
  if (testBase) {
    const name = error instanceof Error ? error.name : "";
    bootDiagnostic.errorName = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "AbortError", "TimeoutError"].includes(name) ? name : "UnknownError";
    bootStage(bootDiagnostic.stage);
  }
  throw error;
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
