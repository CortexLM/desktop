// Prepared only. Constants are inert; the explicit CLI entry starts the leased-Mac fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
export const protocol = 'cortex-files-native-v1', key = 'sk-test-files-native';
export const prompt = 'Inspect this saved local portrait.', answer = 'The controlled portrait has three horizontal bands.', reasoning = 'Checking the saved image.';
export const filename = 'Cortex native portrait.png', model = { providerID: 'fake', modelID: 'reasoner' };
// Offline Python stdlib encoder: RGB8, filter 0, 120x180; red/blue/red 60-row bands; tEXt metadata retained.
export const png = 'iVBORw0KGgoAAAANSUhEUgAAAHgAAAC0CAIAAADQLH9KAAAALHRFWHREZXNjcmlwdGlvbgBDb3J0ZXggbmF0aXZlIHR3by1jb2xvciBwb3J0cmFpdA8rbgEAAAEYSURBVHja7dwBDQAgCABBqpjCEsYxGHGMYwvGxm2f4AJ8vLNVUCAADVqgQYOmABq0QIMGTQE0aIEGDVqgQQs0aNACDVqgQYMWaNACDRq0QIMWaNCgBRq0QIMGLdCgBRo0aIEGLdCgQQs0aIEGDVqgQQt0M+h1UwWBBg1aoEGDRgAatECDBk0BNGiBBg2aAmjQAg0atECDFmjQoAUatECDBi3QoAUaNGiBBi3QoEELNGiBBg1aoEELNGjQAg1aoEGDFmjQAt0N2p7VbRe0QIMGTQE0aIEGDZoCaNACDRq0QIMWaNCgBRq0QIMGLdCgBRo0aIEGLdCgQQs0aIEGDVqgQQs0aNACDVqgQYMWaNACDRq0QIMWaNAj+xGx+eKL911tAAAAAElFTkSuQmCC';
export const fixture = { bytes: 393, width: 120, height: 180, sha256: '35d49e647469369311f7f223d9e340034f77a96cceee1f27f5ebff8bbe3174cf', rgb: [[216, 76, 55], [33, 116, 176], [216, 76, 55]] };
const sha = value => createHash('sha256').update(value).digest('hex');
export function validateFixture() {
  const bytes = Buffer.from(png, 'base64'); assert.equal(bytes.length, fixture.bytes); assert.equal(sha(bytes), fixture.sha256); assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
  const chunks = []; for (let at = 8; at < bytes.length;) { const n = bytes.readUInt32BE(at), end = at + 8 + n; assert(end + 4 <= bytes.length); let crc = 0xffffffff; for (const b of bytes.subarray(at + 4, end)) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } assert.equal((crc ^ 0xffffffff) >>> 0, bytes.readUInt32BE(end)); chunks.push([bytes.toString('ascii', at + 4, at + 8), bytes.subarray(at + 8, end)]); at = end + 4; }
  assert.deepEqual(chunks.map(c => c[0]), ['IHDR', 'tEXt', 'IDAT', 'IEND']); assert.equal(chunks[0][1].toString('hex'), '00000078000000b40802000000'); assert.equal(chunks[1][1].toString(), 'Description\0Cortex native two-color portrait'); assert.equal(chunks[3][1].length, 0);
  const raw = inflateSync(chunks[2][1], { maxOutputLength: 64980 }); assert.equal(raw.length, 64980); for (let y = 0; y < 180; y++) { const at = y * 361; assert.equal(raw[at], 0); for (let x = 0; x < 360; x++) assert.equal(raw[at + 1 + x], fixture.rgb[Math.floor(y / 60)][x % 3]); } return bytes;
}
async function serve() {
  assert.equal(process.platform, 'darwin'); assert.equal(process.argv.length, 3); validateFixture(); const root = fs.realpathSync(process.argv[2]); assert(/^\/(?:private\/)?tmp\/opencode\/desktop-files-native-[\w.-]+$/.test(root));
  const receipt = `${root}/backend-receipt.json`; fs.closeSync(fs.openSync(receipt, 'wx', 0o600));
  const health = { protocol, root, runID: randomUUID(), pid: process.pid, platform: process.platform, port: 9456, scriptSHA256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), fixture };
  const requests = [], failures = [], counts = { catalog: 0, health: 0, receipt: 0, inference: 0, errors: 0 }, snapshot = () => ({ ...health, counts, requests, failures });
  const save = () => { const text = JSON.stringify(snapshot()) + '\n'; assert(Buffer.byteLength(text) <= 32768); fs.writeFileSync(receipt, text, { mode: 0o600 }); };
  const json = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  const catalog = { fake: { id: 'fake', name: 'Cortex test provider', env: ['CORTEX_NATIVE_TEST_KEY'], npm: '@ai-sdk/openai-compatible', api: 'http://127.0.0.1:9456/v1', models: {
    reasoner: { id: 'reasoner', name: 'Cortex image fixture', reasoning: true, attachment: true, tool_call: false, modalities: { input: ['text', 'image'], output: ['text'] }, limit: { context: 100000, output: 4000 }, cost: { input: 0, output: 0 } },
  } } };
  const server = http.createServer((req, res) => { let stage = 'loopback'; void (async () => {
    assert.equal(req.headers.host, '127.0.0.1:9456'); assert.equal(req.headers.origin, undefined); assert.equal(req.headers.cookie, undefined);
    if (req.method === 'GET' && ['/catalog', '/health', '/receipt'].includes(req.url)) { const name = req.url.slice(1); assert.equal(req.headers.authorization, undefined); assert(++counts[name] <= 200); save(); return json(res, name === 'catalog' ? catalog : name === 'health' ? health : snapshot()); }
    stage = 'inference-admission'; assert.equal(req.method, 'POST'); assert.equal(req.url, '/v1/chat/completions'); assert.equal(++counts.inference, 1); assert.equal(counts.errors, 0); assert.equal(req.headers.authorization, `Bearer ${key}`); assert.equal(req.headers['content-type']?.split(';')[0], 'application/json');
    const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; assert(size <= 65536); chunks.push(chunk); }
    stage = 'exact-image-body'; const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); assert.equal(body.model, 'reasoner'); assert.equal(body.stream, true); assert.equal(body.tools, undefined); assert.equal(body.tool_choice, undefined);
    assert.deepEqual(body.messages, [{ role: 'system', content: 'You are Cortex, a capable assistant and coding agent. Use the available tools when they help; be concise and accurate.' }, { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } }] }]);
    assert.deepEqual(['reasoning_effort', 'thinking', 'enable_thinking'].filter(name => name in body), []);
    const row = { imageSHA256: fixture.sha256, imageBytes: fixture.bytes, modelExact: true, authorizationExact: true, messagesExact: true, toolsAbsent: true, httpStatus: 200, completed: false }; requests.push(row); save();
    stage = 'terminal-stream'; res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); const send = (delta, finish_reason = null, usage) => res.write(`data: ${JSON.stringify({ id: 'files-native-1', object: 'chat.completion.chunk', created: 1, model: 'reasoner', choices: [{ index: 0, delta, finish_reason }], ...(usage ? { usage } : {}) })}\n\n`);
    send({ role: 'assistant' }); send({ reasoning_content: reasoning }); send({ content: answer }); send({}, 'stop', { prompt_tokens: 120, completion_tokens: 40 }); res.end('data: [DONE]\n\n'); row.completed = true; save();
  })().catch(() => { counts.errors++; if (failures.length < 8) failures.push({ stage, requestIndex: counts.inference }); save(); if (!res.headersSent) json(res, { error: { message: 'Controlled image fixture refused the request' } }, 422); else res.end(); }); });
  server.requestTimeout = 10000; server.headersTimeout = 10000; await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9456, '127.0.0.1', resolve); }); save();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { server.closeAllConnections(); server.close(() => { save(); process.exit(0); }); });
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) await serve().catch(() => { console.error('Controlled image fixture failed'); process.exitCode = 1; });
