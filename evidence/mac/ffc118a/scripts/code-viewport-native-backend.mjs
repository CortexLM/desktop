// Shared fixture constants only on import. The standalone Mac entry point starts the backend.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const protocol = 'cortex-code-viewport-native-v1';
export const prompt = (runID, theme) => `Cortex Code viewport verification ${runID} ${theme}`;
export const callID = (runID, theme, index) => `viewport-${runID}-${theme}-${index}`;
export const files = theme => {
  assert(['light', 'dark'].includes(theme));
  return [
    { path: `short-${theme}.txt`, content: `SHORT ${theme}` },
    { path: `long-${theme}.txt`, content: Array.from({ length: 160 }, (_, i) => `line ${i}`).join('\n') + `\nDIFF END ${theme}` },
  ];
};

async function serve() {
  const [directory, receiptArg] = process.argv.slice(2);
  assert.equal(process.platform, 'darwin', 'Run the fixture on the leased Mac');
  assert(directory && receiptArg, 'Usage: node code-viewport-native-backend.mjs <isolated-mac-project> <fresh-mac-receipt.json>');
  const project = fs.realpathSync(directory);
  assert(/^\/(?:private\/)?tmp\/opencode\/desktop-recovery-[a-zA-Z0-9._-]+\/project$/.test(project));
  assert(fs.statSync(project).isDirectory());
  assert.equal(fs.realpathSync(path.dirname(receiptArg)), path.dirname(project));
  for (const theme of ['light', 'dark']) for (const file of files(theme)) {
    try { fs.lstatSync(path.join(project, file.path)); assert.fail('Fixture destination already exists'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const receipt = path.join(path.dirname(project), path.basename(receiptArg));
  fs.closeSync(fs.openSync(receipt, 'wx', 0o600));
  const runID = randomUUID(), requests = [], next = { light: 0, dark: 0 };
  let errors = 0;
  const health = { protocol, runID, project, platform: process.platform, port: 9458, destinationsInitiallyAbsent: true,
    startedAt: new Date().toISOString(), scriptSHA256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex') };
  const snapshot = () => ({ ...health, requests, errors });
  const save = () => fs.writeFileSync(receipt, `${JSON.stringify(snapshot(), null, 2)}\n`, { mode: 0o600 });
  const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const catalog = { fake: { id: 'fake', name: 'Cortex test provider', env: [], npm: '@ai-sdk/openai-compatible', api: 'http://127.0.0.1:9458/v1', models: {
    reasoner: { id: 'reasoner', name: 'Reasoner Large', family: 'reasoner', tool_call: true, reasoning: false, attachment: false,
      modalities: { input: ['text'], output: ['text'] }, limit: { context: 100000, output: 4000 } },
  } } };
  const server = http.createServer((req, res) => { void (async () => {
    assert.equal(req.headers.host, '127.0.0.1:9458'); assert.equal(req.headers.origin, undefined);
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, health);
    if (req.method === 'GET' && req.url === '/receipt') return json(res, 200, snapshot());
    if (req.method === 'GET' && req.url === '/catalog') return json(res, 200, catalog);
    assert.equal(req.method, 'POST'); assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.cookie, undefined);
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; assert(size <= 1024 * 1024); chunks.push(chunk); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert(body && body.model === 'reasoner' && body.stream === true && Array.isArray(body.messages));
    assert(Array.isArray(body.tools) && body.tools.some(tool => tool.function?.name === 'write'));
    const users = body.messages.filter(message => message.role === 'user').map(message => typeof message.content === 'string' ? message.content : Array.isArray(message.content) ? message.content.filter(part => part.type === 'text').map(part => part.text).join('') : '');
    const theme = ['light', 'dark'].find(value => users.length === 1 && users[0] === prompt(runID, value));
    assert(theme, 'Unexpected fixture prompt');
    const planned = files(theme), results = body.messages.filter(message => message.role === 'tool');
    assert(results.length <= 2 && results.length === next[theme], 'Duplicate or out-of-order inference');
    for (const [index, result] of results.entries()) {
      assert.equal(result.tool_call_id, callID(runID, theme, index)); assert.equal(typeof result.content, 'string');
      const value = JSON.parse(result.content), file = planned[index];
      assert.equal(value.title, file.path);
      assert.equal(value.output, `Wrote ${file.content.length} characters to ${path.join(project, file.path)}`);
    }
    const phase = ['short', 'long', 'complete'][results.length]; next[theme]++;
    requests.push({ index: requests.length + 1, theme, phase, toolResultCount: results.length, modelExact: true, toolResultsExact: true, authorizationPresent: !!req.headers.authorization }); save();
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: 'code-viewport-proof', object: 'chat.completion.chunk', created: 1, model: 'reasoner', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    send({ role: 'assistant' });
    if (results.length < 2) {
      send({ tool_calls: [{ index: 0, id: callID(runID, theme, results.length), type: 'function', function: { name: 'write', arguments: JSON.stringify(planned[results.length]) } }] });
      send({}, 'tool_calls');
    } else { send({ content: 'All files written.' }); send({}, 'stop'); }
    res.end('data: [DONE]\n\n');
  })().catch(() => {
    errors++; save();
    if (!res.headersSent) json(res, 422, { error: { message: 'Controlled viewport fixture rejected the request' } });
    else res.end();
  }); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9458, '127.0.0.1', resolve); });
  save(); console.log('Code viewport fixture listening on 127.0.0.1:9458');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { server.closeAllConnections(); server.close(() => { save(); process.exit(0); }); });
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  await serve().catch(() => { console.error('Code viewport fixture failed to start'); process.exitCode = 1; });
}
