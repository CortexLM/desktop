import assert from "node:assert/strict";
import { it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { remoteChatFetch } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/packages/desktop/src/remote-chat.ts";

it("does not classify a pinned Library entitlement refusal as authentication failure", async () => {
  // d6c71de1: library/index.ts:300–305; core/error.ts:19; billing/problem.ts:59–68.
  // Native Request/Response, injected transport only. No network or credentials.
  const origin = "https://contract.example.test";
  let invalidated = false;
  const error = await remoteChatFetch(new Request(`${origin}/v1/library`, { method: "POST", body: new Uint8Array([1]) }), {
    origin,
    signal: new AbortController().signal,
    check() {},
    unauthorized() { invalidated = true; },
    fetch: async () => new Response(JSON.stringify({
      type: "https://docs.cortex.foundation/problems/entitlement_required",
      code: "entitlement_required", status: 403, title: "Your plan does not include this", request_id: "contract-fixture",
      entitlement: "attachment_bytes",
    }), { status: 403, headers: { "content-type": "application/problem+json" } }),
  }).catch((e: unknown) => e);
  assert.equal(invalidated, false);
  assert.ok(error instanceof Error);
  assert.equal((error as Error & { code: string }).code, "provider_error");
});
