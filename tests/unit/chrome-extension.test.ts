import { describe, expect, it } from "vitest";
import * as lib from "../../packages/chrome-extension/lib.js";

describe("chrome extension helpers", () => {
  it("shares only web pages", () => {
    expect(lib.shareableUrl("https://a.test/x")).toBe(true);
    for (const u of ["chrome://settings", "file:///x", "chrome-extension://abc/p.html", "https://u:p@a.test/", "x"]) expect(lib.shareableUrl(u)).toBe(false);
  });
  it("normalizes pairing codes", () => {
    expect(lib.normalizeCode("abcd-2345")).toBe("ABCD2345");
    for (const c of ["", "ABCD", "ABCD-234O", "ABCD23456"]) expect(lib.normalizeCode(c)).toBeNull();
  });
  it("pairing treats only a Cortex permission_denied 403 as a wrong code", async () => {
    const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
    const ports: number[] = [];
    const foreign = (async (url: string) => { ports.push(Number(new URL(url).port)); return ports.length === 1 ? reply(403, { error: "nope" }) : reply(200, { token: "t" }); }) as unknown as typeof fetch;
    await expect(lib.pairOnPorts("ABCD2345", [1, 2, 3], foreign)).resolves.toEqual({ token: "t", port: 2 });
    const denied = (async () => reply(403, { error: "permission_denied" })) as unknown as typeof fetch;
    await expect(lib.pairOnPorts("ABCD2345", [1, 2], denied)).rejects.toThrow("wrong_code");
    const down = (async () => { throw new Error("refused"); }) as unknown as typeof fetch;
    await expect(lib.pairOnPorts("ABCD2345", [1], down)).rejects.toThrow("app_not_running");
  });
  it("pairing skips silent or malformed services", async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener("abort", () => reject(new Error("timeout"))))) as unknown as typeof fetch;
    const mixed = (async (url: string, init: RequestInit) => {
      const port = Number(new URL(url).port);
      if (port === 1) return hang(url, init);
      if (port === 2) return new Response("<html>", { status: 200 });
      if (port === 3) return new Response(JSON.stringify({ token: 7 }), { status: 200 });
      return new Response(JSON.stringify({ token: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(lib.pairOnPorts("ABCD2345", [1, 2, 3, 4], mixed, 20)).resolves.toEqual({ token: "ok", port: 4 });
  });
  it("tracks consent per tab and drops it after navigation", () => {
    let s = lib.consentAdd({}, { id: 1, title: "A", url: "https://a.test/" });
    s = lib.consentAdd(s, { id: 2, title: "B", url: "chrome://x" });
    expect(Object.keys(s)).toEqual(["1"]);
    expect(lib.consentValid(s, { id: 1, url: "https://a.test/" })).toBe(true);
    expect(lib.consentValid(s, { id: 1, url: "https://b.test/" })).toBe(false);
    expect(lib.consentHas(lib.consentRemove(s, 1), 1)).toBe(false);
    expect(lib.consentHas(s, 1)).toBe(true);
  });
});
