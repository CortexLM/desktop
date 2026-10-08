// Service worker: pairs with the Cortex desktop app, keeps the list of tabs the user shared, answers read requests.
// It never touches cookies, storage of pages or credentials: a read returns title, URL and visible text of a shared tab only.
import { PORTS, normalizeCode, shareableUrl, consentAdd, consentRemove, consentHas, consentValid, clipText } from "./lib.js";

const store = chrome.storage.session;
let looping = false;

const load = async () => ({ token: null, port: null, shared: {}, ...(await store.get(["token", "port", "shared"])) });
const origin = (port) => `http://127.0.0.1:${port}`;

async function call(path, { method = "POST", body, signal } = {}) {
  const { token, port } = await load();
  if (!token || !port) throw new Error("not_paired");
  const res = await fetch(origin(port) + path, { method, signal, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401) { await forget(); throw new Error("not_paired"); }
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.status === 204 ? null : res.json();
}
const forget = () => store.set({ token: null, port: null, shared: {} });

async function pair(input) {
  const code = normalizeCode(input);
  if (!code) throw new Error("bad_code");
  for (const port of PORTS) {
    let res;
    try { res = await fetch(`${origin(port)}/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }); } catch { continue; }
    if (res.status === 403) throw new Error("wrong_code");
    if (!res.ok) continue;
    await store.set({ token: (await res.json()).token, port, shared: {} });
    void loop();
    return;
  }
  throw new Error("app_not_running");
}

async function share(tab) {
  if (!tab || !shareableUrl(tab.url)) throw new Error("not_shareable");
  const { shared } = await load();
  await call("/share", { body: { id: tab.id, title: tab.title ?? "", url: tab.url } });
  await store.set({ shared: consentAdd(shared, tab) });
}

async function stop(tabId, notify = true) {
  const { shared } = await load();
  if (!consentHas(shared, tabId)) return;
  await store.set({ shared: consentRemove(shared, tabId) });
  if (notify) await call("/revoke", { body: { tabId } }).catch(() => {});
}

async function read(tabId) {
  const { shared } = await load();
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !consentValid(shared, tab)) throw new Error("tab_not_shared");
  // activeTab grants this script only on the tab the user shared, and only until it navigates.
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: () => document.body?.innerText ?? "" });
  return { title: tab.title ?? "", url: tab.url, text: clipText(result) };
}

async function handle(cmd) {
  if (cmd.type === "revoke") return stop(cmd.tabId, false);
  if (cmd.type !== "read") return;
  try { await call("/result", { body: { id: cmd.id, ok: true, ...(await read(cmd.tabId)) } }); }
  catch (e) {
    if (e.message === "tab_not_shared") await stop(cmd.tabId, false);
    await call("/result", { body: { id: cmd.id, ok: false, error: e.message } }).catch(() => {});
  }
}

async function loop() {
  if (looping) return;
  looping = true;
  try {
    for (;;) {
      const { token } = await load();
      if (!token) return;
      try {
        const { commands } = await call("/poll", { method: "GET", signal: AbortSignal.timeout(30_000) });
        for (const c of commands) await handle(c);
      } catch (e) {
        if (e.message === "not_paired") return;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  } finally { looping = false; }
}

async function disconnect() {
  await call("/disconnect", { body: {} }).catch(() => {});
  await forget();
}

async function state() {
  const { token, shared } = await load();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    paired: !!token,
    shared: Object.entries(shared).map(([id, t]) => ({ id: Number(id), ...t })),
    current: tab ? { id: tab.id, title: tab.title ?? "", url: tab.url ?? "", shareable: shareableUrl(tab.url), shared: consentHas(shared, tab.id) } : null,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  (async () => {
    if (msg.type === "pair") await pair(msg.code);
    else if (msg.type === "share") await share((await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
    else if (msg.type === "stop") await stop(msg.tabId);
    else if (msg.type === "disconnect") await disconnect();
    return state();
  })().then((s) => reply({ ok: true, state: s }), (e) => reply({ ok: false, error: e.message }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => void stop(tabId));
chrome.alarms.create("poll", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => void loop());
chrome.runtime.onStartup.addListener(() => void loop());
void loop();
