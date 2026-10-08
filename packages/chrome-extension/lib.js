// Pure helpers shared by the service worker and the popup (and unit-tested from the desktop repo).
export const PORTS = [47821, 47822, 47823, 47824, 47825];
export const MAX_TEXT = 50_000;
const CODE_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** Only plain web pages can be shared: never chrome://, file:, extension pages or URLs with embedded credentials. */
export function shareableUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** "abcd-2345" -> "ABCD2345"; null when it cannot be a pairing code. */
export function normalizeCode(input) {
  const code = String(input ?? "").replace(/[\s-]/g, "").toUpperCase();
  return CODE_ALPHABET.test(code) ? code : null;
}

/** Consent state is a plain object keyed by tab id: { [tabId]: { title, url } }. Every function returns a new object. */
export const consentAdd = (state, tab) => shareableUrl(tab.url) ? { ...state, [tab.id]: { title: String(tab.title ?? "").slice(0, 300), url: tab.url } } : state;
export const consentRemove = (state, tabId) => { const rest = { ...state }; delete rest[tabId]; return rest; };
export const consentHas = (state, tabId) => Object.hasOwn(state, tabId);
/** A shared tab that navigated elsewhere is no longer the page the user agreed to share. */
export const consentValid = (state, tab) => consentHas(state, tab.id) && state[tab.id].url === tab.url;

/**
 * Tries each port in turn. Only a 403 whose JSON body says `permission_denied` is Cortex refusing the code;
 * any other 403 (another local service on that port) moves on. Returns { token, port }.
 */
export async function pairOnPorts(code, ports, fetchFn = fetch) {
  for (const port of ports) {
    let res;
    try { res = await fetchFn(`http://127.0.0.1:${port}/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }); } catch { continue; }
    if (res.status === 403) {
      const body = await res.json().catch(() => null);
      if (body?.error === "permission_denied") throw new Error("wrong_code");
      continue;
    }
    if (!res.ok) continue;
    return { token: (await res.json()).token, port };
  }
  throw new Error("app_not_running");
}

export const clipText = (text) => String(text ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT);
