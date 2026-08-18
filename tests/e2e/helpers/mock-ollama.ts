import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const REPLY =
  'The agent loop is wired. I can see this workspace and I am ready to help.';

export async function startMockOllama(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    if (req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'llama3.1' }] }));
      return;
    }

    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let last = '';
        try {
          const parsed = JSON.parse(body || '{}') as {
            stream?: boolean;
            messages?: Array<{ role: string; content: string }>;
          };
          last = parsed.messages?.filter((m) => m.role === 'user').at(-1)?.content ?? '';
          const content = last ? `Echo: ${last.slice(0, 160)}\n\n${REPLY}` : REPLY;
          if (parsed.stream) {
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
            res.write(
              `${JSON.stringify({ model: 'llama3.1', message: { role: 'assistant', content }, done: false })}\n`
            );
            res.end(
              `${JSON.stringify({ model: 'llama3.1', message: { role: 'assistant', content: '' }, done: true })}\n`
            );
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              model: 'llama3.1',
              message: { role: 'assistant', content },
              done: true,
              prompt_eval_count: 8,
              eval_count: 24,
            })
          );
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'bad request' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
