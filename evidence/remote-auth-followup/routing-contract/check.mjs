import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repo = '/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite';
const { z } = await import(pathToFileURL(`${repo}/node_modules/zod/index.js`).href);
const { readStream, isId } = await import(pathToFileURL(`${repo}/packages/desktop/node_modules/@cortex/api-types/dist/index.js`).href);
const { Event } = await import(pathToFileURL(`${repo}/packages/schema/src/index.ts`).href);
const id = (prefix) => z.string().refine((value) => isId(prefix, value));
const CloudModel = z.object({
  slug: z.string().min(1), display_name: z.string().min(1), description: z.string(),
  context_tokens: z.number().int().nonnegative(), max_output_tokens: z.number().int().nonnegative(),
  supports_reasoning: z.boolean(), supports_tools: z.boolean(), supports_vision: z.boolean(),
  is_preview: z.boolean().optional(), kind: z.enum(['chat', 'image']).optional(),
  attribution: z.string().optional(), banner_url: z.string().optional(), fallback_slug: z.string().optional(),
});
const CloudPage = z.object({ items: z.array(CloudModel), has_more: z.literal(false) });
const Turn = z.object({
  message: z.string().trim().refine((s) => [...s].length <= 50_000),
  model_slug: z.string().min(1), reasoning_effort: z.enum(['low', 'medium', 'high']).optional(),
  attachment_ids: z.array(id('lbf')).max(20),
}).strict().refine((t) => t.message.length > 0 || t.attachment_ids.length > 0);
const suffix = '01h45ytscbeewvwm6xr90nbxp4';
const cnv = `cnv_${suffix}`, msg = `msg_${suffix}`, file = `lbf_${suffix}`;
const model = { slug: 'fixture', display_name: 'Fixture', description: '', context_tokens: 8192, max_output_tokens: 1024, supports_reasoning: true, supports_tools: false, supports_vision: true, kind: 'chat' };
assert.equal(CloudPage.parse({ items: [model], has_more: false }).items[0].supports_vision, true);
assert.equal(CloudPage.safeParse({ items: [{ ...model, supports_vision: 'true' }], has_more: false }).success, false);
const selected = (raw) => CloudPage.parse(raw).items.filter((m) => m.kind === 'chat');
assert.equal(selected({ items: [{ ...model, kind: 'image' }], has_more: false }).length, 0);
assert.equal(selected({ items: [{ ...model, kind: undefined }], has_more: false }).length, 0);
assert.equal(Turn.parse({ message: '😀'.repeat(50_000), model_slug: 'fixture', attachment_ids: [] }).message.length, 100_000);
assert.equal(Turn.safeParse({ message: '😀'.repeat(50_001), model_slug: 'fixture', attachment_ids: [] }).success, false);
assert.equal(Turn.safeParse({ message: 'image', model_slug: 'fixture', attachment_ids: Array(21).fill(file) }).success, false);
assert.equal(Turn.safeParse({ message: '', model_slug: 'fixture', attachment_ids: [file], reasoning_effort: 'high' }).success, true);
assert.equal(Turn.safeParse({ message: 'text', model_slug: 'fixture', attachment_ids: [], reasoning_effort: false }).success, false);
const admit = (headers, expected) => {
  const parsed = z.object({ conversation: id('cnv'), assistant: id('msg') }).parse({ conversation: headers.get('x-conversation-id'), assistant: headers.get('x-message-id') });
  if (expected) assert.equal(parsed.conversation, expected);
  return parsed;
};
const header = new Headers({ 'x-conversation-id': cnv, 'x-message-id': msg });
assert.deepEqual(admit(header, cnv), { conversation: cnv, assistant: msg });
assert.throws(() => admit(new Headers({ 'x-conversation-id': msg, 'x-message-id': msg })));
assert.throws(() => admit(new Headers()));

const localSession = 'ses_ephemeral_fixture', localMessage = 'msg_ephemeral_assistant';
const frames = [
  { type: 'reasoning_delta', message_id: msg, delta: 'Think' },
  { type: 'reasoning_done', message_id: msg, duration_ms: 12 },
  { type: 'text_delta', message_id: msg, delta: 'A' },
  { type: 'text_delta', message_id: msg, delta: 'B' },
  { type: 'done', message_id: msg, finish_reason: 'length' },
];
const wire = frames.map((frame, i) => `id: ${i === 3 ? 3 : i + 1}\ndata: ${JSON.stringify(frame)}\n\n`).join('');
const normalized = [];
let terminal;
for await (const frame of readStream(new Response(wire, { headers: { 'content-type': 'text/event-stream' } }))) {
  if ('message_id' in frame) assert.equal(id('msg').parse(frame.message_id), msg);
  if (frame.type === 'text_delta' || frame.type === 'reasoning_delta') {
    const field = frame.type === 'text_delta' ? 'text' : 'reasoning';
    normalized.push(Event.parse({ type: 'part.delta', properties: { sessionID: localSession, messageID: localMessage, partID: `prt_${field}`, field, delta: frame.delta } }));
  } else if (frame.type === 'done') terminal = frame.finish_reason === 'length' ? 'truncated' : frame.finish_reason;
}
assert.deepEqual(normalized.map((e) => [e.properties.field, e.properties.delta]), [['reasoning', 'Think'], ['text', 'A'], ['text', 'B']]);
assert.equal(terminal, 'truncated');
const sanitizeError = (event) => ({ code: event.code === 'stream_expired' ? 'remote_resume_expired' : 'remote_request_failed' });
assert.deepEqual(sanitizeError({ type: 'error', code: 'stream_expired', detail: 'fixture-secret', request_id: 'fixture' }), { code: 'remote_resume_expired' });
const identity = { origin: 'https://instance.example', epoch: 'fixture-epoch-1' };
const bound = new Map([[JSON.stringify([identity.origin, identity.epoch, cnv]), localSession]]);
assert.equal(bound.get(JSON.stringify([identity.origin, 'fixture-epoch-2', cnv])), undefined);
const result = { result: 'PASS', runtime: process.version, scope: 'Contract assertions only; no auth, network, engine, SDK transport or repository implementation', assertions: ['Cloud model boundary/type and Chat filtering', 'Unicode code-point 50000 ceiling', '20-attachment count (ownership remains server check)', 'image-only payload allowed; boolean reasoning rejected', 'validated conversation/assistant headers', 'reasoning/text Event mapping; equal SSE IDs retained', 'length is truncated, raw error detail stripped', 'same remote ID separated by account epoch'] };
writeFileSync(new URL('./check.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
