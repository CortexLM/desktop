import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const version = '0.3.5';
const { createCortexClient, ApiError, IncompleteStreamError } = await import('@cortex/sdk');
const { ApiError: PublicError, IncompleteStreamError: PublicIncomplete, readStream } = await import('@cortex/api-types');
const results = [];
const baseUrl = 'https://instance.example';
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
const file = new File([bytes], 'fixture.png', { type: 'image/png' });
assert.equal(ApiError, PublicError);
assert.equal(IncompleteStreamError, PublicIncomplete);
results.push({ check: 'Paired public error constructors', result: 'PASS' });

const upload = createCortexClient({ baseUrl, cookieJar: false, fetch: async (request) => {
  assert.equal(new URL(request.url).pathname, '/v1/library');
  assert.equal(new URL(request.url).searchParams.get('filename'), file.name);
  assert.equal(request.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual(new Uint8Array(await request.arrayBuffer()), bytes);
  return Response.json({ id: 'lbf_fixture' });
} });
assert.equal((await upload.library.create({ body: file, query: { filename: file.name } })).id, 'lbf_fixture');
results.push({ check: 'Same Library binary and filename fixture', result: 'PASS', bytes: bytes.length });

const screenshotMetadata = { id: 'bgs_fixture', filename: file.name, content_type: file.type, byte_size: bytes.length };
const screenshot = createCortexClient({ baseUrl, cookieJar: false, fetch: async (request) => {
  assert.equal(new URL(request.url).pathname, '/v1/feedback/bugs/screenshots');
  assert.equal(new URL(request.url).searchParams.get('filename'), file.name);
  assert.equal(request.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual(new Uint8Array(await request.arrayBuffer()), bytes);
  return Response.json(screenshotMetadata);
} });
assert.deepEqual(await screenshot.feedback.bugs.screenshots.create({ body: file, query: { filename: file.name } }), screenshotMetadata);
results.push({ check: 'Same screenshot File bytes, now required filename and metadata', result: 'PASS', bytes: bytes.length, previous031: '{}' });

const events = [
  { type: 'image_generation', generation_id: 'fixture-generation', status: 'generating' },
  { type: 'done', message_id: 'msg_01h45ytscbeewvwm6xr90nbxp4', finish_reason: 'stop' },
  { type: 'image_generation', generation_id: 'fixture-generation', status: 'done', file_id: 'lbf_01h45ytscbeewvwm6xr90nbxp4', filename: 'fixture.png', content_type: 'image/png', byte_size: bytes.length },
];
const response = () => new Response(events.map((event, i) => `id: ${i + 1}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
const collect = async (stream) => { const out = []; for await (const event of stream) out.push(event); return out; };
const stream = createCortexClient({ baseUrl, cookieJar: false, fetch: async () => response() });
const parsed = await collect(readStream(response()));
const cursors = [];
const streamed = await collect(stream.streamTurn({ body: { message: 'fixture' }, idempotencyKey: 'fixture-key' }, { onEventId: (id) => cursors.push(id) }));
assert.deepEqual(streamed, parsed);
assert.equal(streamed.length, 3);
assert.equal(cursors.at(-1), '3');
results.push({ check: 'Identical three-frame post-done media fixture', result: 'PASS', parserFrames: parsed.length, helperFrames: streamed.length, finalCursor: cursors.at(-1), previous031: 2 });

const body = { message: 'fixture', model_slug: 'operator/fixture', reasoning_effort: 'high', attachment_ids: ['lbf_fixture'] };
const requests = [];
const generated = createCortexClient({ baseUrl, cookieJar: false, fetch: async (request) => {
  const entry = { path: new URL(request.url).pathname, method: request.method, body: await request.text(), contentType: request.headers.get('content-type'), key: request.headers.get('idempotency-key'), cursor: request.headers.get('last-event-id') };
  assert.equal(entry.method, 'POST');
  assert.equal(entry.body, JSON.stringify(body));
  assert.equal(entry.contentType, 'application/json');
  assert.equal(entry.key, 'fixture-original-key');
  assert.equal(entry.cursor, '2');
  requests.push(entry);
  return response();
} });
const options = { body, headers: { 'Idempotency-Key': 'fixture-original-key', 'Last-Event-ID': '2' } };
const streams = [
  await generated.conversations.turns.start(options),
  await generated.conversations.turns.create({ ...options, path: { id: 'cnv_fixture' } }),
  await generated.code.sessions.turns.create({ ...options, path: { id: 'cds_fixture' } }),
  await generated.conversations.messages.edit.create({ ...options, path: { id: 'cnv_fixture', message_id: 'msg_fixture' } }),
  await generated.conversations.messages.regenerate.create({ ...options, path: { id: 'cnv_fixture', message_id: 'msg_fixture' } }),
];
for (const stream of streams) { assert.ok(stream instanceof ReadableStream); await stream.cancel(); }
assert.deepEqual(requests.map((r) => r.path), ['/v1/conversations/turns', '/v1/conversations/cnv_fixture/turns', '/v1/code/sessions/cds_fixture/turns', '/v1/conversations/cnv_fixture/messages/msg_fixture/edit', '/v1/conversations/cnv_fixture/messages/msg_fixture/regenerate']);
results.push({ check: 'Five generated POST methods preserve JSON, identity headers, raw streams', result: 'PASS', calls: requests.length, declarationStatus: version === '0.3.2' ? 'body forbidden in TypeScript; JS transport probe only' : 'body accepted as unknown; separate positive TypeScript probe' });

const summary = { version, runtime: process.version, scope: 'Exact packed bytes; bounded local Fetch fixtures; no upstream suite/build/native/network', results };
writeFileSync(new URL('./consumer-check.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
