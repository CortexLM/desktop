import { describe, expect, it } from "vitest";
// @ts-expect-error plain ES module shipped in the extension
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
