import { describe, expect, it, vi } from "vitest";
import { chatFeatureFetch } from "../src/remote-chat-features";

const origin = "https://api.example.test";
const conversation = "cnv_01J0000000000000000000000A";
const owner = (fetch: typeof globalThis.fetch, unauthorized = vi.fn()) => ({ origin, fetch, signal: new AbortController().signal, check: () => {}, unauthorized });

describe("remote chat feature transport", () => {
  it("builds allowlisted URLs with validated segments and the search query", async () => {
    const seen: Request[] = [];
    const fetch = vi.fn(async (r: RequestInfo | URL) => { seen.push(r as Request); return Response.json({ items: [] }); }) as unknown as typeof globalThis.fetch;
    await chatFeatureFetch({ epoch: "e", op: "share.create", params: { conversation } }, owner(fetch));
    await chatFeatureFetch({ epoch: "e", op: "search", q: "a b" }, owner(fetch));
    expect(seen[0]!.url).toBe(`${origin}/v1/conversations/${conversation}/shares`);
    expect(seen[0]!.method).toBe("POST");
    expect(seen[1]!.url).toBe(`${origin}/v1/search?q=a+b`);
  });
  it("refuses bad segments, stray params and a query outside search before any request", async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    await expect(chatFeatureFetch({ epoch: "e", op: "messages", params: { conversation: "../me" } }, owner(fetch))).rejects.toThrow();
    await expect(chatFeatureFetch({ epoch: "e", op: "shares", params: { conversation } }, owner(fetch))).rejects.toThrow();
    await expect(chatFeatureFetch({ epoch: "e", op: "shares", q: "x" }, owner(fetch))).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("maps 401 to sign-in invalidation", async () => {
    const unauthorized = vi.fn();
    const fetch = vi.fn(async () => new Response("", { status: 401 })) as unknown as typeof globalThis.fetch;
    await expect(chatFeatureFetch({ epoch: "e", op: "shares" }, owner(fetch, unauthorized))).rejects.toThrow();
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
