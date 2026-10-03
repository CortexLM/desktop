// Prepared controlled fixture. Importing constants never starts the server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const protocol = 'cortex-terminal-state-native-v1', key = 'sk-test-terminal-state';
export const prompt = (theme, turn) => `Cortex ${theme} Code ${turn}.`;
export const answer = theme => `Recovered ${theme} Code task.`;
export const reasoning = theme => `Checking ${theme} recovery.`;
export const steps = [['light', 'fail'], ['light', 'recover'], ['dark', 'fail'], ['dark', 'recover']];

async function serve() {
  assert.equal(process.platform, 'darwin');
  const root = fs.realpathSync(process.argv[2]);
  assert(/^\/(?:private\/)?tmp\/opencode\/desktop-terminal-state-[\w.-]+$/.test(root));
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
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    assert.equal(counts.errors, 0); assert(requests.length < steps.length && requests.every(row => row.completed));
    assert.equal(body.tools, undefined); assert.equal(body.tool_choice, undefined);
    const [theme, turn] = steps[requests.length], expectedTurns = turn === 'recover' ? ['fail', 'recover'] : ['fail'];
    stage = 'exact-failed-user-replay';
    assert(body.messages.every(m => ['system', 'user'].includes(m.role)));
    const system = body.messages.filter(m => m.role === 'system'); assert.equal(system.length, 1);
    assert(text(system[0]).endsWith(`Working directory: ${root}`));
    const userTexts = body.messages.filter(m => m.role === 'user').map(text);
    assert.deepEqual(userTexts, expectedTurns.map(t => prompt(theme, t)));
    // Core retains the failed assistant/error locally; toModelMessages omits its empty content.
    const replayAnswers = body.messages.filter(m => m.role === 'assistant').map(text); assert.deepEqual(replayAnswers, []);
    const reasoningOptionFields = ['reasoning_effort', 'thinking', 'enable_thinking'].filter(name => name in body);
    assert.deepEqual(reasoningOptionFields, []);
    const row = { theme, turn, userTexts, replayAnswers, modelExact: true, authorizationExact: true, workingDirectoryExact: true,
      toolsAbsent: true, reasoningOptionFields, httpStatus: turn === 'fail' ? 401 : 200,
      outputFields: turn === 'fail' ? [] : ['reasoning_content', 'content'],
      ...(turn === 'recover' ? { reasoningText: reasoning(theme), answerText: answer(theme) } : {}), completed: false };
    requests.push(row); save();
    if (turn === 'fail') {
      stage = 'expected-auth-failure'; await pause(250); assert(!res.destroyed);
      json(res, { error: { message: 'Controlled credential refusal', type: 'authentication_error', code: 'invalid_api_key' } }, 401);
      row.completed = true; save(); return;
    }
    stage = 'reasoning-then-text-stream'; res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const send = (delta, finish_reason = null, usage) => { assert(!res.destroyed); res.write(`data: ${JSON.stringify({ id: `terminal-${theme}-${turn}`, object: 'chat.completion.chunk', created: 1, model: 'reasoner', choices: [{ index: 0, delta, finish_reason }], ...(usage ? { usage } : {}) })}\n\n`); };
    send({ role: 'assistant' }); await pause(120);
    for (const [field, value] of [['reasoning_content', row.reasoningText], ['content', row.answerText]]) {
      for (const word of value.split(/(?<= )/)) { send({ [field]: word }); await pause(60); }
    }
    send({}, 'stop', { prompt_tokens: 120, completion_tokens: 40 }); res.end('data: [DONE]\n\n'); row.completed = true; save();
  })().catch(error => { counts.errors++; failures.push({ stage, requestIndex: requests.length, message: `Controlled fixture failed at ${stage}`, stack: String(error?.stack ?? '').split('\n').filter(line => /^\s+at /.test(line)).join('\n').replaceAll(key, '[redacted-test-key]') }); save(); if (!res.headersSent) json(res, { error: { message: 'Controlled terminal-state fixture refused the request' } }, 422); else res.end(); }); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9456, '127.0.0.1', resolve); }); save();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { server.closeAllConnections(); server.close(() => { save(); process.exit(0); }); });
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  await serve().catch(() => { console.error('Controlled terminal-state fixture failed'); process.exitCode = 1; });
}
