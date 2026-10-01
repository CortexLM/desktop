// OpenAI-compatible streaming endpoint for E2E: emits reasoning deltas then text deltas,
// and records each request so tests can assert what the engine sent (image parts, reasoning options).
import http from "node:http";

export type Recorded = { body: Record<string, unknown>; auth?: string };

export async function startFakeProvider() {
  const requests: Recorded[] = [];
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    if (req.url?.endsWith("/models")) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ data: [] })); return; }
    const body = JSON.parse(raw || "{}");
    requests.push({ body, auth: req.headers.authorization });
    const msgs = (body.messages ?? []) as { role: string; content: unknown }[];
    const last = msgs.filter((m) => m.role === "user").pop();
    const hasImage = Array.isArray(last?.content) && (last.content as { type: string }[]).some((p) => p.type === "image_url");
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    const send = (delta: Record<string, unknown>, finish: string | null = null, usage?: object) =>
      res.write(`data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }], ...(usage ? { usage } : {}) })}\n\n`);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    send({ role: "assistant" });
    for (const w of ["Looking ", "at ", "the ", "request", hasImage ? " and the image." : "."]) { send({ reasoning_content: w }); await wait(60); }
    const answer = hasImage ? "I can see the attached image. It is a small square picture." : "Hello from the streaming test provider. Everything works.";
    for (const w of answer.split(/(?<= )/)) { send({ content: w }); await wait(40); }
    send({}, "stop", { prompt_tokens: 120, completion_tokens: 40 });
    res.write("data: [DONE]\n\n"); res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/v1`, requests, close: () => new Promise<void>((r) => server.close(() => r())) };
}
