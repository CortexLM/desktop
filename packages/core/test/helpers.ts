import { readFileSync } from "node:fs"
import { createServer, type IncomingMessage } from "node:http"
import { join } from "node:path"
import { createCore, memoryCredentials, type CoreOptions } from "../src/index"

export const fixture = () => JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "catalog.json"), "utf8")) as Record<string, any>

type Delta = { content?: string; reasoning_content?: string; tool_calls?: unknown[] }
export type Turn = { deltas: Delta[]; finish: "stop" | "tool_calls"; usage?: { prompt_tokens: number; completion_tokens: number } }

export const toolCall = (id: string, name: string, args: unknown): Delta => ({
  tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
})

/** Minimal OpenAI-compatible `/chat/completions` SSE server driven by a list of scripted turns. */
export async function fakeOpenAI(turns: Turn[]) {
  const requests: any[] = []
  const server = createServer(async (req: IncomingMessage, res) => {
    let raw = ""
    for await (const c of req) raw += c
    const body = JSON.parse(raw || "{}")
    requests.push(body)
    const turn = turns.shift() ?? { deltas: [{ content: "(no script)" }], finish: "stop" as const }
    res.writeHead(200, { "content-type": "text/event-stream" })
    const chunk = (delta: Delta, finish: string | null = null, usage?: unknown) =>
      res.write(`data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }], ...(usage ? { usage } : {}) })}\n\n`)
    chunk({ role: "assistant" } as Delta)
    for (const d of turn.deltas) chunk(d)
    chunk({}, turn.finish, turn.usage ?? { prompt_tokens: 100, completion_tokens: 20 })
    res.end("data: [DONE]\n\n")
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`
  return { url, requests, close: () => new Promise<void>((r) => (server.closeAllConnections(), server.close(() => r()))) }
}

export function testCore(baseURL: string, extra: Partial<CoreOptions> = {}) {
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials({ fake: "sk-test-1234" }), ...extra })
  const cat = fixture()
  cat.fake.api = baseURL
  core.catalog.set(cat)
  return core
}
