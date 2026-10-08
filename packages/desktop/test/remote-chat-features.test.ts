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
  it("admits a tool turn from the response headers and returns owned images as data URLs", async () => {
    const seen: Request[] = [];
    const message = "msg_01J0000000000000000000000B", file = "lbf_01J0000000000000000000000C";
    const fetch = vi.fn(async (r: RequestInfo | URL) => {
      const req = r as Request; seen.push(req);
      if (req.url.endsWith("/content")) return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
      return new Response("data: {}\n\n", { headers: { "content-type": "text/event-stream", "x-conversation-id": conversation, "x-message-id": message } });
    }) as unknown as typeof globalThis.fetch;
    const body = { message: "Plan this", research: { action: "plan" as const } };
    const admitted = await chatFeatureFetch({ epoch: "e", op: "turn.start", body }, owner(fetch));
    expect(admitted.data).toEqual({ conversation_id: conversation, message_id: message });
    expect(seen[0]!.url).toBe(`${origin}/v1/conversations/turns`);
    expect(await seen[0]!.json()).toEqual(body);
    expect(seen[0]!.headers.get("idempotency-key")).toBeTruthy();
    const image = await chatFeatureFetch({ epoch: "e", op: "file.content", params: { file } }, owner(fetch));
    expect(image.data).toEqual({ url: "data:image/png;base64,iVBORw==" });
    await chatFeatureFetch({ epoch: "e", op: "library.images" }, owner(vi.fn(async (r: RequestInfo | URL) => { seen.push(r as Request); return Response.json({ items: [] }); }) as unknown as typeof globalThis.fetch));
    expect(seen.at(-1)!.url).toBe(`${origin}/v1/library?artifact_kind=image&limit=8`);
  });
  it("refuses malformed tool turns, temporary continuations and non-image content before or after the request", async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    await expect(chatFeatureFetch({ epoch: "e", op: "turn.start", body: { message: "x", model_slug: "m", extra: 1 } }, owner(fetch))).rejects.toThrow();
    await expect(chatFeatureFetch({ epoch: "e", op: "turn.continue", params: { conversation }, body: { message: "x", temporary: true } }, owner(fetch))).rejects.toThrow();
    await expect(chatFeatureFetch({ epoch: "e", op: "turn.start" }, owner(fetch))).rejects.toThrow();
    await expect(chatFeatureFetch({ epoch: "e", op: "shares", body: { message: "x" } }, owner(fetch))).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    const html = vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as unknown as typeof globalThis.fetch;
    await expect(chatFeatureFetch({ epoch: "e", op: "file.content", params: { file: "lbf_01J0000000000000000000000C" } }, owner(html))).rejects.toThrow();
  });
  it("maps 401 to sign-in invalidation", async () => {
    const unauthorized = vi.fn();
    const fetch = vi.fn(async () => new Response("", { status: 401 })) as unknown as typeof globalThis.fetch;
    await expect(chatFeatureFetch({ epoch: "e", op: "shares" }, owner(fetch, unauthorized))).rejects.toThrow();
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
