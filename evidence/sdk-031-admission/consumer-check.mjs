import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createCortexClient, ApiError, IncompleteStreamError } from '@cortex/sdk';
import { ApiError as PublicError, IncompleteStreamError as PublicIncomplete, readStream } from '@cortex/api-types';

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
results.push({ check: 'Library raw binary and filename', result: 'PASS', bytes: bytes.length });

let screenshotBody;
const screenshot = createCortexClient({ baseUrl, cookieJar: false, fetch: async (request) => {
  screenshotBody = await request.text();
  assert.equal(request.headers.get('content-type'), 'application/json');
  assert.equal(screenshotBody, '{}');
  return Response.json({ id: 'fixture' });
} });
await screenshot.feedback.bugs.screenshots.create({ body: file });
results.push({ check: 'Generated feedback screenshot corrupts raw bytes', result: 'REPRODUCED', observedBody: screenshotBody });

const events = [
  { type: 'image_generation', generation_id: 'fixture-generation', status: 'generating' },
  { type: 'done', message_id: 'msg_01h45ytscbeewvwm6xr90nbxp4', finish_reason: 'stop' },
  { type: 'image_generation', generation_id: 'fixture-generation', status: 'done', file_id: 'lbf_01h45ytscbeewvwm6xr90nbxp4', filename: 'fixture.png', content_type: 'image/png', byte_size: bytes.length },
];
const response = () => new Response(events.map((event, i) => `id: ${i + 1}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
const collect = async (stream) => { const out = []; for await (const event of stream) out.push(event); return out; };
const stream = createCortexClient({ baseUrl, cookieJar: false, fetch: async () => response() });
const parsed = await collect(readStream(response()));
const streamed = await collect(stream.streamTurn({ body: { message: 'fixture' }, idempotencyKey: 'fixture-key' }));
assert.equal(parsed.length, 3);
assert.equal(streamed.length, 2);
results.push({ check: 'streamTurn drops valid post-done image completion', result: 'REPRODUCED', parserFrames: parsed.length, helperFrames: streamed.length });

const summary = { runtime: process.version, scope: 'Exact 0.3.1 archive; local Fetch fixtures only; no server, build, suite replay or real credentials', results };
writeFileSync(new URL('./consumer-check.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
