// Controlled native fixture; importing constants does not start a server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const protocol = 'cortex-live-state-native-v2', key = 'sk-test-live-state';
export const prompt = (theme, turn, owner = 'chat') => `Cortex native ${theme} ${owner === 'chat' ? '' : `${owner} `}${turn}.`;
export const answer = (theme, turn, owner = 'chat') => `Confirmed ${theme} ${owner === 'chat' ? '' : `${owner} `}${turn} turn.`;
export const reasoning = (theme, turn, owner = 'chat') => `Checking ${theme} ${owner === 'chat' ? '' : `${owner} `}${turn} turn.`;
export const turns = ['older', 'newer'];
const steps = [['light', 'chat', 'older'], ['light', 'chat', 'newer'], ['dark', 'chat', 'older'], ['dark', 'chat', 'newer'],
  ['light', 'Alpha', 'first'], ['light', 'Beta', 'older'], ['light', 'Beta', 'newer'], ['dark', 'Alpha', 'first'], ['dark', 'Beta', 'older'], ['dark', 'Beta', 'newer']];
async function serve() {
  assert.equal(process.platform, 'darwin');
  const root = fs.realpathSync(process.argv[2]);
  assert(/^\/(?:private\/)?tmp\/opencode\/desktop-live-state-[\w.-]+$/.test(root));
  const receipt = `${root}/backend-receipt.json`; fs.closeSync(fs.openSync(receipt, 'wx', 0o600));
  const health = { protocol, root, runID: randomUUID(), pid: process.pid, platform: process.platform, port: 9456,
    scriptSHA256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex') };
  const requests = [], failures = [], counts = { catalog: 0, health: 0, receipt: 0, errors: 0 };
  const snapshot = () => ({ ...health, counts, requests, failures });
  const save = () => fs.writeFileSync(receipt, JSON.stringify(snapshot()) + '\n', { mode: 0o600 });
  const json = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  const catalog = { fake: { id: 'fake', name: 'Cortex test provider', env: ['CORTEX_NATIVE_TEST_KEY'], npm: '@ai-sdk/openai-compatible', api: 'http://127.0.0.1:9456/v1', models: {
    reasoner: { id: 'reasoner', name: 'Reasoner Large', reasoning: true, reasoning_options: [{ type: 'toggle' }], attachment: false, tool_call: false,
      modalities: { input: ['text'], output: ['text'] }, limit: { context: 100000, output: 4000 }, cost: { input: 0, output: 0 } },
  } } };
  const text = message => typeof message.content === 'string' ? message.content : (assert(Array.isArray(message.content) && message.content.every(p => p.type === 'text' && typeof p.text === 'string')), message.content.map(p => p.text).join(''));
  const server = http.createServer((req, res) => { let stage = 'loopback-request'; void (async () => {
    assert.equal(req.headers.host, '127.0.0.1:9456'); assert.equal(req.headers.origin, undefined); assert.equal(req.headers.cookie, undefined);
    if (req.method === 'GET' && ['/catalog', '/health', '/receipt'].includes(req.url)) {
      const name = req.url.slice(1); assert.equal(req.headers.authorization, undefined); assert(++counts[name] <= 500); save();
      return json(res, name === 'catalog' ? catalog : name === 'health' ? health : snapshot());
    }
    stage = 'inference-route-and-authorization'; assert.equal(req.method, 'POST'); assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, `Bearer ${key}`); assert.equal(req.headers['content-type']?.split(';')[0], 'application/json');
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; assert(size <= 262144); chunks.push(chunk); }
    stage = 'inference-body-model-order'; const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert(body && body.model === 'reasoner' && body.stream === true && Array.isArray(body.messages));
    assert(requests.length < steps.length && requests.every(row => row.completed));
    const [theme, owner, turn] = steps[requests.length], scenario = owner === 'chat' ? 'chat' : 'bot';
    const userTexts = body.messages.filter(m => m.role === 'user').map(text), replayAnswers = body.messages.filter(m => m.role === 'assistant').map(text);
    const expectedTurns = turn === 'newer' ? turns : [turn];
    stage = 'exact-owned-user-and-assistant-history'; assert.deepEqual(userTexts, expectedTurns.map(t => prompt(theme, t, owner)));
    assert.deepEqual(replayAnswers, turn === 'newer' ? [answer(theme, 'older', owner)] : []);
    const reasoningOptionFields = ['reasoning_effort', 'thinking', 'enable_thinking'].filter(name => name in body);
    assert.deepEqual(reasoningOptionFields, []); // Compatible providers enable reasoning through response deltas.
    const row = { scenario, theme, owner, turn, userTexts, replayAnswers, modelExact: true, authorizationExact: true, reasoningOptionFields,
      outputFields: ['reasoning_content', 'content'], reasoningText: reasoning(theme, turn, owner), answerText: answer(theme, turn, owner), completed: false };
    stage = 'reasoning-then-text-stream'; requests.push(row); save(); res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const send = (delta, finish_reason = null, usage) => { assert(!res.destroyed); res.write(`data: ${JSON.stringify({ id: `native-${theme}-${owner}-${turn}`, object: 'chat.completion.chunk', created: 1, model: 'reasoner', choices: [{ index: 0, delta, finish_reason }], ...(usage ? { usage } : {}) })}\n\n`); };
    send({ role: 'assistant' });
    for (const [field, value, delay] of [['reasoning_content', row.reasoningText, 60], ['content', row.answerText, 40]]) {
      for (const word of value.split(/(?<= )/)) { send({ [field]: word }); await new Promise(resolve => setTimeout(resolve, delay)); }
    }
    send({}, 'stop', { prompt_tokens: 120, completion_tokens: 40 }); res.end('data: [DONE]\n\n'); row.completed = true; save();
  })().catch(error => { counts.errors++; failures.push({ stage, requestIndex: requests.length, message: `Controlled fixture failed at ${stage}`, stack: String(error?.stack ?? '').split('\n').filter(line => /^\s+at /.test(line)).join('\n').replaceAll(key, '[redacted-test-key]') }); save(); if (!res.headersSent) json(res, { error: { message: 'Controlled transcript fixture refused the request' } }, 422); else res.end(); }); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9456, '127.0.0.1', resolve); }); save();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { server.closeAllConnections(); server.close(() => { save(); process.exit(0); }); });
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  await serve().catch(() => { console.error('Controlled transcript fixture failed'); process.exitCode = 1; });
}
