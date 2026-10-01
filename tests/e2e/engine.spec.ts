// The renderer's IPC bridge reaches the in-process engine: models.dev catalog, write-only key, streamed exchange.
import { test as base, expect } from "@playwright/test";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const test = base;

test("models.dev catalog is listed and searchable through the bridge", async () => {
  const { app, page } = await launch();
  const r = await page.evaluate(async () => {
    const j = async (u: string) => (await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(u)).json();
    const providers = await j("cortex://local/api/catalog/providers");
    const hits = await j("cortex://local/api/catalog/search?q=claude&limit=5");
    return { providers: providers.length, anthropic: providers.some((p: { id: string }) => p.id === "anthropic"), hits: hits.map((m: { id: string; capabilities: { reasoning: boolean } }) => [m.id, m.capabilities.reasoning]) };
  });
  expect(r.providers).toBeGreaterThan(50);
  expect(r.anthropic).toBe(true);
  expect(r.hits.length).toBeGreaterThan(0);
  await app.close();
});

test("streamed exchange with a thinking- and image-capable model", async () => {
  const fake = await startFakeProvider();
  const { app, page } = await launch({ env: { CORTEX_TEST_PROVIDER_BASEURL: `zai=${fake.url}` } });
  const result = await page.evaluate(async (png) => {
    const call = async (u: string, init?: RequestInit) => { const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local" + u, init); return r.status === 204 ? null : r.json(); };
    const json = (method: string, body: unknown) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const models = await call("/api/catalog/providers/zai/models");
    const model = models.find((m: { capabilities: { reasoning: boolean; imageInput: boolean } }) => m.capabilities.reasoning && m.capabilities.imageInput);
    await call("/api/providers/zai/key", json("PUT", { key: "sk-test-123456" }));
    const cfg = await call("/api/providers/zai");
    const session = await call("/api/sessions", json("POST", { kind: "chat", model: { providerID: "zai", modelID: model.id } }));
    const deltas: string[] = [];
    const events = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local/api/events");
    const reader = events.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const done = (async () => {
      for (;;) {
        const { value, done } = await reader.read(); if (done) return;
        buf += dec.decode(value);
        for (const frame of buf.split("\n\n").slice(0, -1)) {
          const data = frame.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!data) continue;
          const e = JSON.parse(data);
          if (e.type === "part.delta" && e.properties.sessionID === session.id) deltas.push(e.properties.field);
          if (e.type === "session.status" && e.properties.sessionID === session.id && e.properties.status.type === "idle" && deltas.length) return;
        }
        buf = buf.slice(buf.lastIndexOf("\n\n") + 2);
      }
    })();
    await call(`/api/sessions/${session.id}/prompt`, json("POST", { reasoning: true, parts: [{ type: "text", text: "What is in this picture?" }, { type: "file", mime: "image/png", url: png, filename: "dot.png" }] }));
    await Promise.race([done, new Promise((r) => setTimeout(r, 20000))]);
    void reader.cancel();
    const msgs = await call(`/api/sessions/${session.id}/messages`);
    return { model: model.id, hasKey: cfg.hasKey, keyHint: cfg.keyHint, cfgKeys: Object.keys(cfg), deltas, parts: msgs.flatMap((m: { info: { role: string }; parts: { type: string; text?: string }[] }) => m.parts.map((p) => [m.info.role, p.type, p.text ?? ""])) };
  }, PNG);
  expect(result.hasKey).toBe(true);
  expect(result.cfgKeys).not.toContain("key");
  expect(JSON.stringify(result)).not.toContain("sk-test-123456");
  expect(result.deltas).toContain("reasoning");
  expect(result.deltas).toContain("text");
  expect(result.deltas.indexOf("reasoning")).toBeLessThan(result.deltas.indexOf("text"));
  expect(result.parts).toContainEqual(["user", "file", ""]);
  expect(result.parts.find((p: string[]) => p[0] === "assistant" && p[1] === "reasoning")).toBeTruthy();
  expect(result.parts.find((p: string[]) => p[0] === "assistant" && p[1] === "text")?.[2]).toContain("I can see the attached image");
  const sent = fake.requests[0].body as { model: string; messages: { role: string; content: unknown }[] };
  expect(sent.model).toBe(result.model);
  expect(fake.requests[0].auth).toBe("Bearer sk-test-123456");
  expect(JSON.stringify(sent.messages)).toContain("image_url");
  await app.close(); await fake.close();
});

test("an image is refused for a model without image input", async () => {
  const { app, page } = await launch();
  const r = await page.evaluate(async (png) => {
    const call = async (u: string, init?: RequestInit) => (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local" + u, init);
    const json = (method: string, body: unknown) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const models = await (await call("/api/catalog/providers/deepseek/models")).json();
    const textOnly = models.find((m: { capabilities: { imageInput: boolean } }) => !m.capabilities.imageInput);
    await call("/api/providers/deepseek/key", json("PUT", { key: "sk-x" }));
    const s = await (await call("/api/sessions", json("POST", { kind: "chat", model: { providerID: "deepseek", modelID: textOnly.id } }))).json();
    const res = await call(`/api/sessions/${s.id}/prompt`, json("POST", { parts: [{ type: "text", text: "hi" }, { type: "file", mime: "image/png", url: png }] }));
    return { status: res.status, body: await res.json() };
  }, PNG);
  expect(r.body.error.code).toBe("model_no_image_input");
  await app.close();
});
