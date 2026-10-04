import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { createCortexClient } from '@cortex/sdk';

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
const file = new File([bytes], 'fixture.png', { type: 'image/png' });
const metadata = { id: 'bgs_fixture', filename: file.name, content_type: file.type, byte_size: bytes.length };
const body = { message: 'fixture', model_slug: 'operator/fixture', reasoning_effort: 'high', attachment_ids: ['lbf_fixture'] };
const cnv = 'cnv_01h45ytscbeewvwm6xr90nbxp4';
const msg = 'msg_01h45ytscbeewvwm6xr90nbxp4';
const events = [
  { type: 'image_generation', generation_id: 'fixture-generation', status: 'generating' },
  { type: 'done', message_id: msg, finish_reason: 'stop' },
  { type: 'image_generation', generation_id: 'fixture-generation', status: 'done', file_id: 'lbf_01h45ytscbeewvwm6xr90nbxp4', filename: file.name, content_type: file.type, byte_size: bytes.length },
];
const seen = [], failures = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    seen.push({ method: req.method, path: url.pathname });
    assert.equal(req.method, 'POST');
    if (url.pathname === '/v1/auth/magic-auth/verify') {
      assert.deepEqual(JSON.parse(raw), { email: 'fixture@example.test', code: '123456' });
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'cortex_rt=fixture-only; Path=/' });
      res.end(JSON.stringify({ status: 'session', access_token: 'fixture-only-token' }));
    } else {
      assert.equal(req.headers.authorization, 'Bearer fixture-only-token');
      assert.equal(req.headers.cookie, 'cortex_rt=fixture-only');
      if (url.pathname === '/v1/library' || url.pathname === '/v1/feedback/bugs/screenshots') {
        assert.equal(url.searchParams.get('filename'), file.name);
        assert.equal(req.headers['content-type'], 'application/octet-stream');
        assert.deepEqual(new Uint8Array(raw), bytes);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(url.pathname === '/v1/library' ? { ...metadata, id: 'lbf_fixture' } : metadata));
      } else {
        assert.equal(url.pathname, '/v1/conversations/turns');
        assert.equal(req.headers['idempotency-key'], 'fixture-native-key');
        assert.equal(req.headers['content-type'], 'application/json');
        assert.deepEqual(JSON.parse(raw), body);
        res.writeHead(200, { 'content-type': 'text/event-stream', 'x-conversation-id': cnv, 'x-message-id': msg });
        res.end(events.map((e, i) => `id: ${i + 1}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''));
      }
    }
  } catch (error) {
    failures.push(error);
    res.destroy();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  let authResponses = 0;
  const client = createCortexClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, cookieJar: true, fetch: async (req) => {
    const res = await fetch(req);
    if (req.url.includes('/v1/auth/')) {
      authResponses++;
      res.clone = () => assert.fail('Native successful auth must not clone');
    }
    return res;
  } });
  assert.equal((await client.auth.magicAuth.verify.create({ body: { email: 'fixture@example.test', code: '123456' } })).status, 'session');
  assert.equal((await client.library.create({ body: file, query: { filename: file.name } })).id, 'lbf_fixture');
  assert.deepEqual(await client.feedback.bugs.screenshots.create({ body: file, query: { filename: file.name } }), metadata);
  const frames = [], cursors = [];
  let headerCount = 0;
  for await (const event of client.streamTurn({ body, idempotencyKey: 'fixture-native-key' }, {
    maxReconnects: 0,
    onResponse(res) {
      assert.equal(res.headers.get('x-conversation-id'), cnv);
      assert.equal(res.headers.get('x-message-id'), msg);
      headerCount++;
    },
    onEventId: (id) => cursors.push(id),
  })) frames.push(event);
  assert.deepEqual(frames, events);
  assert.deepEqual(cursors, ['1', '2', '3']);
  assert.equal(headerCount, 1);
  assert.equal(authResponses, 1);
  assert.equal(seen.length, 4);
  assert.deepEqual(failures, []);
  const result = { result: 'PASS', runtime: process.version, nativeFetch: true, scope: 'Loopback fixture HTTP only; not Cortex backend/inference', successfulAuthCloneCalls: 0, requests: seen, frames: frames.length, finalCursor: cursors.at(-1), verifiedAdmissionHeaders: ['x-conversation-id', 'x-message-id'], rawUploads: ['Library', 'screenshot'], identityContinuation: 'bearer plus cookie preserved' };
  writeFileSync(new URL('./native-http.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}
