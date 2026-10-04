import http from 'node:http';
import fs from 'node:fs';

const [receipt] = process.argv.slice(2);
const requests = [];
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
  let body = '';
  for await (const chunk of req) body += chunk;
  let message;
  try { message = JSON.parse(body); } catch { res.writeHead(400); res.end(); return; }
  requests.push({ method: message.method, credentialMatched: req.headers.authorization === 'private-header-value', pathMatched: req.url === '/private-path' });
  fs.writeFileSync(receipt, JSON.stringify({ requests }, null, 2) + '\n');
  if (message.id === undefined) { res.writeHead(204); res.end(); return; }
  const result = message.method === 'initialize'
    ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'cortex-test', version: '1' } }
    : { tools: [{ name: 'ping', description: 'Connection check', inputSchema: { type: 'object', properties: {} } }] };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
});
server.listen(9456, '127.0.0.1');
