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
    await expect(contractFetch({ epoch: "e", op: "plans.get", params: { plan: "tpl_../x" } }, owner(fetch))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(contractFetch({ epoch: "e", op: "plans.step.update", params: { plan: "tpl_01J0000000000000000000000A", step: "cnv_01J0000000000000000000000A" } }, owner(fetch))).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("routes task-plan step updates to the exact trunk path", async () => {
    const seen: Request[] = [];
    const fetch = vi.fn(async (r: RequestInfo | URL) => { seen.push(r as Request); return Response.json({ status: "done" }); }) as unknown as typeof globalThis.fetch;
    const plan = "tpl_01J0000000000000000000000A", step = "tps_01J0000000000000000000000B";
    await contractFetch({ epoch: "e", op: "plans.step.update", params: { plan, step }, body: { status: "done" } }, owner(fetch));
    expect(seen[0]!.url).toBe(`${origin}/v1/task-plans/${plan}/steps/${step}`);
    expect(seen[0]!.method).toBe("PATCH");
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
