import { describe, expect, it, vi } from "vitest";
import { contractFetch } from "../src/remote-contracts";

const origin = "https://api.example.test";
const session = "cnv_01J0000000000000000000000A";
const owner = (fetch: typeof globalThis.fetch, unauthorized = vi.fn()) => ({ origin, fetch, signal: new AbortController().signal, check: () => {}, unauthorized });

describe("remote contract transport", () => {
  it("builds the allowlisted URL with validated segments and returns the JSON body", async () => {
    const seen: Request[] = [];
    const fetch = vi.fn(async (r: RequestInfo | URL) => { seen.push(r as Request); return Response.json({ id: "c1" }, { status: 201 }); }) as unknown as typeof globalThis.fetch;
    const out = await contractFetch({ epoch: "e", op: "code.comments.add", params: { session }, body: { path: "a.ts", line: 1, side: "new", body: "x" } }, owner(fetch));
    expect(out).toEqual({ status: 201, data: { id: "c1" } });
    expect(seen[0]!.url).toBe(`${origin}/v1/code/sessions/${session}/diff/comments`);
    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.redirect).toBe("error");
  });
  it("refuses unknown operations, traversal and extra parameters before any request", async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    await expect(contractFetch({ epoch: "e", op: "code.nope", params: {} }, owner(fetch))).rejects.toThrow();
    await expect(contractFetch({ epoch: "e", op: "code.attempts", params: { session: "../../admin" } }, owner(fetch))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(contractFetch({ epoch: "e", op: "code.attempts", params: { session, extra: "x" } }, owner(fetch))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(contractFetch({ epoch: "e", op: "code.secrets.put", params: { runtime: "crt_01J0000000000000000000000A", secret: "lower" }, body: { value: "v" } }, owner(fetch))).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("routes the Todo 6b app operations with typed segments, query and text bodies", async () => {
    const seen: Request[] = [];
    const fetch = vi.fn(async (r: RequestInfo | URL) => { seen.push(r as Request); return new Response("# Note", { status: 200 }); }) as unknown as typeof globalThis.fetch;
    const file = "lbf_01J0000000000000000000000A";
    expect(await contractFetch({ epoch: "e", op: "app.file.content", params: { file } }, owner(fetch))).toEqual({ status: 200, data: "# Note" });
    expect(seen[0]!.url).toBe(`${origin}/v1/library/${file}/content`);
    const json = vi.fn(async (r: RequestInfo | URL) => { seen.push(r as Request); return Response.json({ items: [] }); }) as unknown as typeof globalThis.fetch;
    await contractFetch({ epoch: "e", op: "app.skills", params: {} }, owner(json));
    expect(seen[1]!.url).toBe(`${origin}/v1/skills?surface=chat`);
    await contractFetch({ epoch: "e", op: "app.permission.decide", params: { conversation: "cnv_01J0000000000000000000000A", prompt: "prm_01J0000000000000000000000A" }, body: { decision: "allow" } }, owner(json));
    expect(seen[2]!.method).toBe("POST");
    const none = vi.fn() as unknown as typeof globalThis.fetch;
    await expect(contractFetch({ epoch: "e", op: "app.share.preview", params: { token: "not-hex/.." } }, owner(none))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(contractFetch({ epoch: "e", op: "app.file", params: { file: "cnv_01J0000000000000000000000A" } }, owner(none))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(contractFetch({ epoch: "e", op: "app.channel", params: { channel: "x" } }, owner(none))).rejects.toMatchObject({ code: "invalid_request" });
    expect(none).not.toHaveBeenCalled();
  });
  it("maps refusals to neutral typed errors and signs out on 401", async () => {
    const unauthorized = vi.fn();
    const status = (s: number) => vi.fn(async () => Response.json({ detail: "secret producer text", box_error: "x" }, { status: s })) as unknown as typeof globalThis.fetch;
    await expect(contractFetch({ epoch: "e", op: "code.attempts", params: { session } }, owner(status(409)))).rejects.toMatchObject({ code: "conflict", message: expect.not.stringContaining("secret") });
    await expect(contractFetch({ epoch: "e", op: "code.attempts", params: { session } }, owner(status(403)))).rejects.toMatchObject({ code: "permission_denied" });
    await expect(contractFetch({ epoch: "e", op: "code.attempts", params: { session } }, owner(status(401), unauthorized))).rejects.toMatchObject({ code: "provider_auth_failed" });
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
